import type { NextApiRequest, NextApiResponse } from 'next';
import leadsData from '../../data/mock-leads.json';
import productsData from '../../data/products-full.json';

// ── Polish name declension — genitive ──
const GENITIVE: Record<string, string> = {
  'Kacper': 'Kacpra', 'Bartek': 'Bartka', 'Filip': 'Filipa', 'Adam': 'Adama',
  'Szymon': 'Szymona', 'Mateusz': 'Mateusza',
  'Zosia': 'Zosi', 'Ola': 'Oli', 'Maja': 'Mai', 'Hania': 'Hani',
  'Julia': 'Julii', 'Alicja': 'Alicji',
  'Jan': 'Jana', 'Anna': 'Anny', 'Piotr': 'Piotra', 'Ewa': 'Ewy',
  'Marek': 'Marka', 'Katarzyna': 'Katarzyny', 'Tomasz': 'Tomasza',
  'Magdalena': 'Magdaleny', 'Michał': 'Michała', 'Agnieszka': 'Agnieszki',
  'Robert': 'Roberta', 'Monika': 'Moniki',
};
function genitive(name: string): string {
  if (GENITIVE[name]) return GENITIVE[name];
  if (name.endsWith('a')) return name.slice(0, -1) + 'y';
  if (name.endsWith('ek')) return name.slice(0, -2) + 'ka';
  return name + 'a';
}

// ── Types ──
type Product = any;

type OfferFacts = {
  productId: string; label: string;
  regular: number | null; early: number | null; savings: number | null;
  ratio?: string; terminy?: string; znizki?: string;
  coZawiera?: string; program?: string; cechy?: string;
  url?: string; wariant?: string;
  terminyDetale?: string; terminyLista?: any[];
  wiekGrupa?: string;
  kategoriaFilter?: string;
  segment?: string;
};

function buildOfferFacts(p: any, label: string): OfferFacts {
  const regular = p?.cenaRegularna ?? null;
  const early = p?.cenaZnizka ?? null;
  return {
    productId: p?.id || p?.name || label, label, regular, early,
    savings: (regular != null && early != null) ? (regular - early) : null,
    ratio: p?.ratio, terminy: p?.terminy, znizki: p?.znizki,
    coZawiera: p?.coZawiera, program: p?.program, cechy: p?.cechy,
    url: p?.url, wariant: p?.wariant,
    terminyDetale: p?.terminyDetale, terminyLista: p?.terminyLista,
    wiekGrupa: p?.wiekGrupa,
    kategoriaFilter: p?.kategoriaFilter,
    segment: p?.segment,
  };
}

// ── Product matching from conversation context ──
function pickOfferFromConversation(allText: string): OfferFacts | null {
  const t = allText.toLowerCase();
  const products = productsData as Product[];
  const pick = (fn: (p: Product) => boolean) => {
    const c = products.filter(fn);
    c.sort((a, b) => (a.cenaZnizka != null ? 0 : 1) - (b.cenaZnizka != null ? 0 : 1));
    return c[0] || null;
  };

  if (t.includes('malta')) {
    const p = pick(p => (p.name || '').includes('Junior International') && (p.name || '').includes('Malta'));
    if (p) return buildOfferFacts(p, 'Junior International – Malta');
  }
  if (t.includes('anglia') || t.includes('uk') || t.includes('londyn')) {
    const p = pick(p => (p.name || '').includes('Junior International') && ((p.name || '').includes('Anglia') || (p.name || '').includes('UK')));
    if (p) return buildOfferFacts(p, p.name || 'Junior International – Anglia');
  }
  if (t.includes('narc') || t.includes('ski') || t.includes('stok')) {
    const p = pick(p => (p.name || '').toLowerCase().includes('ski'));
    if (p) return buildOfferFacts(p, p.name || 'Junior SKI');
  }
  if (t.includes('dorośl') || t.includes('dla siebie') || t.includes('adult')) {
    const p = pick(p => (p.name || '').includes('Adult') || (p.name || '').includes('Angielska Wioska'));
    if (p) return buildOfferFacts(p, p.name || 'Program dla dorosłych');
  }
  if (t.includes('kids') || t.match(/\b[7-9]\s*(lat|rok)/)) {
    const p = pick(p => (p.name || '').includes('Kids'));
    if (p) return buildOfferFacts(p, p.name || 'Angloville Kids');
  }
  if (t.includes('zagrani') || t.includes('za granic')) {
    const p = pick(p => (p.name || '').includes('Junior International') && (p.name || '').includes('Malta'));
    if (p) return buildOfferFacts(p, 'Junior International – Malta');
  }
  if (t.includes('polsk') || t.includes('w kraju') || t.includes('tradycyj') || t.includes('językow')) {
    const p = pick(p => (p.name || '') === 'Angloville Junior' && (p.wariant || '').toLowerCase().includes('wakacje'))
      || pick(p => (p.name || '') === 'Angloville Junior');
    if (p) return buildOfferFacts(p, 'Angloville Junior (Polska)');
  }
  return null;
}

function pickOfferForDestination(dest: string): OfferFacts | null {
  return pickOfferFromConversation(dest);
}

