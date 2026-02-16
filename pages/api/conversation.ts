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

// ── Determine target age group from lead data ──
function getLeadAgeGroup(lead: any): 'youth' | 'adult' | 'unknown' {
  const pastProgs = (lead.past_programs || []).join(' ').toLowerCase();
  const childName = lead.childName || '';
  if (childName || pastProgs.includes('junior') || pastProgs.includes('kids') || pastProgs.includes('malta') || pastProgs.includes('anglia')) return 'youth';
  if (pastProgs.includes('adult') || pastProgs.includes('wioska') || pastProgs.includes('tandem') || pastProgs.includes('premium')) return 'adult';
  return 'unknown';
}

// ── Filter ALL matching products based on customer choices ──
function filterMatchingProducts(allText: string, lead?: any): { products: OfferFacts[]; filters: string } {
  const t = allText.toLowerCase();
  const products = productsData as Product[];
  const filters: string[] = [];

  let filtered = [...products];

  // Age group filter from lead data
  if (lead) {
    const ageGroup = getLeadAgeGroup(lead);
    if (ageGroup === 'youth') {
      filtered = filtered.filter(p => {
        const wg = ((p as any).wiekGrupa || '').toLowerCase();
        const n = ((p as any).name || '').toLowerCase();
        return wg.includes('dzieci') || wg.includes('młodzież') || wg === '' || n.includes('junior') || n.includes('kids');
      });
      filters.push('Młodzież/Dzieci');
    } else if (ageGroup === 'adult') {
      filtered = filtered.filter(p => ((p as any).wiekGrupa || '').includes('Dorośli'));
      filters.push('Dorośli');
    }
  }

  // Destination filter
  const wantsPolska = t.includes('polsk') || t.includes('w kraju');
  const wantsMalta = t.includes('malta') && !wantsPolska;
  const wantsAnglia = (t.includes('anglia') || t.includes('londyn') || t.includes('uk trip')) && !wantsPolska;
  const wantsZagranica = (t.includes('zagrani') || t.includes('za granic') || wantsMalta || wantsAnglia) && !wantsPolska;

  if (wantsPolska) {
    filtered = filtered.filter(p => {
      const k = ((p as any).kategoriaFilter || '').toLowerCase();
      const n = ((p as any).name || '').toLowerCase();
      return (k.includes('polska') || (!n.includes('malta') && !n.includes('anglia') && !n.includes('uk trip') && !n.includes('eurotrip') && !n.includes('baltic') && !n.includes('italy') && !n.includes('nowy jork') && !n.includes('kaliforni') && !n.includes('miami') && !n.includes('japon')));
    });
    filters.push('Polska');
  } else if (wantsZagranica) {
    filtered = filtered.filter(p => {
      const k = ((p as any).kategoriaFilter || '').toLowerCase();
      const n = ((p as any).name || '').toLowerCase();
      return k.includes('zagranica') || k.includes('europa') || k.includes('świat') || n.includes('malta') || n.includes('anglia') || n.includes('uk trip') || n.includes('eurotrip') || n.includes('international');
    });
    filters.push('Zagranica');
    if (wantsMalta) { filtered = filtered.filter(p => ((p as any).name || '').toLowerCase().includes('malta')); filters.push('Malta'); }
    if (wantsAnglia) { filtered = filtered.filter(p => { const n = ((p as any).name || '').toLowerCase(); return n.includes('anglia') || n.includes('uk trip'); }); filters.push('Anglia/UK'); }
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

  // Deduplicate by name+wariant
  const seen = new Set<string>();
  const deduped: OfferFacts[] = [];
  for (const p of filtered) {
    const key = `${(p as any).name}|${(p as any).wariant || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(buildOfferFacts(p, (p as any).name || 'Produkt'));
  }

  return { products: deduped.slice(0, 8), filters: filters.join(' → ') };
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
    goal: 'Przedstaw się jako [voice] z Angloville. Potwierdź tożsamość (rodzic [childGenitive]). Zapytaj czy ma chwilę na rozmowę.',
    rules: ['Ciepły, profesjonalny ton', 'Krótko — max 2 zdania + pytanie'],
    canRevealPrice: false,
  },
  {
    step: 1, name: 'Rozpoznanie potrzeb',
    goal: 'Nawiąż do uczestnictwa dziecka [childName] w programach (ostatnio: [lastProgram]). Zapytaj jak się podobało. NIE prezentuj jeszcze żadnego produktu.',
    rules: [
      'NIE mów "dzień dobry" — już się przywitałaś w poprzednim kroku!',
      'Nie podawaj ceny',
      'Nie proponuj jeszcze konkretnego produktu ani kierunku',
      'Zapytaj JEDNO pytanie: jak się podobało na ostatnim obozie',
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
      'NIE podawaj ceny — najpierw cechy i wyróżniki',
      'TRZYMAJ SIĘ wyborów klienta — jeśli wybrał Polskę, NIE wracaj do zagranicy!',
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

  // Destination
  if (t.includes('polsk') || t.includes('w kraju')) facts.push('WYBRANO: Polska (NIE wracaj do Malty/Anglii!)');
  else if (t.includes('malta')) facts.push('WYBRANO: Malta (NIE proponuj Polski!)');
  else if (t.includes('anglia') || t.includes('londyn') || t.includes('uk')) facts.push('WYBRANO: Anglia/UK (NIE proponuj Polski!)');
  else if (t.includes('zagrani') || t.includes('za granic')) facts.push('WYBRANO: zagranica (dopytaj: Malta czy Anglia)');

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
      temperature: 0.7,
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
- Preferowana destynacja: ${lead.preferred_destination || 'nieznana'}
${lead.childName ? `
⚠️ TO JEST KAMPANIA DLA MŁODZIEŻY/DZIECI — rozmowa dotyczy WYŁĄCZNIE programów dla ${childName}. NIE proponuj programów dla dorosłych! Wszystkie propozycje muszą dotyczyć obozów dla dzieci/młodzieży.` : ''}
${productContext}

${customerContext || ''}

BEZWZGLĘDNE ZASADY:
1. Mów po polsku, naturalnie, jak prawdziwa konsultantka telefoniczna.
2. NIGDY nie wymyślaj danych — podawaj TYLKO fakty z bazy wiedzy powyżej.
3. Jeśli brakuje danych (cena/termin/link) → powiedz "sprawdzę i wrócę mailowo".
4. ${stepDef.canRevealPrice ? 'Możesz podać cenę z bazy.' : 'NIE PODAWAJ CENY — najpierw cechy i wyróżniki programu.'}
5. Każda wypowiedź MUSI kończyć się pytaniem (chyba że to pożegnanie).
6. Bądź zwięzła — max 2-3 zdania. To rozmowa telefoniczna, nie wykład.
7. NIGDY NIE POWTARZAJ się — nie przedstawiaj się ponownie, nie powtarzaj pytań ani informacji z wcześniejszej części rozmowy. Czytaj historię!
8. Używaj imienia rodzica w formie "Pani [imię]" / "Panie [imię]".
9. Obecny sezon to 2026. Rok w nazwie programu (np. "Junior Malta 2024") to ROK UCZESTNICTWA. Mów: "Kacper był u nas na obozie Junior Malta w dwa tysiące dwudziestym czwartym roku". NIGDY nie mów "w 2024 roku" liczbowo — zawsze słownie: "w dwa tysiące dwudziestym czwartym roku", "w dwa tysiące dwudziestym szóstym roku" itd.
10. Stosunek "1 NS : 2 uczestników" czytaj jako "jeden native speaker na dwóch uczestników".
11. JEDNO PYTANIE NA RAZ. Nigdy nie zadawaj dwóch ani więcej pytań w jednej wypowiedzi. Zadaj jedno pytanie i czekaj na odpowiedź.
12. KONTYNUUJ rozmowę — nie zaczynaj od nowa. Jeśli już się przedstawiłaś, NIE rób tego ponownie.

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

  // Build full conversation text for product matching
  const allCustomerText = hist
    .filter(h => h.speaker === 'customer')
    .map(h => h.text)
    .concat([customerResponse || ''])
    .join(' ');

  // Extract what customer already decided
  const customerContext = extractCustomerContext(allCustomerText);

  // Try to match product from conversation
  const offer = pickOfferFromConversation(allCustomerText) || pickOfferForDestination(lead.preferred_destination || '');

  // Get ALL matching products based on customer choices (for browsing)
  const allConversationText = hist.map(h => h.text).concat([customerResponse || '']).join(' ');
  const matchingProducts = filterMatchingProducts(allConversationText, lead);

  // Get step definition
  const stepDef = STEPS.find(s => s.step === currentStep) || STEPS[STEPS.length - 1];

  // First turn (no customer response yet) → generate for CURRENT step (greeting)
  const isFirstTurn = !customerResponse || !customerResponse.trim();

  // Determine next step (only if customer has spoken)
  let nextStep: number;
  let outcome: string | undefined;
  if (isFirstTurn) {
    // Generate for current step, but tell frontend the next step to use
    // Step 0 first turn → generate greeting, advance to step 1 for next call
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

  // Always generate in the context of CURRENT step.
  // The agent responds within this step, then we advance to nextStep for the next turn.
  const generateForStep = currentStep;

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
