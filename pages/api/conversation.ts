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
  program?: string;
  cechy?: string;
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
    program: p?.program,
    cechy: p?.cechy,
    url: p?.url,
    wariant: p?.wariant,
  };
}

function buildPriceLine(offer: OfferFacts): string {
  const offerPrice = offer.early ?? offer.regular ?? null;
  if (offerPrice == null) return 'Nie mam w bazie aktualnej ceny — sprawdzę i wrócę mailowo.';
  if (offer.early != null && offer.regular != null && offer.early < offer.regular) {
    return `Cena Early Bird to ${formatPrice(offer.early)} zamiast ${formatPrice(offer.regular)}${offer.savings != null ? ` (oszczędność ${formatPrice(offer.savings)})` : ''}.`;
  }
  return `Cena to ${formatPrice(offerPrice)}.`;
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

// ── Detect product from full conversation context ──
function pickOfferFromConversation(customerSaid: string, history: Array<{ speaker: string; text: string }>): OfferFacts | null {
  const allCustomerText = history
    .filter(h => h.speaker === 'customer')
    .map(h => h.text)
    .concat([customerSaid])
    .join(' ')
    .toLowerCase();

  const products = productsData as Product[];
  const pick = (filterFn: (p: Product) => boolean) => {
    const candidates = products.filter(filterFn);
    candidates.sort((a, b) => (a.cenaZnizka != null ? 0 : 1) - (b.cenaZnizka != null ? 0 : 1));
    return candidates[0] || null;
  };

  if (allCustomerText.includes('malta')) {
    const p = pick(p => (p.name || '').includes('Junior International') && (p.name || '').includes('Malta'));
    if (p) return buildOfferFacts(p, 'Junior International – Malta');
  }
  if (allCustomerText.includes('anglia') || allCustomerText.includes('uk') || allCustomerText.includes('londyn')) {
    const p = pick(p => (p.name || '').includes('Junior International') && ((p.name || '').includes('Anglia') || (p.name || '').includes('UK')));
    if (p) return buildOfferFacts(p, p.name || 'Junior International – Anglia');
  }
  if (allCustomerText.includes('narc') || allCustomerText.includes('ski') || allCustomerText.includes('stok')) {
    const p = pick(p => (p.name || '').toLowerCase().includes('ski') || (p.name || '').toLowerCase().includes('narc'));
    if (p) return buildOfferFacts(p, p.name || 'Junior SKI');
  }
  if (allCustomerText.includes('dorośl') || allCustomerText.includes('dla siebie') || allCustomerText.includes('adult')) {
    const p = pick(p => (p.name || '').includes('Adult') || (p.name || '').includes('Angielska Wioska'));
    if (p) return buildOfferFacts(p, p.name || 'Program dla dorosłych');
  }
  if (allCustomerText.includes('kids') || allCustomerText.match(/\b[7-9]\s*(lat|rok)/)) {
    const p = pick(p => (p.name || '').includes('Kids'));
    if (p) return buildOfferFacts(p, p.name || 'Angloville Kids');
  }
  if (allCustomerText.includes('zagrani') || allCustomerText.includes('za granic')) {
    const p = pick(p => (p.name || '').includes('Junior International') && (p.name || '').includes('Malta'));
    if (p) return buildOfferFacts(p, 'Junior International – Malta');
  }
  if (allCustomerText.includes('polsk') || allCustomerText.includes('w kraju') || allCustomerText.includes('tradycyj') || allCustomerText.includes('językow')) {
    const p = pick(p => (p.name || '') === 'Angloville Junior' && (p.wariant || '').toLowerCase().includes('wakacje'))
      || pick(p => (p.name || '') === 'Angloville Junior');
    if (p) return buildOfferFacts(p, 'Angloville Junior (Polska)');
  }

  return null;
}

// ════════════════════════════════════════════════════════════════
// CONVERSATION STATE MACHINE
// Follows scenarioFlow.ts exactly:
//   Step 0: Powitanie + identyfikacja
//   Step 1: Rozpoznanie potrzeb (wiek, województwo, poziom, preferencje)
//   Step 2: Prezentacja programu (opis formatu, 40+20 NS, sesje 2:1 — BEZ ceny)
//   Step 3: Cena + dostępność (Early Bird, raty, ostatnie miejsca)
//   Step 4: Rezerwacja lub wysyłka maila
//   Step 5: Zamknięcie + follow-up
// ════════════════════════════════════════════════════════════════

function getAgentResponse(state: ConversationState): { text: string; nextStep: number; outcome?: string; offerUsed?: OfferFacts | null; emailSecondary?: string | null } {
  const lead = state.leadData;
  const customerSaid = (state.customerResponse || '').toLowerCase();
  const childName = lead.childName || lead.first_name;
  const childGenitive = genitive(childName);
  const lastProgram = lead.past_programs[lead.past_programs.length - 1];

  switch (state.step) {

    // ══ STEP 0: Powitanie + identyfikacja ══
    // Cel: przedstawić się, potwierdzić tożsamość, zapytać o dostępność
    case 0:
      return {
        text: `Dzień dobry, czy rozmawiam z rodzicem ${childGenitive}? Z tej strony ${state.voice || 'Karolina'}, firma Angloville, programy językowe. Ma Pan/Pani teraz chwilę na rozmowę?`,
        nextStep: 1,
      };

    // ══ STEP 1: Rozpoznanie potrzeb ══
    // Cel: ustalić kluczowe dane — kontekst historyczny + preferencje
    // Łączymy: potwierdzenie dostępności → nawiązanie do historii → pytanie o potrzeby
    case 1: {
      // Klient nie ma czasu
      if (customerSaid.includes('nie') && (customerSaid.includes('czas') || customerSaid.includes('mogę') || customerSaid.includes('teraz'))) {
        return {
          text: 'Rozumiem, przepraszam za kłopot. Kiedy mogłabym zadzwonić ponownie?',
          nextStep: 99,
          outcome: 'Callback Requested',
        };
      }
      // Ma czas → nawiązanie do historii + pytanie o potrzeby
      return {
        text: `Dzwonię, ponieważ widzę, że ${childName} uczestniczył w naszych programach — ostatnio na ${lastProgram}. Jak dziecku się podobało? I czy szukają Państwo czegoś na sezon 2026 — w Polsce, czy może za granicą?`,
        nextStep: 2,
      };
    }

    // ══ STEP 2: Prezentacja programu ══
    // Cel: opisać cechy i wyróżniki dopasowanego programu.
    // Metoda Angloville, stosunek NS:uczestników, lokalizacja, plan programu.
    // NIE podawać ceny — podajemy dopiero na pytanie klienta!
    case 2: {
      const offer = pickOfferFromConversation(customerSaid, state.history);

      if (!customerSaid.trim()) {
        return {
          text: 'Czy szukają Państwo wyjazdu w Polsce, czy za granicą? I ile lat ma dziecko?',
          nextStep: 2,
        };
      }

      // Klient dał wystarczająco info → prezentujemy program (BEZ ceny)
      if (offer) {
        // Build rich description from KB fields
        const ratioDesc = offer.ratio
          ? `Program opiera się na metodzie Angloville — stosunek native speakerów do uczestników to ${offer.ratio}.`
          : 'Program opiera się na metodzie Angloville, gdzie na dwóch polskich uczestników przypada jeden native speaker.';

        // Check if it's a tourist program (no language sessions)
        const isTourist = offer.ratio && (offer.ratio.toLowerCase().includes('brak sesji') || offer.ratio.toLowerCase().includes('pilot'));

        let programDesc = '';
        if (offer.coZawiera) {
          programDesc = ` W programie: ${offer.coZawiera}.`;
        }

        let presentation: string;
        if (isTourist) {
          // Tourist program — focus on destinations and experience
          presentation = `Polecam ${offer.label}. To wyjazd turystyczno-językowy${offer.wariant ? ` (${offer.wariant})` : ''}.${programDesc} ${ratioDesc} Angielski w praktyce — w naturalnych sytuacjach podczas zwiedzania.`;
        } else {
          // Language program — focus on Angloville method
          presentation = `Polecam ${offer.label}. ${ratioDesc} Nauka odbywa się przez zabawę — sesje językowe, karaoke, talent show, tańce irlandzkie. W ciągu tygodnia to aż 70 godzin zanurzenia w angielskim. Bez zeszytów, bez książek — dzieci uczą się tak, jak nauczyły się polskiego.${programDesc}`;
        }

        return {
          text: `${presentation} Czy chciałby Pan/Pani poznać cenę i dostępne terminy?`,
          nextStep: 3,
          offerUsed: offer,
        };
      }

      // Klient mówi ogólnie — dopytaj z opisem opcji
      if (customerSaid.includes('polsk') || customerSaid.includes('w kraju')) {
        return {
          text: 'W Polsce mamy opcję językową — tydzień z native speakerami w hotelu, sesje 2 na 1, karaoke, talent show. Jest też opcja narciarsko-językowa: pół dnia na stoku, pół dnia szkolenie językowe. Która bardziej pasuje? I ile lat ma dziecko?',
          nextStep: 2,
        };
      }
      if (customerSaid.includes('zagrani') || customerSaid.includes('za granic')) {
        return {
          text: 'Za granicą mamy dwie opcje. Malta — tygodniowy program z native speakerami w słonecznym klimacie, sesje 2 na 1. Anglia — wyjazd autokarem, zakwaterowanie u brytyjskich rodzin, zwiedzanie Londynu z native speakerami. Która brzmi ciekawiej?',
          nextStep: 2,
        };
      }
      if (customerSaid.includes('tak') || customerSaid.includes('super') || customerSaid.includes('podobało') || customerSaid.includes('fajnie')) {
        return {
          text: 'To fantastycznie! Mamy kilka opcji na 2026. Polska, Malta, Anglia — każda oparta na metodzie Angloville z native speakerami. Który kierunek najbardziej interesuje?',
          nextStep: 2,
        };
      }
      if (customerSaid.includes('nie') || customerSaid.includes('średnio') || customerSaid.includes('słab')) {
        return {
          text: 'Rozumiem. Na 2026 mamy nowe opcje — może coś innego by lepiej pasowało. Polska, Malta, czy Anglia? I w jakim wieku jest dziecko?',
          nextStep: 2,
        };
      }
      // Fallback
      return {
        text: 'Żeby dobrze dopasować — ile lat ma dziecko? Mamy programy w Polsce, na Malcie i w Anglii, każdy oparty na metodzie Angloville z native speakerami. Który kierunek najbardziej interesuje?',
        nextStep: 2,
      };
    }

    // ══ STEP 3: Cena + dostępność ══
    // Cel: podać cenę DOPIERO gdy klient pyta. Zawsze najpierw cechy/wyróżniki.
    case 3: {
      const offer = pickOfferFromConversation(customerSaid, state.history) || pickOfferForDestination(lead.preferred_destination);

      if (!offer) {
        return {
          text: 'Nie mam jeszcze dość informacji żeby dopasować program. Który kierunek najbardziej interesuje — Polska, Malta, czy Anglia?',
          nextStep: 2,
          offerUsed: null,
        };
      }

      const priceLine = buildPriceLine(offer);
      const terminyLine = offer.terminy ? `Terminy: ${offer.terminy}.` : '';

      // Klient chce cenę
      if (customerSaid.includes('tak') || customerSaid.includes('cenę') || customerSaid.includes('ile') || customerSaid.includes('kosztuje') || customerSaid.includes('chętnie')) {
        return {
          text: `${priceLine} ${terminyLine} Mamy raty 0% od 2 do 5 rat. Przy ponownym uczestnictwie jest dodatkowa zniżka 150 złotych. Zostały ostatnie miejsca. Czy wysłać szczegóły i link mailem?`,
          nextStep: 4,
          offerUsed: offer,
        };
      }
      // Klient pyta o coś innego / waha się — wróć do cech programu
      if (customerSaid.includes('nie') || customerSaid.includes('wiem')) {
        return {
          text: `Bez zobowiązań — mogę opowiedzieć więcej o programie. ${offer.coZawiera ? `W cenie jest: ${offer.coZawiera}.` : 'W cenie zakwaterowanie, wyżywienie i cały program z native speakerami.'} Czy chce Pan/Pani poznać cenę?`,
          nextStep: 3,
          offerUsed: offer,
        };
      }
      // Default — podaj cenę (klient prawdopodobnie potwierdził zainteresowanie)
      return {
        text: `${priceLine} ${terminyLine} Mamy też raty 0% i zniżki dla powracających uczestników. Czy wysłać szczegóły mailem?`,
        nextStep: 4,
        offerUsed: offer,
      };
    }

    // ══ STEP 4: Rezerwacja lub wysyłka maila ══
    // Cel: klient gotowy → rezerwacja lub mail. Niezdecydowany → mail + follow-up.
    case 4: {
      const offer = pickOfferFromConversation(customerSaid, state.history) || pickOfferForDestination(lead.preferred_destination);
      const primaryEmail = (lead.email || '').trim();

      if (customerSaid.includes('tak') || customerSaid.includes('chętnie') || customerSaid.includes('wyślij') || customerSaid.includes('poproszę') || customerSaid.includes('link') || customerSaid.includes('mail')) {
        return {
          text: `Świetnie! Mam w systemie adres: ${primaryEmail}. Czy jest aktualny, czy wolą Państwo podać inny?`,
          nextStep: 5,
          offerUsed: offer,
        };
      }
      if (customerSaid.includes('nie') || customerSaid.includes('rezygnuję') || customerSaid.includes('dzięki')) {
        return {
          text: 'Rozumiem. Może inna opcja by lepiej pasowała? Mamy programy w Polsce, na Malcie i w Anglii. Czy chciałby Pan/Pani, żebym wysłała porównanie mailem?',
          nextStep: 4,
          offerUsed: offer,
        };
      }
      if (customerSaid.includes('drogo') || customerSaid.includes('dużo') || customerSaid.includes('tanio') || customerSaid.includes('budżet')) {
        return {
          text: 'Rozumiem. Mamy raty 0% od 2 do 5 rat. A przy ponownym uczestnictwie zniżka 150 złotych. Mogę wysłać szczegóły finansowe mailem — chciałby Pan/Pani?',
          nextStep: 4,
          offerUsed: offer,
        };
      }
      if (customerSaid.includes('pomyśl') || customerSaid.includes('zastanow') || customerSaid.includes('porozmaw')) {
        return {
          text: `Oczywiście! Mogę wysłać wszystkie informacje na maila, żeby mogli Państwo spokojnie przejrzeć. Mam adres: ${primaryEmail}. Wyślę i umówimy się na telefon np. za kilka dni?`,
          nextStep: 5,
          offerUsed: offer,
        };
      }
      // Fallback
      return {
        text: `Mogę wysłać pełne szczegóły i link do zapisu mailem — bez zobowiązań. Czy chciałby Pan/Pani to otrzymać?`,
        nextStep: 4,
        offerUsed: offer,
      };
    }

    // ══ STEP 5: Zamknięcie + follow-up ══
    // Cel: potwierdzić email, wysłać, pożegnać, zostawić otwarte drzwi
    case 5: {
      const offer = pickOfferFromConversation(customerSaid, state.history) || pickOfferForDestination(lead.preferred_destination);
      const primaryEmail = (lead.email || '').trim();
      const emailRegex = /([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i;
      const match = (state.customerResponse || '').match(emailRegex);
      const secondaryEmail = match && match[1] ? match[1].trim() : '';
      const hasSecondary = secondaryEmail && secondaryEmail.toLowerCase() !== primaryEmail.toLowerCase();

      const confirmed = customerSaid.includes('tak') || customerSaid.includes('zgadza') || customerSaid.includes('dobry') || customerSaid.includes('ok') || customerSaid.includes('aktualny');
      const denied = customerSaid.includes('nie') || customerSaid.includes('zły') || customerSaid.includes('nieaktual') || customerSaid.includes('inny');

      if (denied && !hasSecondary) {
        return {
          text: 'Proszę podać adres email, na który mam wysłać szczegóły.',
          nextStep: 5,
        };
      }

      if (hasSecondary) {
        return {
          text: `Dziękuję! Wyślę podsumowanie na ${secondaryEmail}. Gdyby były pytania — proszę śmiało dzwonić na ten numer. Miłego dnia!`,
          nextStep: 99,
          outcome: 'Email Summary Sent (Simulated)',
          offerUsed: offer || null,
          emailSecondary: secondaryEmail,
        };
      }

      if (confirmed) {
        return {
          text: `Doskonale! Wyślę wszystko na ${primaryEmail}. Gdyby mieli Państwo pytania — proszę dzwonić. Dziękuję za rozmowę i miłego dnia!`,
          nextStep: 99,
          outcome: 'Email Summary Sent (Simulated)',
          offerUsed: offer || null,
          emailSecondary: null,
        };
      }

      return {
        text: `Mam adres ${primaryEmail}. Czy jest aktualny?`,
        nextStep: 5,
        offerUsed: offer || null,
      };
    }

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
