/**
 * Single source of truth for conversation flows per scenario type.
 * Used by conversation.ts (logic) and scenarios.tsx (display).
 * Each leadType maps to a specific scenario.
 */

export interface FlowStep {
  step: number;
  icon: string;
  title: string;
  goal: string;
  exampleScript: string;
  possibleOutcomes: string[];
}

export interface ObjectionHandler {
  trigger: string;
  response: string;
  category: 'timing' | 'price' | 'interest' | 'child' | 'unknown';
}

export interface ScenarioDefinition {
  id: string;
  leadType: string;
  name: string;
  description: string;
  targetGroup: string;
  steps: FlowStep[];
  objections: ObjectionHandler[];
}

// ── Re-engagement Paści ──
const pastiScenario: ScenarioDefinition = {
  id: 'reengagement-pasti',
  leadType: 'pasti',
  name: 'Re-engagement Paści',
  description: 'Reaktywacja klientów powracających — identyfikacja programu + wysyłka linka mailem',
  targetGroup: 'Rodzice dzieci które już uczestniczyły w programach Angloville',
  steps: [
    {
      step: 0,
      icon: '👋',
      title: 'Powitanie + identyfikacja',
      goal: 'Potwierdzić tożsamość rozmówcy (rodzic dziecka). Ciepły, profesjonalny ton.',
      exampleScript: 'Dzień dobry, czy rozmawiam z rodzicem [dziecka]? Dzwonię z Angloville, mam na imię [agent].',
      possibleOutcomes: ['Potwierdzenie → krok 2', 'Nie ma czasu → propozycja callback'],
    },
    {
      step: 1,
      icon: '📋',
      title: 'Informacja o nagrywaniu + nawiązanie',
      goal: 'Poinformować o nagrywaniu. Nawiązać do uczestnictwa dziecka.',
      exampleScript: 'Informuję, że rozmowa jest nagrywana. Dzwonię, bo widzę, że Państwa dziecko uczestniczyło wcześniej w naszych programach.',
      possibleOutcomes: ['Kontynuacja → krok 3'],
    },
    {
      step: 2,
      icon: '🔗',
      title: 'Przypomnienie programu + opinia',
      goal: 'Zapytać o wrażenia z ostatniego programu. Budować relację.',
      exampleScript: 'Widzę, że ostatnio byli Państwo na programie [ostatni program]. Czy dziecku się podobało?',
      possibleOutcomes: ['Podobało się → propozycja nowego', 'Średnio → pytanie o preferencje'],
    },
    {
      step: 3,
      icon: '💡',
      title: 'Propozycja programu 2026',
      goal: 'Zaproponować dopasowany program z bazy wiedzy. Brak danych → obiecać mail.',
      exampleScript: 'Czy byliby Państwo zainteresowani wyjazdem na sezon 2026? Wstępnie pasuje [program]. Jeśli czegoś nie mam w bazie, sprawdzę i wrócę mailowo.',
      possibleOutcomes: ['Zainteresowany → szczegóły', 'Nie → alternatywy', 'Neutralny → prezentacja oferty'],
    },
    {
      step: 4,
      icon: '🏷️',
      title: 'Szczegóły oferty + potwierdzenie maila',
      goal: 'Podać cenę/ratio/terminy TYLKO z bazy. Potwierdzić email. Brak danych → "sprawdzę mailowo".',
      exampleScript: 'Cena Early Bird to [cena]. Proporcja NS: [ratio]. Wyślę szczegóły mailem — mam adres: [email]. Poprawny?',
      possibleOutcomes: ['Potwierdza email → wysyłka', 'Podaje inny → dodanie CC', 'Odmawia → alternatywa'],
    },
    {
      step: 5,
      icon: '📧',
      title: 'Wysyłka maila + zamknięcie',
      goal: 'Wysłać podsumowanie z linkiem. Nigdy nie nadpisywać primary email.',
      exampleScript: 'Wyślę podsumowanie na [email]. Dziękuję za rozmowę!',
      possibleOutcomes: ['Email wysłany → koniec', 'Potrzeba potwierdzenia → ponowne pytanie'],
    },
    {
      step: 6,
      icon: '🔄',
      title: 'Alternatywna propozycja',
      goal: 'Druga szansa — zapytać o inny kierunek/format.',
      exampleScript: 'Polska czy zagranica (Malta/UK)? Sprawdzę warianty i wrócę mailowo.',
      possibleOutcomes: ['Zainteresowany → mail z propozycją', 'Nie → grzeczne pożegnanie'],
    },
  ],
  objections: [
    { trigger: 'Jeszcze nie wiem / muszę pomyśleć', response: 'Early Bird kończy się [data] — mogę wysłać link, żeby mieli Państwo czas się zapoznać?', category: 'timing' },
    { trigger: 'W tym roku chyba nie', response: 'Czy jest coś co mogłoby zmienić zdanie? Może inna destynacja lub termin?', category: 'interest' },
    { trigger: 'Za drogo', response: 'Mamy raty 0% do 6 rat. Mogę wysłać szczegóły?', category: 'price' },
    { trigger: 'Dziecko nie chce', response: 'Co się zmieniło? Może inna forma — np. [alternatywny program]?', category: 'child' },
    { trigger: 'Nieznana obiekcja', response: '2 próby wyjaśnienia, potem eskalacja do konsultanta.', category: 'unknown' },
  ],
};

// Nowe typy scenariuszy dodawaj tutaj — pojawią się automatycznie w UI.

/** All scenarios */
export const scenarios: ScenarioDefinition[] = [pastiScenario];

/** Get scenario by lead type */
export function getScenarioForLead(leadType: string): ScenarioDefinition {
  return scenarios.find(s => s.leadType === leadType) || pastiScenario;
}

/** Get scenario by id */
export function getScenario(id: string): ScenarioDefinition | undefined {
  return scenarios.find(s => s.id === id);
}
