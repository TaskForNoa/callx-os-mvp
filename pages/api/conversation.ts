import type { NextApiRequest, NextApiResponse } from 'next';
import leadsData from '../../data/mock-leads.json';
import productsData from '../../data/products-full.json';
import { getEmbedding } from '../../lib/embeddings';
import { getSupabaseAdmin } from '../../lib/supabaseAdmin';

// Conversation state machine
// 7-step flow: greeting → recording info → past program → interest → listen → offer → outcome

// RAG: retrieve similar training fragments for context
async function retrieveRAGContext(query: string, limit = 3): Promise<string[]> {
  try {
    const key = process.env.OPENAI_API_KEY;
    const sbUrl = process.env.SUPABASE_URL;
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!key || !sbUrl || !sbKey) return [];

    const embedding = await getEmbedding(query);
    const supabase = getSupabaseAdmin();
    const { data } = await supabase.rpc('match_training_chunks', {
      query_embedding: JSON.stringify(embedding),
      match_threshold: 0.35,
      match_count: limit,
    });
    return (data || []).map((r: any) => r.chunk_text);
  } catch {
    // RAG is best-effort — don't break conversation if it fails
    return [];
  }
}

// Polish name declension — genitive (dopełniacz) for "rodzicem [kogo?]"
const GENITIVE: Record<string, string> = {
  // Male child names
  'Kacper': 'Kacpra', 'Bartek': 'Bartka', 'Filip': 'Filipa', 'Adam': 'Adama',
  'Szymon': 'Szymona', 'Mateusz': 'Mateusza',
  // Female child names
  'Zosia': 'Zosi', 'Ola': 'Oli', 'Maja': 'Mai', 'Hania': 'Hani',
  'Julia': 'Julii', 'Alicja': 'Alicji',
  // Parent first names (in case used)
  'Jan': 'Jana', 'Anna': 'Anny', 'Piotr': 'Piotra', 'Ewa': 'Ewy',
  'Marek': 'Marka', 'Katarzyna': 'Katarzyny', 'Tomasz': 'Tomasza',
  'Magdalena': 'Magdaleny', 'Michał': 'Michała', 'Agnieszka': 'Agnieszki',
  'Robert': 'Roberta', 'Monika': 'Moniki',
};

function genitive(name: string): string {
  if (GENITIVE[name]) return GENITIVE[name];
  // Simple heuristic for common Polish endings
  if (name.endsWith('a')) return name.slice(0, -1) + 'y';
  if (name.endsWith('ek')) return name.slice(0, -2) + 'ka';
  return name + 'a'; // default masculine
}

interface ConversationState {
  step: number;
  customerResponse: string;
  leadData: any;
  history: Array<{ speaker: string; text: string }>;
  voice?: string;
}

type Product = any;

type OfferFacts = {
  productId: string;
  label: string;
  regular: number | null;
  early: number | null;
  savings: number | null;
  ratio?: string;
  terminy?: string;
  znizki?: string;
  coZawiera?: string;
  url?: string;
  wariant?: string;
};

function formatPrice(price: number | null): string {
  if (price == null) return '—';
  return price.toLocaleString('pl-PL') + ' zł';
}

function buildOfferFacts(p: any, label: string): OfferFacts {
  const regular = p?.cenaRegularna ?? null;
  const early = p?.cenaZnizka ?? null;
  const savings = (regular != null && early != null) ? (regular - early) : null;
  return {
    productId: p?.id || p?.name || label,
    label,
    regular,
    early,
    savings,
    ratio: p?.ratio,
    terminy: p?.terminy,
    znizki: p?.znizki,
    coZawiera: p?.coZawiera,
    url: p?.url,
    wariant: p?.wariant,
  };
}

function pickOfferForDestination(destinationRaw: string): OfferFacts | null {
  const dest = (destinationRaw || '').toLowerCase();
  const products = productsData as Product[];

  // Helpers
  const pick = (filterFn: (p: Product) => boolean) => {
    const candidates = products.filter(filterFn);
    // Prefer ones with Early Bird if present
    candidates.sort((a, b) => {
      const ae = a.cenaZnizka != null ? 0 : 1;
      const be = b.cenaZnizka != null ? 0 : 1;
      return ae - be;
    });
    return candidates[0] || null;
  };

  if (dest.includes('malta')) {
    const p = pick(p => (p.name || '').includes('Junior International') && (p.name || '').includes('Malta') && (p.wariant || '').toLowerCase().includes('tygodniowy'))
      || pick(p => (p.name || '').includes('Junior International') && (p.name || '').includes('Malta'));
    if (!p) return null;
    return buildOfferFacts(p, 'Junior International – Malta');
  }

  if (dest.includes('anglia') || dest.includes('uk') || dest.includes('wielka bryt')) {
    const p = pick(p => (p.name || '').includes('Junior International') && ((p.name || '').includes('Anglia') || (p.name || '').includes('UK')));
    if (!p) return null;
    return buildOfferFacts(p, p.name || 'Junior International – Anglia');
  }

  // Default: Junior PL (Wakacje)
  const p = pick(p => (p.name || '') === 'Angloville Junior' && (p.wariant || '').toLowerCase().includes('wakacje'))
    || pick(p => (p.name || '') === 'Angloville Junior');

  if (!p) return null;
  return buildOfferFacts(p, 'Angloville Junior (Polska)');
}