// ── Determine target segment from lead data ──
function getLeadSegment(lead: any): 'junior' | 'kids' | 'adult' | 'unknown' {
  const pastProgs = (lead.past_programs || []).join(' ').toLowerCase();
  if (pastProgs.includes('kids')) return 'kids';
  if (pastProgs.includes('junior') || pastProgs.includes('malta') || pastProgs.includes('anglia') || pastProgs.includes('eurotrip') || pastProgs.includes('uk trip')) return 'junior';
  if (lead.childName) return 'junior'; // has child → default to junior
  if (pastProgs.includes('adult') || pastProgs.includes('wioska') || pastProgs.includes('tandem') || pastProgs.includes('premium')) return 'adult';
  return 'unknown';
}

// ── Filter ALL matching products based on customer choices ──
function filterMatchingProducts(allText: string, lead?: any): { products: OfferFacts[]; filters: string } {
  const t = allText.toLowerCase();
  const products = productsData as Product[];
  const filters: string[] = [];

  let filtered = [...products];

  // Segment filter from lead data (pasti campaign)
  if (lead) {
    const segment = getLeadSegment(lead);
    if (segment === 'junior') {
      filtered = filtered.filter(p => {
        const wg = ((p as any).wiekGrupa || '');
        const n = ((p as any).name || '').toLowerCase();
        return wg === 'Młodzież 11-18' || n.includes('junior') || n.includes('international');
      });
      filters.push('Junior (11-18)');
    } else if (segment === 'kids') {
      filtered = filtered.filter(p => {
        const wg = ((p as any).wiekGrupa || '');
        const n = ((p as any).name || '').toLowerCase();
        return wg === 'Dzieci 7-10' || n.includes('kids');
      });
      filters.push('Kids (7-10)');
    } else if (segment === 'adult') {
      filtered = filtered.filter(p => ((p as any).wiekGrupa || '').includes('Dorośli'));
      filters.push('Dorośli');
    }
  }

  // Destination / branch filter
  const wantsPolska = t.includes('polsk') || t.includes('w kraju');
  const undecidedDest = t.includes('nie jestem zdecyd') || t.includes('jeszcze nie wiem') || t.includes('nie wiem') || t.includes('nie do końca') || t.includes('nie do konca') || t.includes('niekoniecznie');

  const wantsMalta = t.includes('malta') && !wantsPolska && !undecidedDest;
  const wantsAnglia = (t.includes('anglia') || t.includes('londyn') || t.includes('uk trip') || t.includes('wielkiej bryt')) && !wantsPolska && !undecidedDest;
  const wantsZagranica = (t.includes('zagrani') || t.includes('za granic') || wantsMalta || wantsAnglia) && !wantsPolska;

  // If client chose "mocno językowa" right after International vs Plus question,
  // we should stay within "Junior International" branch (Malta/Anglia), not Poland.
  const wantsInternationalBranch = (t.includes('junior international') || (t.includes('mocno') && t.includes('język')) || t.includes('typowo język')) && !wantsPolska;
  const wantsPlusBranch = (t.includes('junior plus') || t.includes('turystycz') || t.includes('objazd')) && !wantsPolska;

  if (wantsPolska) {
    filtered = filtered.filter(p => {
      const k = ((p as any).kategoriaFilter || '').toLowerCase();
      const n = ((p as any).name || '').toLowerCase();
      return (k.includes('polska') || (!n.includes('malta') && !n.includes('anglia') && !n.includes('uk trip') && !n.includes('eurotrip') && !n.includes('baltic') && !n.includes('italy') && !n.includes('nowy jork') && !n.includes('kaliforni') && !n.includes('miami') && !n.includes('japon')));
    });
    filters.push('Polska');
  } else if (wantsZagranica || wantsInternationalBranch || wantsPlusBranch) {
    filtered = filtered.filter(p => {
      const k = ((p as any).kategoriaFilter || '').toLowerCase();
      const n = ((p as any).name || '').toLowerCase();
      return k.includes('zagranica') || k.includes('europa') || k.includes('świat') || n.includes('malta') || n.includes('anglia') || n.includes('uk trip') || n.includes('eurotrip') || n.includes('international') || n.includes('junior plus');
    });
    filters.push('Zagranica');

    if (wantsInternationalBranch) {
      filtered = filtered.filter(p => {
        const n = ((p as any).name || '').toLowerCase();
        return n.includes('junior international') || n.includes('international');
      });
      filters.push('Gałąź: Junior International');
    }
    if (wantsPlusBranch) {
      filtered = filtered.filter(p => {
        const n = ((p as any).name || '').toLowerCase();
        return n.includes('junior plus') || n.includes('uk trip') || n.includes('eurotrip') || n.includes('baltic') || n.includes('italy');
      });
      filters.push('Gałąź: Junior Plus');
    }

    if (wantsMalta) { filtered = filtered.filter(p => ((p as any).name || '').toLowerCase().includes('malta')); filters.push('Malta'); }
    if (wantsAnglia) { filtered = filtered.filter(p => { const n = ((p as any).name || '').toLowerCase(); return n.includes('anglia') || n.includes('uk'); }); filters.push('Anglia/UK'); }
  }

  // Age group filter
  const ageMatch = t.match(/(\d{1,2})\s*(lat|rok|letni)/);
  const age = ageMatch ? parseInt(ageMatch[1]) : null;
  if (age) {
    if (age >= 7 && age <= 10) {
      filtered = filtered.filter(p => (p as any).wiekGrupa === 'Dzieci 7-10' || ((p as any).name || '').includes('Kids'));
      filters.push(`Wiek: ${age} lat (Kids)`);
    } else if (age >= 11 && age <= 18) {
      filtered = filtered.filter(p => (p as any).wiekGrupa === 'Młodzież 11-18' || ((p as any).segment || '').includes('11'));
      filters.push(`Wiek: ${age} lat (Junior)`);
    } else if (age >= 18) {
      filtered = filtered.filter(p => (p as any).wiekGrupa === 'Dorośli 18+');
      filters.push(`Wiek: ${age} lat (Dorosły)`);
    }
  }

  // City filter — check terminyLista
  const cities = ['warszaw', 'kraków', 'krakow', 'poznań', 'poznan', 'wrocław', 'wroclaw', 'katowic', 'gdańsk', 'gdansk', 'łódź', 'lodz'];
  let cityFilter = '';
  for (const c of cities) {
    if (t.includes(c)) { cityFilter = c; break; }
  }
  if (cityFilter) {
    filtered = filtered.filter(p => {
      const tl = (p as any).terminyLista as any[] || [];
      const td = ((p as any).terminyDetale || '').toLowerCase();
      return tl.some((tt: any) => (tt.miastoZbiorki || '').toLowerCase().includes(cityFilter)) || td.includes(cityFilter);
    });
    filters.push(`Wyjazd z: ${cityFilter.charAt(0).toUpperCase() + cityFilter.slice(1)}`);
  }

  // Prioritize "Świat" when customer asks for non-Europe/world
  const wantsWorld = t.includes('poza europ') || t.includes('świat') || t.includes('stany') || t.includes('usa') || t.includes('nowy jork') || t.includes('kaliforni') || t.includes('miami') || t.includes('japon');
  if (wantsWorld) {
    filtered.sort((a: any, b: any) => {
      const ak = String(a.kategoriaFilter || '').toLowerCase();
      const bk = String(b.kategoriaFilter || '').toLowerCase();
      const aw = ak.includes('świat') ? 0 : 1;
      const bw = bk.includes('świat') ? 0 : 1;
      return aw - bw;
    });
    filters.push('Priorytet: Świat');
  }

  // Deduplicate by name+wariant
  const seen = new Set<string>();
  const deduped: OfferFacts[] = [];
  for (const p of filtered) {
    const key = `${(p as any).name}|${(p as any).wariant || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(buildOfferFacts(p, (p as any).name || 'Produkt'));
  }

  return { products: deduped.slice(0, 20), filters: filters.join(' → ') };
}

// ── Step definitions (mirrors scenarioFlow.ts) ──
interface StepDef {
  step: number;
  name: string;
  goal: string;
  rules: string[];
  canRevealPrice: boolean;
  isTerminal?: boolean;
}

const STEPS: StepDef[] = [
  {
    step: 0, name: 'Powitanie',
    goal: 'Przedstaw się jako [voice] z Angloville. Powiedz krótko, że dzwonisz w sprawie wyboru obozu na 2026 dla [childName] (ostatnio: [lastProgram]). Potwierdź tożsamość (rodzic [childGenitive]). Zapytaj czy ma chwilę na rozmowę.',
    rules: [
      'Ciepły, profesjonalny ton',
      'Krótko — max 2 zdania + pytanie',
      'NIE zakładaj preferencji kierunku na 2026 (preferred_destination to tylko wskazówka z CRM)',
      'NIE proponuj jeszcze konkretnego programu ani kierunku',
    ],
    canRevealPrice: false,
  },
  {
    step: 1, name: 'Rozpoznanie potrzeb',
    goal: 'Nawiąż do uczestnictwa dziecka [childName] w programach (ostatnio: [lastProgram]). NIE prezentuj jeszcze żadnego produktu. Twoim celem jest rozstrzygnąć pierwszą oś wyboru: Polska czy zagranica.',
    rules: [
      'NIE mów "dzień dobry" — już się przywitałaś w poprzednim kroku!',
      'Nie podawaj ceny',
      'Nie proponuj jeszcze konkretnego produktu ani kierunku',
      'Zapytaj JEDNO pytanie: czy rozważają Państwo raczej Polskę czy zagranicę',
      'Jeśli klient nie ma czasu → zaproponuj callback i zakończ',
      'Jeśli klient sam mówi co go interesuje → zapamiętaj i przejdź dalej',
    ],
    canRevealPrice: false,
  },
  {
    step: 2, name: 'Prezentacja programu',
    goal: `Pomóż klientowi wybrać konkretny program. Twój cel końcowy: dojść do KONKRETNEGO produktu + termin + hotel, żebyś mogła wysłać link do zapisu.

Prowadź rozmowę naturalnie — zadawaj pytania, które pomagają zawęzić wybór. Jeśli klient nie wie czego chce, zaproponuj na podstawie tego co wiesz o nim (wiek dziecka, poprzednie programy). Jeśli klient wie — nie pytaj o to co już powiedział.

Ogólna logika zawężania (nie sztywna kolejność — dostosuj do rozmowy):
- Polska vs zagranica
- Typ programu (językowy / turystyczny / narciarsko-językowy)
- Miesiąc (lipiec / sierpień / ferie)
- Miasto zbiórki
- Konkretny turnus (termin + hotel)

Patrz na PASUJĄCE PRODUKTY poniżej — to Twoja baza wiedzy. Prezentuj TYLKO produkty z tej listy.`,
    rules: [
      'NIE podawaj ceny — najpierw cechy i wyróżniki. W tym kroku NIE wolno podawać żadnych kwot ani używać „zł”/„PLN”, chyba że klient wprost zapyta o cenę ("ile kosztuje", "jaka cena").',
      'TRZYMAJ SIĘ wyborów klienta — jeśli wybrał Polskę, NIE wracaj do zagranicy; jeśli wybrał "Junior International" (mocno językowy) — NIE proponuj Angloville Junior w Polsce, tylko Malta/Anglia!',
      'Max 2-3 opcje na raz + 1 pytanie',
      'Jeśli klient pyta "co macie" → opisz kategorie krótko, nie szczegóły',
      'Jeśli możesz coś zaproponować na podstawie kontekstu (wiek, poprzedni program) — zrób to',
      'Gdy dojdziesz do konkretnego programu + termin + hotel → zapytaj czy chce poznać cenę lub dostać link do zapisu',
    ],
    canRevealPrice: false,
  },
  {
    step: 3, name: 'Cena i dostępność',
    goal: 'Podaj cenę (Early Bird jeśli jest), raty 0%, zniżki dla powracających. Podkreśl ograniczoną dostępność. Zapytaj czy wysłać szczegóły mailem.',
    rules: [
      'Podawaj cenę TYLKO z bazy wiedzy — jeśli brak → "sprawdzę i wrócę mailowo"',
      'Wspomnij o ratach 0% (2-5 rat)',
      'Wspomnij o zniżce 150 zł dla powracających',
      '"Ostatnie miejsca" — buduj pilność',
    ],
    canRevealPrice: true,
  },
  {
    step: 4, name: 'Rezerwacja lub wysyłka maila',
    goal: 'Jeśli klient chce — potwierdź email i wyślij szczegóły. Jeśli się waha — zaproponuj wysyłkę maila + follow-up za kilka dni.',
    rules: [
      'Mam email klienta: [primaryEmail]',
      'Zapytaj czy email jest aktualny',
      'Nigdy nie nadpisuj primary email — można dodać secondary',
      'Jeśli "za drogo" → raty, zniżki',
      'Jeśli "muszę pomyśleć" → wyślij maila i umów callback',
    ],
    canRevealPrice: true,
  },
  {
    step: 5, name: 'Zamknięcie',
    goal: 'Potwierdź email i wyślij. Pożegnaj się ciepło. Zostaw otwarte drzwi na kontakt.',
    rules: ['Krótko', 'Zachęć do kontaktu telefonicznego', 'Miłego dnia!'],
    canRevealPrice: true,
    isTerminal: true,
  },
];

// ── Extract conversation context (what customer already decided) ──
function extractCustomerContext(allText: string): string {
  const t = allText.toLowerCase();
  const facts: string[] = [];

  // Destination (be careful: mentioning "Malta" in history doesn't always mean the customer chose it)
  const undecided = t.includes('nie jestem zdecyd') || t.includes('jeszcze nie wiem') || t.includes('nie wiem') || t.includes('nie do końca') || t.includes('nie do konca') || t.includes('niekoniecznie') || t.includes('raczej nie');

  if (t.includes('polsk') || t.includes('w kraju')) {
    facts.push('WYBRANO: Polska (NIE wracaj do Malty/Anglii!)');
  } else if (t.includes('malta') && !undecided) {
    facts.push('WYBRANO: Malta (NIE proponuj Polski!)');
  } else if ((t.includes('anglia') || t.includes('londyn') || t.includes('uk')) && !undecided) {
    facts.push('WYBRANO: Anglia/UK (NIE proponuj Polski!)');
  } else if (t.includes('zagrani') || t.includes('za granic')) {
    facts.push('WYBRANO: zagranica (dopytaj: Europa (Malta/Anglia) czy poza Europą)');
  }

  // Season
  if (t.includes('wakacj') || t.includes('lato') || t.includes('lipiec') || t.includes('sierp')) facts.push('SEZON: wakacje (lipiec-sierpień)');
  else if (t.includes('feri') || t.includes('zim') || t.includes('stycz') || t.includes('lut')) facts.push('SEZON: ferie zimowe');

  // Month
  if (t.includes('lipiec') || t.includes('lipc')) facts.push('MIESIĄC: lipiec');
  if (t.includes('sierp')) facts.push('MIESIĄC: sierpień');
  if (t.includes('stycz')) facts.push('MIESIĄC: styczeń');
  if (t.includes('lut')) facts.push('MIESIĄC: luty');

  // City
  if (t.includes('warszaw')) facts.push('MIASTO WYJAZDU: Warszawa');
  if (t.includes('kraków') || t.includes('krakow')) facts.push('MIASTO WYJAZDU: Kraków');
  if (t.includes('poznań') || t.includes('poznan')) facts.push('MIASTO WYJAZDU: Poznań');
  if (t.includes('gdańsk') || t.includes('gdansk')) facts.push('MIASTO WYJAZDU: Gdańsk');
  if (t.includes('wrocław') || t.includes('wroclaw')) facts.push('MIASTO WYJAZDU: Wrocław');
  if (t.includes('katowic')) facts.push('MIASTO WYJAZDU: Katowice');
  if (t.includes('łódź') || t.includes('lodz')) facts.push('MIASTO WYJAZDU: Łódź');

  // Age
  const ageMatch = t.match(/(\d{1,2})\s*(lat|rok|letni)/);
  if (ageMatch) facts.push(`WIEK DZIECKA: ${ageMatch[1]} lat`);

  // Type
  if (t.includes('narc') || t.includes('ski') || t.includes('stok')) facts.push('TYP: narciarsko-językowy');
  if (t.includes('językow') || t.includes('tradycyj')) facts.push('TYP: językowy tradycyjny');

  // Objections/sentiment
  if (t.includes('drogo') || t.includes('dużo')) facts.push('OBIEKCJA: cena za wysoka');
  if (t.includes('pomyśl') || t.includes('zastanow')) facts.push('STATUS: musi się zastanowić');

  return facts.length > 0
    ? '\nCO KLIENT JUŻ USTALIŁ (ZAPAMIĘTAJ — nie wracaj do tematów które już rozstrzygnął!):\n' + facts.map(f => '• ' + f).join('\n')
    : '';
}

// ── LLM call ──
const CALLX_MODEL = process.env.CALLX_CONV_MODEL || 'gpt-5.2';

function customerExplicitlyAskedPrice(text: string): boolean {
  const t = (text || '').toLowerCase();
  return (
    t.includes('ile koszt') ||
    t.includes('jaka cena') ||
    t.includes('jaka jest cena') ||
    t.includes('cena?') ||
    t.match(/\bile\b.*\b(zł|pln)\b/) != null ||
    t.includes('kosztuje') ||
    t.includes('za ile')
  );
}

function stripPricesIfNotAllowed(text: string): string {
  // Remove obvious price mentions. Keep it conservative to avoid mangling normal numbers.
  return (text || '')
    // 12 499 zł / 12499 zł / 12.499 zł
    .replace(/\b\d{1,3}(?:[ .]\d{3})+\s*(zł|pln)\b/gi, '[cena na prośbę]')
    .replace(/\b\d{4,6}\s*(zł|pln)\b/gi, '[cena na prośbę]')
    // "od 17999 zł"
    .replace(/\bod\s*\d{4,6}\s*(zł|pln)\b/gi, 'od [cena na prośbę]');
}

async function callLLM(systemPrompt: string, messages: Array<{role: string; content: string}>): Promise<string> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: CALLX_MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages.filter(m => m.content).map(m => ({ role: m.role, content: m.content || '' })),
      ],
      temperature: 0.4,
      max_completion_tokens: 300,
    }),
  });

  if (!res.ok) {
    const err = await res.text();
    console.error('LLM error:', res.status, err);
    throw new Error(`LLM ${res.status}: ${err.slice(0, 500)}`);
  }

  const data = await res.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}

// ── Determine next step based on conversation ──
function determineNextStep(currentStep: number, customerSaid: string, hasOffer: boolean): { nextStep: number; outcome?: string } {
  const t = customerSaid.toLowerCase();

  switch (currentStep) {
    case 0: return { nextStep: 1 };

    case 1:
      if (t.includes('nie') && (t.includes('czas') || t.includes('mogę') || t.includes('teraz')))
        return { nextStep: 99, outcome: 'Callback Requested' };
      // Customer confirmed availability / answered about past program → move to presentation
      return { nextStep: 2 };  // needs discovery done, move to program presentation

    case 2:
      // Stay on 2 until product is matched AND customer shows interest
      if (!hasOffer) return { nextStep: 2 }; // keep discovering needs
      // Product matched — but only advance if customer wants to hear more/price
      if (t.includes('cenę') || t.includes('ile') || t.includes('kosztuje') || t.includes('tak') || t.includes('chętnie') || t.includes('dalej'))
        return { nextStep: 3 };
      // Customer responded but not explicitly asking for price — present program (stay on 2 to show features first)
      return { nextStep: 2 };

    case 3:
      if (t.includes('tak') || t.includes('wyślij') || t.includes('mail') || t.includes('chętnie') || t.includes('poproszę'))
        return { nextStep: 4 };
      if (t.includes('rezygnuję') || (t.includes('nie') && t.includes('zainteresow')))
        return { nextStep: 99, outcome: 'Not Interested' };
      if (t.includes('drogo') || t.includes('tani'))
        return { nextStep: 3 }; // stay — handle price objection
      return { nextStep: 4 }; // default: move to email

    case 4:
      if (t.includes('tak') || t.includes('wyślij') || t.includes('aktualny') || t.includes('zgadza') || t.includes('ok') || t.includes('dobry'))
        return { nextStep: 5 };
      if (t.includes('rezygnuję') || (t.includes('nie') && t.includes('zainteresow')))
        return { nextStep: 99, outcome: 'Not Interested' };
      return { nextStep: 4 }; // stay, handle objection or get email

    case 5:
      return { nextStep: 99, outcome: 'Email Summary Sent (Simulated)' };

    default: return { nextStep: 99, outcome: 'Completed' };
  }
}

// ── Build system prompt ──
function buildSystemPrompt(
  stepDef: StepDef,
  lead: any,
  offer: OfferFacts | null,
  voiceName: string,
  customerContext?: string,
  matchingProducts?: { products: OfferFacts[]; filters: string },
): string {
  const childName = lead.childName || lead.first_name;
  const childGen = genitive(childName);
  const lastProgram = lead.past_programs?.[lead.past_programs.length - 1] || 'Angloville';

  let productContext = '';

  // Show list of matching products (filtered by customer choices)
  if (matchingProducts && matchingProducts.products.length > 0) {
    productContext = `
PASUJĄCE PRODUKTY Z BAZY WIEDZY (filtry: ${matchingProducts.filters || 'brak'}):
${matchingProducts.products.map((p, i) => {
  let entry = `\n${i + 1}. ${p.label}${p.wariant ? ` (${p.wariant})` : ''}`;
  if (p.wiekGrupa) entry += `\n   Grupa wiekowa: ${p.wiekGrupa}`;
  if (p.kategoriaFilter) entry += `\n   Kategoria: ${p.kategoriaFilter}`;
  if (p.segment) entry += `\n   Segment: ${p.segment}`;
  if (p.ratio) entry += `\n   Stosunek NS: ${p.ratio}`;
  if (p.cechy) entry += `\n   Cechy: ${p.cechy}`;
  if (p.terminy) entry += `\n   Terminy: ${p.terminy}`;
  if (p.terminyLista && p.terminyLista.length > 0) {
    entry += `\n   Dostępne turnusy:`;
    p.terminyLista.slice(0, 5).forEach((t: any) => {
      entry += `\n     • ${t.termin} | ${t.hotel} | z: ${t.miastoZbiorki} | ${t.dostepnosc}`;
    });
    if (p.terminyLista.length > 5) entry += `\n     ... i ${p.terminyLista.length - 5} więcej`;
  }
  if (stepDef.canRevealPrice) {
    if (p.regular) entry += `\n   Cena: ${p.regular} zł`;
    if (p.early) entry += ` (Early Bird: ${p.early} zł)`;
  }
  if (p.url) entry += `\n   URL: ${p.url}`;
  return entry;
}).join('\n')}

WAŻNE: Prezentuj TYLKO produkty z powyższej listy. Jeśli klient wybrał Polskę — przedstaw TYPY programów dostępnych w Polsce. Jeśli wybrał zagranicę — przedstaw co mamy za granicą. NIE wracaj do odrzuconych kierunków!`;
  }

  // Single selected product (when customer narrowed down to one)
  if (offer && (!matchingProducts || matchingProducts.products.length <= 1)) {
    productContext = `
WYBRANY PRODUKT Z BAZY WIEDZY:
- Nazwa: ${offer.label}
- Wariant: ${offer.wariant || 'brak'}
- Stosunek NS do uczestników: ${offer.ratio || 'brak danych'}
- Cechy: ${offer.cechy || 'brak'}
- Program/trasa: ${offer.program || 'brak'}
- Co zawiera cena: ${offer.coZawiera || 'brak'}
- Terminy ogólne: ${offer.terminy || 'brak'}
${offer.terminyDetale ? `- SZCZEGÓŁOWE TERMINY (termin | hotel | miasto wyjazdu):\n${offer.terminyDetale}` : ''}
${offer.terminyLista ? `- DOSTĘPNE TURNUSY:\n${offer.terminyLista.map((t: any) => `  • ${t.termin} | ${t.hotel} | wyjazd z: ${t.miastoZbiorki} | ${t.dostepnosc}`).join('\n')}` : ''}
${stepDef.canRevealPrice ? `- Cena regularna: ${offer.regular ? offer.regular + ' zł' : 'brak'}
- Cena Early Bird: ${offer.early ? offer.early + ' zł' : 'brak'}
- Zniżki: ${offer.znizki || 'brak'}` : '- CENA: NIE PODAWAJ — jeszcze nie pora!'}
- URL: ${offer.url || 'brak'}`;
  }

  return `Jesteś ${voiceName} — konsultantka sprzedażowa Angloville, firmy organizującej obozy językowe dla dzieci, młodzieży i dorosłych.

AKTUALNY KROK: ${stepDef.step} — ${stepDef.name}
CEL: ${stepDef.goal
    .replace('[voice]', voiceName)
    .replace('[childGenitive]', childGen)
    .replace('[childName]', childName)
    .replace('[lastProgram]', lastProgram)
    .replace('[primaryEmail]', lead.email || '')}

ZASADY TEGO KROKU:
${stepDef.rules.map(r => '- ' + r.replace('[primaryEmail]', lead.email || '')).join('\n')}

DANE LEADA:
- Rodzic: ${lead.first_name} ${lead.last_name}
- Dziecko: ${childName} (dopełniacz: ${childGen})
- Ostatni program: ${lastProgram}
- Email: ${lead.email}
- Preferowana destynacja (z CRM, nie zakładaj że aktualna): ${lead.preferred_destination || 'nieznana'}
${(() => {
  const seg = getLeadSegment(lead);
  if (seg === 'junior') return `\n⚠️ KAMPANIA: PASTI JUNIOR (11-18 lat). Rozmowa dotyczy WYŁĄCZNIE programów dla młodzieży dla ${childName}. NIE proponuj Kids, NIE proponuj programów dla dorosłych!`;
  if (seg === 'kids') return `\n⚠️ KAMPANIA: PASTI KIDS (7-10 lat). Rozmowa dotyczy WYŁĄCZNIE programów Kids dla ${childName}. NIE proponuj Junior, NIE proponuj programów dla dorosłych!`;
  if (seg === 'adult') return `\n⚠️ KAMPANIA: PASTI ADULT. Proponuj WYŁĄCZNIE programy dla dorosłych.`;
  return '';
})()}
${productContext}

${customerContext || ''}

BEZWZGLĘDNE ZASADY:
1. Mów po polsku, naturalnie, jak prawdziwa konsultantka telefoniczna.
2. NIGDY nie wymyślaj danych — podawaj TYLKO fakty z bazy wiedzy powyżej.
3. Jeśli brakuje danych (cena/termin/link) LUB klient pyta o coś, czego nie widzisz w PASUJĄCYCH PRODUKTACH → powiedz "nie widzę tego teraz w bazie, sprawdzę i wrócę mailowo".
4. ${stepDef.canRevealPrice ? 'Możesz podać cenę z bazy.' : 'NIE PODAWAJ CENY ani żadnych kwot — najpierw cechy i wyróżniki programu. Cenę podajesz TYLKO gdy klient wprost o nią poprosi.'}
5. Każda wypowiedź MUSI kończyć się pytaniem (chyba że to pożegnanie).
6. Bądź zwięzła — max 2-3 zdania. To rozmowa telefoniczna, nie wykład.
7. NIGDY NIE POWTARZAJ się — nie przedstawiaj się ponownie, nie powtarzaj pytań ani informacji z wcześniejszej części rozmowy. Czytaj historię!
8. Używaj imienia rodzica w formie "Pani [imię]" / "Panie [imię]".
9. Obecny sezon to 2026. Rok w nazwie programu (np. "Junior Malta 2024") to ROK UCZESTNICTWA. Mów: "Kacper był u nas na obozie Junior Malta w dwa tysiące dwudziestym czwartym roku". NIGDY nie mów "w 2024 roku" liczbowo — zawsze słownie: "w dwa tysiące dwudziestym czwartym roku", "w dwa tysiące dwudziestym szóstym roku" itd.
10. Stosunek "1 NS : 2 uczestników" czytaj jako "jeden native speaker na dwóch uczestników".
11. JEDNO PYTANIE NA RAZ. Nigdy nie zadawaj dwóch ani więcej pytań w jednej wypowiedzi. Zadaj jedno pytanie i czekaj na odpowiedź.
12. KONTYNUUJ rozmowę — nie zaczynaj od nowa. Jeśli już się przedstawiłaś, NIE rób tego ponownie.



WZORZEC STYLU (trzymaj się tej konstrukcji i tonu):
"Panie Janie, w dwa tysiące dwudziestym szóstym roku dla młodzieży mamy za granicą dwie formuły: Junior International (Malta albo Anglia — mocno językowo, dużo rozmów z native speakerami) oraz Junior Plus (więcej turystycznie). Która formuła bardziej Panu pasuje dla Kacpra?"

Odpowiedz TYLKO tekstem do powiedzenia — bez oznaczeń, cudzysłowów, prefiksów.`;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { customer_id, step, customerResponse, history, voice } = req.body;
  if (!customer_id) return res.status(400).json({ error: 'customer_id required' });

  const lead = (leadsData as any[]).find(l => l.customer_id === customer_id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });

  const currentStep = step || 0;
  const voiceName = voice || 'Karolina';
  const hist: Array<{speaker: string; text: string}> = history || [];

  // First turn (no customer response yet) → generate for CURRENT step (greeting)
  const isFirstTurn = !customerResponse || !customerResponse.trim();

  // Build CUSTOMER-only conversation text for matching & context (do not use agent text, it can bias filters)
  const allCustomerText = hist
    .filter(h => h.speaker === 'customer')
    .map(h => h.text)
    .concat([customerResponse || ''])
    .join(' ');

  // Extract what customer already decided
  const customerContext = extractCustomerContext(allCustomerText);

  // Try to match product from CUSTOMER conversation.
  // Do NOT force a destination based on lead.preferred_destination once the customer starts exploring alternatives.
  const offer = pickOfferFromConversation(allCustomerText)
    || (isFirstTurn ? pickOfferForDestination(lead.preferred_destination || '') : null);

  // Get ALL matching products based on CUSTOMER choices (for browsing)
  const matchingProducts = filterMatchingProducts(allCustomerText, lead);

  // Get step definition
  const stepDef = STEPS.find(s => s.step === currentStep) || STEPS[STEPS.length - 1];

  // Determine next step (only if customer has spoken)
  let nextStep: number;
  let outcome: string | undefined;
  if (isFirstTurn) {
    // Generate for current step, but tell frontend the next step to use
    // Step 0 first turn → generate greeting, then go to discovery (step 1). Do NOT skip discovery.
    nextStep = currentStep === 0 ? 1 : currentStep;
    outcome = undefined;
  } else {
    const result = determineNextStep(currentStep, customerResponse, !!offer);
    nextStep = result.nextStep;
    outcome = result.outcome;
  }

  // Build LLM messages from history
  const llmMessages = hist.map(h => ({
    role: h.speaker === 'agent' ? 'assistant' as const : 'user' as const,
    content: h.text,
  }));
  if (customerResponse && customerResponse.trim()) {
    llmMessages.push({ role: 'user', content: customerResponse });
  }

  // Generate in the context of the step we are moving into.
  // First turn: generate step 0 greeting. After customer replies: generate for nextStep (e.g. step 1 discovery).
  const generateForStep = isFirstTurn ? currentStep : nextStep;

  // For terminal states (99), generate a proper goodbye
  if (generateForStep === 99 || nextStep === 99) {
    const goodbyePrompt = buildSystemPrompt(
      {
        step: 99, name: 'Pożegnanie',
        goal: 'Pożegnaj się ciepło i profesjonalnie. Jeśli klient nie jest zainteresowany — uszanuj to. Jeśli wysyłamy mail — potwierdź. Zostaw otwarte drzwi.',
        rules: ['Krótko — 1-2 zdania', 'Dziękuj za czas', 'Zaproś do kontaktu w przyszłości', 'Miłego dnia'],
        canRevealPrice: false,
        isTerminal: true,
      },
      lead, offer, voiceName, customerContext,
    );

    let agentText: string;
    try {
      agentText = await callLLM(goodbyePrompt, llmMessages);
    } catch {
      agentText = 'Rozumiem. Dziękuję za poświęcony czas. Gdyby zmienili Państwo zdanie — zapraszam do kontaktu. Miłego dnia!';
    }

    return res.status(200).json({
      agentText, nextStep: 99,
      outcome: outcome || 'Completed',
      isComplete: true,
      offer: offer ? { productId: offer.productId, label: offer.label, regular: offer.regular, early: offer.early, ratio: offer.ratio, terminy: offer.terminy, url: offer.url } : null,
    });
  }

  const genStepDef = STEPS.find(s => s.step === generateForStep) || stepDef;
  const systemPrompt = buildSystemPrompt(genStepDef, lead, offer, voiceName, customerContext, matchingProducts);

  let agentText: string;
  try {
    agentText = await callLLM(systemPrompt, llmMessages);

    // Guardrail: if we're not allowed to reveal price and the customer didn't explicitly ask, strip any leaked prices.
    const askedPrice = customerExplicitlyAskedPrice(customerResponse || '');
    if (!genStepDef.canRevealPrice && !askedPrice) {
      agentText = stripPricesIfNotAllowed(agentText);
    }
  } catch (e: any) {
    // Return error details for debugging
    const errMsg = e?.message || String(e);
    console.error('LLM failed, using fallback:', errMsg);
    agentText = currentStep === 0
      ? `Dzień dobry, czy rozmawiam z rodzicem ${genitive(lead.childName || lead.first_name)}? Z tej strony ${voiceName}, firma Angloville. Ma Pan/Pani chwilę na rozmowę?`
      : 'Przepraszam, mam chwilowy problem techniczny. Czy mogę zadzwonić ponownie?';
    // Temporary: include error in response for debugging
    return res.status(200).json({ agentText, nextStep, error_debug: errMsg, offer: offer ? { productId: offer.productId } : null });
  }

  // Simulated email on closing
  if (nextStep === 99 && (outcome || '').toLowerCase().includes('email')) {
    (globalThis as any).__callx_emails = (globalThis as any).__callx_emails || [];
    (globalThis as any).__callx_emails.push({
      email_id: `email_${Date.now()}`,
      provider: 'simulated',
      from: 'taskfornoa@gmail.com',
      to: lead.email,
      subject: offer ? `Angloville — ${offer.label}` : 'Angloville — szczegóły programu',
      body: `Podsumowanie rozmowy — ${offer?.label || 'program Angloville'}`,
      status: 'sent',
      sent_at: new Date().toISOString(),
    });
  }

  res.status(200).json({
    agentText,
    nextStep,
    outcome: outcome || null,
    isComplete: nextStep === 99,
    offer: offer ? {
      productId: offer.productId, label: offer.label,
      regular: offer.regular, early: offer.early,
      ratio: offer.ratio, terminy: offer.terminy, url: offer.url,
    } : null,
  });
}
