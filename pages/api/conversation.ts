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

function pickOfferFromConversation(customerSaid: string, history: Array<{ speaker: string; text: string }>): OfferFacts | null {
  // Analyze the FULL conversation to detect what the customer wants
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

  // Detect destination preference
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
  if (allCustomerText.includes('polsk') || allCustomerText.includes('w kraju')) {
    const p = pick(p => (p.name || '') === 'Angloville Junior' && (p.wariant || '').toLowerCase().includes('wakacje'))
      || pick(p => (p.name || '') === 'Angloville Junior');
    if (p) return buildOfferFacts(p, 'Angloville Junior (Polska)');
  }

  return null; // not enough info yet
}

function getAgentResponse(state: ConversationState): { text: string; nextStep: number; outcome?: string; offerUsed?: OfferFacts | null; emailSecondary?: string | null } {
  const lead = state.leadData;
  const customerSaid = (state.customerResponse || '').toLowerCase();
  const parentName = lead.first_name;
  const childName = lead.childName || lead.first_name;
  const childGenitive = genitive(childName);
  const lastProgram = lead.past_programs[lead.past_programs.length - 1];

  switch (state.step) {
    // ── STEP 0: Powitanie ──
    case 0:
      return {
        text: `Dzień dobry, czy rozmawiam z rodzicem ${childGenitive}? Z tej strony ${state.voice || 'Karolina'}, firma Angloville. Ma Pan/Pani chwilę na rozmowę?`,
        nextStep: 1,
      };

    // ── STEP 1: Nawiązanie do historii ──
    case 1:
      if (customerSaid.includes('nie') && (customerSaid.includes('czas') || customerSaid.includes('mogę') || customerSaid.includes('teraz'))) {
        return {
          text: 'Rozumiem, przepraszam za kłopot. Kiedy mogłabym zadzwonić ponownie?',
          nextStep: 99,
          outcome: 'Callback Requested',
        };
      }
      return {
        text: `Dzwonię, ponieważ widzę, że ${childName} uczestniczył wcześniej w naszych programach — ostatnio na ${lastProgram}. Czy dziecku się podobało?`,
        nextStep: 2,
      };

    // ── STEP 2: Opinia + przejście do badania potrzeb ──
    case 2:
      if (!customerSaid.trim()) {
        return {
          text: `Czy dziecku się podobało na programie ${lastProgram}?`,
          nextStep: 2,
        };
      }
      if (customerSaid.includes('tak') || customerSaid.includes('super') || customerSaid.includes('podobało') || customerSaid.includes('fajnie') || customerSaid.includes('dobrze')) {
        return {
          text: 'To fantastycznie! Mamy kilka opcji na sezon 2026. Proszę powiedzieć — szukają Państwo czegoś w Polsce, czy może za granicą?',
          nextStep: 3,
        };
      }
      if (customerSaid.includes('nie') || customerSaid.includes('średnio') || customerSaid.includes('słab')) {
        return {
          text: 'Rozumiem. Czy mogę zapytać, co można byłoby poprawić? I czy mimo to rozważaliby Państwo inną opcję na 2026?',
          nextStep: 3,
        };
      }
      // Neutral / unclear
      return {
        text: 'Rozumiem. Na sezon 2026 mamy kilka nowych opcji. Czy interesuje Państwa wyjazd w Polsce, czy raczej za granicą?',
        nextStep: 3,
      };

    // ── STEP 3: Badanie potrzeb (kierunek, wiek, typ) ──
    case 3: {
      // Try to match a product from what they said
      const offer = pickOfferFromConversation(customerSaid, state.history);

      if (offer) {
        // We found a match! Present the program
        const priceLine = buildPriceLine(offer);
        const ratioLine = offer.ratio ? `Na ${offer.label} stosunek native speakerów do uczestników to ${offer.ratio}.` : '';
        return {
          text: `Na podstawie tego co Pan/Pani mówi, polecałabym ${offer.label}. ${ratioLine} ${priceLine} Czy chciałby Pan/Pani usłyszeć więcej szczegółów?`,
          nextStep: 4,
          offerUsed: offer,
        };
      }

      // Not enough info — ask more specific questions
      if (customerSaid.includes('polsk') || customerSaid.includes('w kraju')) {
        return {
          text: 'W Polsce mamy opcję językową tradycyjną i narciarsko-językową. Ile lat ma dziecko? I czy interesują Państwa narty?',
          nextStep: 3,
        };
      }
      if (customerSaid.includes('zagrani') || customerSaid.includes('za granic')) {
        return {
          text: 'Za granicą mamy Maltę i Anglię. Malta to tygodniowy program z native speakerami w słonecznym klimacie, a Anglia to wyjazd autokarem z zakwaterowaniem u rodzin. Która opcja brzmi ciekawiej?',
          nextStep: 3,
        };
      }
      // General follow-up
      return {
        text: 'Żeby dobrze dopasować — ile lat ma dziecko i czy szukają Państwo wyjazdu językowego w Polsce, czy może czegoś za granicą?',
        nextStep: 3,
      };
    }

    // ── STEP 4: Szczegóły dopasowanego programu ──
    case 4: {
      const offer = pickOfferFromConversation(customerSaid, state.history);
      // Use the best offer we have (from this or previous step)
      const bestOffer = offer || pickOfferForDestination(lead.preferred_destination);

      if (!bestOffer) {
        return {
          text: 'Niestety nie mam jeszcze wystarczających danych żeby dopasować program. Czy mogę dopytać — Polska czy zagranica? I w jakim wieku jest dziecko?',
          nextStep: 3,
          offerUsed: null,
        };
      }

      const priceLine = buildPriceLine(bestOffer);
      const ratioLine = bestOffer.ratio ? `Stosunek native speakerów do uczestników: ${bestOffer.ratio}.` : '';
      const terminyLine = bestOffer.terminy ? `Terminy: ${bestOffer.terminy}.` : '';
      const coZawieraLine = bestOffer.coZawiera ? `W cenie: ${bestOffer.coZawiera}.` : '';

      if (customerSaid.includes('tak') || customerSaid.includes('chętnie') || customerSaid.includes('opowiedz') || customerSaid.includes('więcej') || customerSaid.includes('interesuje')) {
        return {
          text: `${bestOffer.label}: ${priceLine} ${ratioLine} ${terminyLine} ${coZawieraLine} Mamy jeszcze raty 0% od 2 do 5 rat. Czy chciałaby Pani, żebym wysłała szczegóły i link mailem?`,
          nextStep: 5,
          offerUsed: bestOffer,
        };
      }
      if (customerSaid.includes('nie') || customerSaid.includes('drogo') || customerSaid.includes('tani')) {
        return {
          text: 'Rozumiem. Mamy raty 0% do 5 rat, a przy ponownym uczestnictwie jest zniżka 150 złotych. Czy to zmienia sytuację? A może wolą Państwo inny kierunek?',
          nextStep: 4,
          offerUsed: bestOffer,
        };
      }
      // Default: present offer
      return {
        text: `Proponuję ${bestOffer.label}. ${priceLine} ${ratioLine} To program ${bestOffer.wariant || 'tygodniowy'}, gdzie nauka odbywa się przez zabawę z native speakerami. Czy brzmi to interesująco?`,
        nextStep: 5,
        offerUsed: bestOffer,
      };
    }

    // ── STEP 5: Potwierdzenie emaila ──
    case 5: {
      const offer = pickOfferFromConversation(customerSaid, state.history) || pickOfferForDestination(lead.preferred_destination);
      const primaryEmail = (lead.email || '').trim();

      if (customerSaid.includes('nie') || customerSaid.includes('dzięki') || customerSaid.includes('rezygnuję')) {
        return {
          text: 'Rozumiem. Czy mogę zapytać — co by Państwa bardziej zainteresowało? Może inna destynacja albo inny termin?',
          nextStep: 7,
          offerUsed: offer,
        };
      }

      if (customerSaid.includes('tak') || customerSaid.includes('chętnie') || customerSaid.includes('wyślij') || customerSaid.includes('poproszę') || customerSaid.includes('mail')) {
        return {
          text: `Świetnie! Mam w systemie adres: ${primaryEmail}. Czy jest aktualny, czy wolą Państwo podać inny?`,
          nextStep: 6,
          offerUsed: offer,
        };
      }

      // Unclear
      return {
        text: `Mogę wysłać pełne szczegóły i link do zapisu mailem. Czy chciałby Pan/Pani to otrzymać?`,
        nextStep: 5,
        offerUsed: offer,
      };
    }

    // ── STEP 6: Email confirmation + send ──
    case 6: {
      const offer = pickOfferFromConversation(customerSaid, state.history) || pickOfferForDestination(lead.preferred_destination);
      const primaryEmail = (lead.email || '').trim();
      const emailRegex = /([a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,})/i;
      const match = (state.customerResponse || '').match(emailRegex);
      const secondaryEmail = match && match[1] ? match[1].trim() : '';
      const hasSecondary = secondaryEmail && secondaryEmail.toLowerCase() !== primaryEmail.toLowerCase();

      const confirmed = customerSaid.includes('tak') || customerSaid.includes('zgadza') || customerSaid.includes('popraw') || customerSaid.includes('dobry') || customerSaid.includes('ok') || customerSaid.includes('aktualny');
      const denied = customerSaid.includes('nie') || customerSaid.includes('zły') || customerSaid.includes('nieaktual') || customerSaid.includes('inny');

      if (denied && !hasSecondary) {
        return {
          text: `Proszę podać adres email, na który mam wysłać szczegóły.`,
          nextStep: 6,
        };
      }

      if (hasSecondary) {
        return {
          text: `Dziękuję! Wyślę podsumowanie na ${secondaryEmail}. Gdyby były jakieś pytania — proszę śmiało dzwonić na ten numer. Miłego dnia!`,
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
        nextStep: 6,
        offerUsed: offer || null,
      };
    }

    // ── STEP 7: Alternatywa / ostatnia szansa ──
    case 7:
      if (customerSaid.includes('tak') || customerSaid.includes('malta') || customerSaid.includes('anglia') || customerSaid.includes('polska') || customerSaid.includes('narci')) {
        return {
          text: 'Świetnie! Sprawdzę dostępne warianty i wyślę informacje mailem. Czy mogę potwierdzić adres email?',
          nextStep: 6,
        };
      }
      return {
        text: 'Rozumiem. Dziękuję za poświęcony czas. Gdyby zmienili Państwo zdanie — zapraszam na angloville.pl lub proszę oddzwonić na ten numer. Miłego dnia!',
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