function getAgentResponse(state: ConversationState): { text: string; nextStep: number; outcome?: string; offerUsed?: OfferFacts | null; emailSecondary?: string | null } {
  const lead = state.leadData;
  const customerSaid = (state.customerResponse || '').toLowerCase();
  const parentName = lead.first_name;
  const childName = lead.childName || lead.first_name;
  const childGenitive = genitive(childName);
  const lastProgram = lead.past_programs[lead.past_programs.length - 1];
  const destination = lead.preferred_destination;
  const offer = pickOfferForDestination(destination);
  const offerPrice = offer?.early ?? offer?.regular ?? null;

  switch (state.step) {
    case 0:
      // Step 1: Greeting
      return {
        text: `Dzień dobry, czy rozmawiam z rodzicem ${childGenitive}? Z tej strony ${state.voice || 'Karolina'}, firma Angloville. Ma Pan/Pani chwilę na rozmowę?`,
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
        text: `Świetnie! Dzwonię, ponieważ widzę, że ${childName} uczestniczył wcześniej w naszych programach. Ostatnio na ${lastProgram}. Czy dziecku się podobało?`,
        nextStep: 3, // skip step 2, go directly to opinion
      };

    case 2:
      // Step 3: Past program reminder
      if (!customerSaid.trim()) {
        return {
          text: `Widzę, że ostatnio byli Państwo na programie ${lastProgram}. Czy dziecku się podobało?`,
          nextStep: 3,
        };
      }
      return {
        text: `Widzę, że ostatnio byli Państwo na programie ${lastProgram}. Czy dziecku się podobało?`,
        nextStep: 3,
      };

    case 3:
      // Step 4: Interest question
      if (!customerSaid.trim()) {
        return {
          text: `Przepraszam — nie usłyszałam odpowiedzi. Czy dziecku się podobało na programie ${lastProgram}?`,
          nextStep: 3,
        };
      }
      if (customerSaid.includes('tak') || customerSaid.includes('super') || customerSaid.includes('podobało') || customerSaid.includes('fajnie')) {
        return {
          text: `To fantastycznie! Mamy na sezon 2026 kilka opcji. ${offer ? `Wstępnie pasowałby ${offer.label}.` : ''} Czy interesuje Państwa bardziej opcja w Polsce, czy zagraniczna?`,
          nextStep: 4,
          offerUsed: offer || null,
        };
      } else if (customerSaid.includes('nie') || customerSaid.includes('średnio')) {
        return {
          text: 'Rozumiem. Czy mogę zapytać, co moglibyśmy poprawić? A jaki kierunek byłby ciekawszy — Polska, Malta, czy może Anglia?',
          nextStep: 4,
        };
      }
      return {
        text: `Mamy ofertę na sezon 2026. Żeby dobrze dopasować — czy szukają Państwo wyjazdu w Polsce czy za granicą?`,
        nextStep: 4,
        offerUsed: offer || null,
      };

    case 4:
      // Step 5: Listen + respond
      // IMPORTANT: no hallucinations. We can only cite facts we have in the knowledge base.
      // If we don't have facts (price/ratio/etc.), ask clarifying questions and promise a human follow-up.
      if (!offer) {
        return {
          text: 'Żeby dobrze dopasować — czy interesuje Państwa wyjazd w Polsce czy za granicą? I w jakim wieku jest dziecko?',
          nextStep: 4,
          offerUsed: null,
        };
      }

      const priceLine = offerPrice != null
        ? (offer.early != null && offer.regular != null && offer.early < offer.regular
          ? `Cena Early Bird to ${formatPrice(offer.early)} zamiast ${formatPrice(offer.regular)}${offer.savings != null ? ` (oszczędność ${formatPrice(offer.savings)})` : ''}.`
          : `Cena to ${formatPrice(offerPrice)}.`)
        : 'Nie mam w bazie aktualnej ceny dla tego wariantu — sprawdzę i wrócę do Państwa mailowo.';

      const ratioLine = offer.ratio ? `Stosunek native speakerów do uczestników: ${offer.ratio}.` : '';
      const terminyLine = offer.terminy ? `Najbliższe terminy: ${offer.terminy}.` : '';

      if (customerSaid.includes('tak') || customerSaid.includes('chętnie') || customerSaid.includes('opowiedz') || customerSaid.includes('interesuje')) {
        const email = lead.email;
        return {
          text: `Świetnie. ${priceLine} ${ratioLine} ${terminyLine} Wyślę mailowo szczegóły (link + opis co zawiera cena). Mam adres: ${email}. Czy jest poprawny? Jeśli woli Pan/Pani drugi adres, proszę go podać — dodam jako dodatkowy.`,
          nextStep: 5,
          offerUsed: offer,
        };
      } else if (customerSaid.includes('nie') || customerSaid.includes('dzięki') || customerSaid.includes('rezygnuję')) {
        return {
          text: 'Rozumiem. Żeby nie zgadywać: czy woleliby Państwo opcję w Polsce, czy zagraniczną (Malta/UK)? Sprawdzę dostępne warianty i wrócę mailowo z konkretną propozycją.',
          nextStep: 6, // Second try - offer alternative
        };
      }

      const email = lead.email;
      return {
        text: `W skrócie: ${offer.label}${offer.wariant ? ` (${offer.wariant})` : ''}. ${priceLine} ${ratioLine} Jeśli się zgadza, wyślę podsumowanie i link mailem. Mam adres: ${email}. Czy jest poprawny? (Jeśli ma być drugi, proszę podać — dodam jako dodatkowy.)`,
        nextStep: 5,
        offerUsed: offer,
      };

    case 5: {
      // Step 6: Email confirmation / send (simulated for now)
      // Rules from Michał: we can confirm primary email from lead; we cannot overwrite it.
      // If customer provides another email, we store/use it as secondary (additional).

      const primaryEmail = (lead.email || '').trim();
      const emailRegex = /([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i;
      const match = (state.customerResponse || '').match(emailRegex);
      const secondaryEmail = match && match[1] ? match[1].trim() : '';
      const hasSecondary = secondaryEmail && secondaryEmail.toLowerCase() !== primaryEmail.toLowerCase();

      // Interpret confirmation
      const confirmed = customerSaid.includes('tak') || customerSaid.includes('zgadza') || customerSaid.includes('popraw') || customerSaid.includes('dobry') || customerSaid.includes('ok');
      const wantsSend = customerSaid.includes('wyślij') || customerSaid.includes('poproszę') || customerSaid.includes('mail');
      const denied = customerSaid.includes('nie') || customerSaid.includes('zły') || customerSaid.includes('nieaktual');

      // If they say it's wrong but didn't provide a secondary email, ask again.
      if (denied && !hasSecondary) {
        return {
          text: `Jasne — proszę podać poprawny adres e-mail (dodam go jako dodatkowy) i wyślę podsumowanie oraz link. Obecny w systemie to: ${primaryEmail}.`,
          nextStep: 5,
        };
      }

      // If they provided an email (secondary), treat it as acceptable.
      if (hasSecondary && (confirmed || wantsSend || denied)) {
        return {
          text: `Dziękuję. Wyślę podsumowanie na ${primaryEmail}${hasSecondary ? ` oraz dodatkowo na ${secondaryEmail}` : ''}. Jeśli jakiejś informacji brakuje w bazie (np. link), sprawdzę i doślę w kolejnym mailu. Miłego dnia!`,
          nextStep: 99,
          outcome: 'Email Summary Sent (Simulated)',
          offerUsed: offer || null,
          emailSecondary: hasSecondary ? secondaryEmail : null,
        };
      }

      // Standard path: if they confirm the primary email.
      if (confirmed || wantsSend) {
        return {
          text: `Doskonale. Wyślę podsumowanie i link na ${primaryEmail}. Jeśli jakiejś informacji brakuje w bazie (np. link), sprawdzę i doślę w kolejnym mailu. Dziękuję za rozmowę!`,
          nextStep: 99,
          outcome: 'Email Summary Sent (Simulated)',
          offerUsed: offer || null,
          emailSecondary: null,
        };
      }

      return {
        text: `Dla pewności: mam adres ${primaryEmail}. Czy potwierdza Pan/Pani, że jest poprawny? (Jeśli ma być drugi, proszę go podać.)`,
        nextStep: 5,
        offerUsed: offer || null,
      };
    }

    case 6:
      // Second try (alternative offer)
      if (customerSaid.includes('tak') || customerSaid.includes('malta') || customerSaid.includes('trip') || customerSaid.includes('polska') || customerSaid.includes('anglia')) {
        return {
          text: 'Świetnie! Sprawdzę dostępne warianty i wyślę mailem. Czy mogę potwierdzić adres email, który mam w systemie?',
          nextStep: 5,
          outcome: 'Alternative Interest',
        };
      }
      return {
        text: 'Rozumiem. Dziękuję bardzo za rozmowę i poświęcony czas. Czy mogę ewentualnie zadzwonić za jakiś czas z nowymi propozycjami?',
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

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
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

  // RAG: retrieve similar training fragments when customer responds
  // NOTE: RAG is disabled until embeddings are generated (avoids ~500ms latency per turn)
  let ragContext: string[] = [];
  // if (customerResponse && customerResponse.trim()) {
  //   ragContext = await retrieveRAGContext(customerResponse, 3);
  // }

  const response = getAgentResponse(state);

  // Simulated email send (MVP): if conversation is complete and outcome indicates email sent, log it.
  // NOTE: serverless cold starts will wipe this. Good enough for Phase 2 demo.
  if (response.nextStep === 99 && (response.outcome || '').toLowerCase().includes('email')) {
    const primaryEmail = (lead.email || '').trim();
    const secondaryEmail = response.emailSecondary ? String(response.emailSecondary).trim() : '';

    // Compose email from knowledge base facts only.
    const offerUsed = response.offerUsed || null;
    const subject = offerUsed
      ? `Angloville — podsumowanie i link: ${offerUsed.label}`
      : 'Angloville — podsumowanie i link do zapisu';

    const lines: string[] = [];
    lines.push('Dzień dobry,');
    lines.push('');
    lines.push('Zgodnie z rozmową — przesyłam podsumowanie i link do zapisu.');
    lines.push('');

    if (offerUsed) {
      lines.push(`Program: ${offerUsed.label}${offerUsed.wariant ? ` (${offerUsed.wariant})` : ''}`);
      if (offerUsed.early != null || offerUsed.regular != null) {
        const price = offerUsed.early ?? offerUsed.regular;
        const priceKind = offerUsed.early != null ? 'Early Bird' : 'Cena';
        lines.push(`${priceKind}: ${formatPrice(price ?? null)}`);
        if (offerUsed.early != null && offerUsed.regular != null && offerUsed.early < offerUsed.regular) {
          lines.push(`Cena regularna: ${formatPrice(offerUsed.regular)}`);
        }
      } else {
        lines.push('Cena: (brak w bazie dla tego wariantu — sprawdzimy i wrócimy z potwierdzeniem)');
      }
      if (offerUsed.ratio) lines.push(`Stosunek native speakerów do uczestników: ${offerUsed.ratio}`);
      if (offerUsed.terminy) lines.push(`Terminy: ${offerUsed.terminy}`);
      lines.push('');
      lines.push(offerUsed.url ? `Link do zapisu/strony: ${offerUsed.url}` : 'Link: (brak w bazie — doślemy w kolejnym mailu)');
    } else {
      lines.push('Nie udało się jednoznacznie dobrać programu na podstawie danych z rozmowy — wrócimy z dopasowaniem i linkiem.');
    }

    lines.push('');
    lines.push('Pozdrawiam,');
    lines.push('Angloville');

    // Use the shared simulated email endpoint store.
    // Importing handler is messy; do a local in-memory log here.
    (globalThis as any).__callx_emails = (globalThis as any).__callx_emails || [];
    (globalThis as any).__callx_emails.push({
      email_id: `email_${Date.now()}`,
      provider: 'simulated',
      from: 'taskfornoa@gmail.com',
      to: primaryEmail,
      cc: secondaryEmail && secondaryEmail.toLowerCase() !== primaryEmail.toLowerCase() ? [secondaryEmail] : [],
      subject,
      body: lines.join('\n'),
      meta: {
        customer_id,
        offer: offerUsed ? { productId: offerUsed.productId, label: offerUsed.label } : null,
      },
      status: 'sent',
      sent_at: new Date().toISOString(),
    });
  }

  res.status(200).json({
    agentText: response.text,
    nextStep: response.nextStep,
    outcome: response.outcome || null,
    isComplete: response.nextStep === 99,
    // Basic auditability: what product (from knowledge base) we used for the offer.
    offer: response.offerUsed ? {
      productId: response.offerUsed.productId,
      label: response.offerUsed.label,
      regular: response.offerUsed.regular,
      early: response.offerUsed.early,
      ratio: response.offerUsed.ratio,
      terminy: response.offerUsed.terminy,
      url: response.offerUsed.url,
    } : null,
    ragContext: ragContext.length > 0 ? ragContext : undefined,
  });
}
