import type { NextApiRequest, NextApiResponse } from 'next';
import leadsData from '../../data/mock-leads.json';

// Conversation state machine
// 7-step flow: greeting → recording info → past program → interest → listen → offer → outcome

interface ConversationState {
  step: number;
  customerResponse: string;
  leadData: any;
  history: Array<{ speaker: string; text: string }>;
  voice?: string;
}

function getAgentResponse(state: ConversationState): { text: string; nextStep: number; outcome?: string } {
  const lead = state.leadData;
  const customerSaid = state.customerResponse.toLowerCase();
  const name = lead.first_name;
  const lastProgram = lead.past_programs[lead.past_programs.length - 1];
  const destination = lead.preferred_destination;

  switch (state.step) {
    case 0:
      // Step 1: Greeting
      return {
        text: `Dzień dobry, czy rozmawiam z rodzicem ${name}? Dzwonię z Angloville, mam na imię ${state.voice || 'Karolina'}.`,
        nextStep: 1,
      };

    case 1:
      // Step 2: Recording info
      if (customerSaid.includes('nie') && (customerSaid.includes('czas') || customerSaid.includes('mogę') || customerSaid.includes('teraz'))) {
        return {
          text: 'Rozumiem, przepraszam za kłopot. Czy mogę zadzwonić w innym terminie?',
          nextStep: 99,
          outcome: 'Callback Requested',
        };
      }
      return {
        text: 'Świetnie! Informuję, że ta rozmowa jest nagrywana w celach jakościowych. Dzwonię, ponieważ widzę, że Państwa dziecko uczestniczyło wcześniej w naszych programach.',
        nextStep: 2,
      };

    case 2:
      // Step 3: Past program reminder
      return {
        text: `Widzę, że ostatnio byli Państwo na programie ${lastProgram}. Czy dziecku się podobało?`,
        nextStep: 3,
      };

    case 3:
      // Step 4: Interest question
      if (customerSaid.includes('tak') || customerSaid.includes('super') || customerSaid.includes('podobało') || customerSaid.includes('fajnie')) {
        return {
          text: `To wspaniale! Mamy teraz świetną ofertę Early Bird na sezon 2026. Czy byliby Państwo zainteresowani programem Junior ${destination}?`,
          nextStep: 4,
        };
      } else if (customerSaid.includes('nie') || customerSaid.includes('średnio')) {
        return {
          text: 'Rozumiem. Czy mogę zapytać, co moglibyśmy poprawić? Zależy nam na opinii naszych klientów.',
          nextStep: 4,
        };
      }
      return {
        text: `Rozumiem. Mamy teraz ofertę Early Bird na sezon 2026 z rabatem. Program Junior ${destination} - czy chcieliby Państwo usłyszeć więcej szczegółów?`,
        nextStep: 4,
      };

    case 4:
      // Step 5: Listen + respond
      if (customerSaid.includes('tak') || customerSaid.includes('chętnie') || customerSaid.includes('opowiedz') || customerSaid.includes('interesuje')) {
        return {
          text: `Świetnie! Program Junior ${destination} 2026 to 6 dni intensywnej nauki angielskiego z native speakerami w ratio 1 do 2. Cena Early Bird to 4449 złotych zamiast 4699. Mogę wysłać Państwu link do zapisu - czy podać na ten numer?`,
          nextStep: 5,
        };
      } else if (customerSaid.includes('nie') || customerSaid.includes('dzięki') || customerSaid.includes('rezygnuję')) {
        return {
          text: 'Rozumiem. A może zainteresowałby Państwa inny program - na przykład Malta albo UK Trip? Mamy różne opcje.',
          nextStep: 6, // Second try - offer alternative
        };
      }
      return {
        text: `Program kosztuje 4449 złotych w cenie Early Bird. To jest 250 złotych taniej niż cena regularna. Mogę wysłać więcej informacji na maila lub SMSem - co Państwo wolą?`,
        nextStep: 5,
      };

    case 5:
      // Step 6: Send info / close
      if (customerSaid.includes('tak') || customerSaid.includes('wyślij') || customerSaid.includes('poproszę') || customerSaid.includes('mail') || customerSaid.includes('sms')) {
        return {
          text: 'Doskonale! Wysyłam link do zapisu. Dziękuję bardzo za rozmowę i życzę miłego dnia!',
          nextStep: 99,
          outcome: 'Link Sent - Interested',
        };
      } else if (customerSaid.includes('pomyśl') || customerSaid.includes('zastanow')) {
        return {
          text: 'Oczywiście, proszę się nie śpieszyć. Wyślę Państwu link informacyjny, żeby mogli spokojnie przejrzeć ofertę. Dziękuję za rozmowę!',
          nextStep: 99,
          outcome: 'Link Sent - Not Convinced',
        };
      }
      return {
        text: 'Rozumiem. Wyślę Państwu informacje mailem, żeby mogli spokojnie przejrzeć. Dziękuję za poświęcony czas i życzę miłego dnia!',
        nextStep: 99,
        outcome: 'Link Sent - Neutral',
      };

    case 6:
      // Second try (alternative offer)
      if (customerSaid.includes('tak') || customerSaid.includes('malta') || customerSaid.includes('trip')) {
        return {
          text: 'Świetnie! Wyślę Państwu informacje o dostępnych programach. Dziękuję za rozmowę!',
          nextStep: 99,
          outcome: 'Alternative Interest',
        };
      }
      return {
        text: 'Rozumiem. Dziękuję bardzo za rozmowę i poświęcony czas. Gdyby zmienili Państwo zdanie, zapraszamy na angloville.pl. Miłego dnia!',
        nextStep: 99,
        outcome: 'Not Interested',
      };

    case 99:
      // Conversation ended
      return {
        text: '',
        nextStep: 99,
        outcome: 'Completed',
      };

    default:
      return {
        text: 'Dziękuję za rozmowę. Miłego dnia!',
        nextStep: 99,
        outcome: 'Completed',
      };
  }
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { customer_id, step, customerResponse, history, voice } = req.body;

  if (!customer_id) {
    return res.status(400).json({ error: 'customer_id required' });
  }

  const lead = leadsData.find(l => l.customer_id === customer_id);
  if (!lead) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  const state: ConversationState = {
    step: step || 0,
    customerResponse: customerResponse || '',
    leadData: lead,
    history: history || [],
    voice: voice || null,
  };

  const response = getAgentResponse(state);

  res.status(200).json({
    agentText: response.text,
    nextStep: response.nextStep,
    outcome: response.outcome || null,
    isComplete: response.nextStep === 99,
  });
}
