/**
 * Single source of truth for conversation flow.
 * Used by both conversation.ts (logic) and scenarios.tsx (display).
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
  name: string;
  description: string;
  targetGroup: string;
  steps: FlowStep[];
  objections: ObjectionHandler[];
  updatedAt: string;
}

export const reengagementScenario: ScenarioDefinition = {
  id: 'reengagement-pasti',
  name: 'Re-engagement Paści',
  description: 'Reaktywacja klientów powracających — identyfikacja programu + wysyłka linka mailem',
  targetGroup: 'Rodzice dzieci które uczestniczyły w programach Angloville',
  steps: [
    {
      step: 0,
      icon: '👋',
      title: 'Powitanie + identyfikacja',
      goal: 'Potwierdzić tożsamość rozmówcy (rodzic dziecka). Ciepły, profesjonalny ton.',
      exampleScript: 'Dzień dobry, czy rozmawiam z rodzicem [dziecka — dopełniacz]? Dzwonię z Angloville, mam na imię [głos agenta].',
      possibleOutcomes: ['Potwierdzenie → krok 2', 'Nie ma czasu → propozycja callback'],
    },
    {
      step: 1,
      icon: '📋',
      title: 'Informacja o nagrywaniu + nawiązanie',
      goal: 'Poinformować o nagrywaniu. Nawiązać do uczestnictwa dziecka w programach.',
      exampleScript: 'Informuję, że ta rozmowa jest nagrywana w celach jakościowych. Dzwonię, ponieważ widzę, że Państwa dziecko uczestniczyło wcześniej w naszych programach.',
      possibleOutcomes: ['Kontynuacja → krok 3'],
    },
    {
      step: 2,
      icon: '🔗',
      title: 'Przypomnienie programu + opinia',
      goal: 'Zapytać o wrażenia z ostatniego programu. Budować relację.',
      exampleScript: 'Widzę, że ostatnio byli Państwo na programie [ostatni program]. Czy dziecku się podobało?',
      possibleOutcomes: ['Podobało się → propozycja nowego programu', 'Średnio → pytanie o preferencje'],
    },
    {
      step: 3,
      icon: '💡',
      title: 'Propozycja programu na 2026',
      goal: 'Zaproponować dopasowany program z bazy wiedzy. Jeśli brak danych — obiecać mail.',
      exampleScript: 'Czy byliby Państwo zainteresowani wyjazdem na sezon 2026? Wstępnie pasuje [rekomendowany program]. Jeśli czegoś nie mam w bazie, sprawdzę i wrócę mailowo.',
      possibleOutcomes: ['Zainteresowany → szczegóły + email', 'Nie → pytanie o alternatywy', 'Neutralny → przedstawienie oferty'],
    },
    {
      step: 4,
      icon: '🏷️',
      title: 'Szczegóły oferty + potwierdzenie maila',
      goal: 'Podać cenę (Early Bird jeśli jest), ratio NS, terminy — TYLKO z bazy wiedzy. Potwierdzić adres email. Brakujące dane → "sprawdzę i wrócę mailowo".',
      exampleScript: 'Cena Early Bird to [cena EB] zamiast [cena regularna]. Proporcja native speakerów: [ratio]. Wyślę szczegóły mailem. Mam adres: [email]. Czy jest poprawny?',
      possibleOutcomes: ['Potwierdza email → wysyłka', 'Podaje inny email → dodanie jako dodatkowy', 'Odmawia → alternatywna propozycja'],
    },
    {
      step: 5,
      icon: '📧',
      title: 'Wysyłka maila + zamknięcie',
      goal: 'Potwierdzić email, wysłać podsumowanie z linkiem. Nigdy nie nadpisywać primary email — można dodać secondary.',
      exampleScript: 'Wyślę podsumowanie i link na [email]. Jeśli jakiejś informacji brakuje w bazie, sprawdzę i doślę w kolejnym mailu. Dziękuję za rozmowę!',
      possibleOutcomes: ['Email wysłany → koniec', 'Potrzeba potwierdzenia → ponowne pytanie'],
    },
    {
      step: 6,
      icon: '🔄',
      title: 'Alternatywna propozycja (druga szansa)',
      goal: 'Jeśli odmowa na główną ofertę — zapytać o inny kierunek/format.',
      exampleScript: 'Czy woleliby Państwo opcję w Polsce, czy zagraniczną (Malta/UK)? Sprawdzę dostępne warianty i wrócę mailowo.',
      possibleOutcomes: ['Zainteresowany alternatywą → mail', 'Nie zainteresowany → grzeczne pożegnanie'],
    },
  ],
  objections: [
    {
      trigger: 'Jeszcze nie wiem / muszę pomyśleć',
      response: 'Rozumiem. Early Bird kończy się [data] — mogę wysłać link, żeby mieli Państwo czas spokojnie się zapoznać?',
      category: 'timing',
    },
    {
      trigger: 'W tym roku chyba nie',
      response: 'Czy jest coś co mogłoby zmienić zdanie? Może inna destynacja lub termin?',
      category: 'interest',
    },
    {
      trigger: 'Za drogo',
      response: 'Mamy raty 0% do 6 rat. Mogę wysłać szczegóły?',
      category: 'price',
    },
    {
      trigger: 'Dziecko nie chce',
      response: 'Co się zmieniło? Może inna forma — np. [alternatywny program]?',
      category: 'child',
    },
    {
      trigger: 'Nieznana obiekcja',
      response: '2 próby wyjaśnienia, potem eskalacja do konsultanta.',
      category: 'unknown',
    },
  ],
  updatedAt: new Date().toISOString(),
};

/** All scenarios */
export const scenarios: ScenarioDefinition[] = [reengagementScenario];

/** Get scenario by id */
export function getScenario(id: string): ScenarioDefinition | undefined {
  return scenarios.find(s => s.id === id);
}
