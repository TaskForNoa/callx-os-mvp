/**
 * Single source of truth for conversation flows per scenario type.
 * Used by conversation.ts (logic) and scenarios.tsx (display).
 *
 * UPDATED 2026-02-16 based on analysis of 6 real Karolina conversations.
 */

export interface FlowStep {
  step: number;
  icon: string;
  title: string;
  goal: string;
  exampleScript: string;
  possibleOutcomes: string[];
  realExamples?: string[];  // Actual phrases from Karolina's calls
}

export interface ObjectionHandler {
  trigger: string;
  response: string;
  category: 'timing' | 'price' | 'interest' | 'child' | 'availability' | 'unknown';
  realExample?: string;
}

export interface ScenarioDefinition {
  id: string;
  leadType: string;
  name: string;
  description: string;
  targetGroup: string;
  steps: FlowStep[];
  objections: ObjectionHandler[];
  notes?: string[];
  basedOnCalls?: number;
  lastUpdated?: string;
}

// ── Re-engagement Paści ──
// Based on 6 real Karolina calls (Dec 2023)
const pastiScenario: ScenarioDefinition = {
  id: 'reengagement-pasti',
  leadType: 'pasti',
  name: 'Re-engagement Paści',
  description: 'Kontakt z osobami które wykazały zainteresowanie lub uczestniczyły wcześniej — dopasowanie programu + rezerwacja lub wysyłka info mailem',
  targetGroup: 'Rodzice zainteresowani obozami językowymi (formularz, SMS, powracający klienci)',
  basedOnCalls: 6,
  lastUpdated: '2026-02-16',
  steps: [
    {
      step: 0,
      icon: '👋',
      title: 'Powitanie + identyfikacja',
      goal: 'Przedstawić się, potwierdzić tożsamość, zapytać o dostępność na rozmowę.',
      exampleScript: 'Dzień dobry [Pani/Panie] [imię], z tej strony [agent] firma Angloville, programy językowe. Ma [Pan/Pani] teraz chwilę na rozmowę?',
      possibleOutcomes: ['Ma czas → krok 2', 'Nie ma czasu → umówienie callback'],
      realExamples: [
        'Dzień dobry pani Beato, z tej strony Karolina firma Angloville.',
        'Dzień dobry pani Aniu. Z tej strony Karolina firma Angloville, programy językowe. Pisałam do pani SMS-a w sprawie rozmowy.',
        'Kontaktuje się z panią, ponieważ wykazała pani zainteresowanie naszą ofertą.',
      ],
    },
    {
      step: 1,
      icon: '🔍',
      title: 'Rozpoznanie potrzeb',
      goal: 'Ustalić kluczowe dane: dla kogo (dziecko/dorosły), wiek, województwo, poziom języka, preferencje (językowy vs narciarski, Polska vs zagranica).',
      exampleScript: 'Szuka [Pan/Pani] czegoś dla siebie czy dla dziecka? W jakim wieku? Z jakiego jesteście województwa? Jak dziecko radzi sobie z angielskim?',
      possibleOutcomes: ['Jasne potrzeby → dopasowanie programu', 'Klient sam mówi co go interesuje → przejście do oferty'],
      realExamples: [
        'A proszę powiedzieć, szuka pani czegoś dla siebie czy dla dziecka?',
        'A w jakim wieku są dzieci? (...) I z jakiego jesteście województwa?',
        'Jak dzieciaki radzą sobie z językiem angielskim?',
        'Opcja narciarska panią interesuje?',
      ],
    },
    {
      step: 2,
      icon: '📖',
      title: 'Prezentacja programu',
      goal: 'Opisać format programu dopasowanego do potrzeb. Kluczowe info: struktura (40 uczestników + 20 NS), stosunek 2:1 (native speakerów do uczestników), sesje językowe, animacje, czas trwania. NIE podawać jeszcze ceny — najpierw zaangażować opisem.',
      exampleScript: 'Nasze programy to wyjazdy, gdzie do grupy 40 polskich uczestników dołącza 20 native speakerów. Nauka odbywa się przez zabawę — sesje 2 na 1, karaoke, talent show, tańce szkockie. Cały tydzień, 70h zanurzenia w angielskim.',
      possibleOutcomes: ['Zainteresowany → pytanie o cenę', 'Pytania szczegółowe → odpowiedzi', 'Zna już → przejście do ceny'],
      realExamples: [
        'Do grupy 40 polskich uczestników dołącza 20 native speakerów. Na dwóch polskich uczestników przypada 1 native speaker.',
        'Nauka odbywa się poprzez zabawę, poprzez rozmowę. Bez zeszytów, bez książek.',
        'W ciągu dnia aż 10 godzin, w ciągu całego tygodnia aż 70 godzin takiego pełnego zanurzenia się w języku angielskim.',
        'Organizują karaoke, talent show, tańce szkockie, irlandzkie.',
        'Uczą się angielskiego w taki sam sposób, jak od pani nauczyły się polskiego. Czyli słuchając i naśladując.',
      ],
    },
    {
      step: 3,
      icon: '🏷️',
      title: 'Cena + dostępność',
      goal: 'Podać cenę (z rabatem jeśli dostępny). Podkreślić ograniczoną dostępność ("ostatnie miejsca"). Wspomnieć o ratach 0%. Dopasować wariant (lokalizacja, dojazd).',
      exampleScript: 'Cena to [cena regularna], ale mogę zaproponować [cenę z rabatem]. Mamy raty 0% od 2 do 5. Ostatnie miejsca na ten termin.',
      possibleOutcomes: ['Akceptuje cenę → rezerwacja', 'Za drogo → raty/alternatywa', 'Musi pomyśleć → wysyłka maila'],
      realExamples: [
        'Cena regularna to 3899 złotych. Mogłabym pani zaproponować cenę 3649 złotych.',
        'Te ostatnie miejsca sprzedajemy ze zniżką 250 złotych.',
        'Mamy od 2 do 5 rat. To są raty 0 procent.',
        'Przy dwójce dzieci mogę zaproponować 3549 złotych.',
        'Na pewno dostałaby pani zniżkę 150 złotych za ponowne uczestnictwo.',
      ],
    },
    {
      step: 4,
      icon: '📋',
      title: 'Rezerwacja lub wysyłka maila',
      goal: 'Jeśli klient gotowy — przeprowadzić rezerwację (dane dziecka, dojazd, dieta, raty, ubezpieczenie, pokój). Jeśli musi pomyśleć — wysłać info mailem i umówić follow-up.',
      exampleScript: 'WARIANT A (rezerwacja): "To ja szybciutko przeklikam. Data urodzenia dziecka? Dojazd własny czy z Warszawy? Dieta? Ile rat?" WARIANT B (mail): "To pani wszystko podeślę na maila. Umawiamy się na kontakt w poniedziałek?"',
      possibleOutcomes: ['Rezerwacja zakończona → potwierdzenie', 'Mail wysłany + umówiony follow-up', 'Odmowa → grzeczne pożegnanie'],
      realExamples: [
        'Okej, to ja szybciutko bym to po prostu przeklikała, póki mamy jeszcze te rabaty.',
        'Dojazd własny czy Plac Defilad z Warszawy? Dieta normalna czy wegetariańska?',
        'Na ile rat chciałaby pani płatność? Mamy od 2 do 5.',
        'Ja pani podeślę po prostu taką informację na maila. Umawiamy się na kontakt w poniedziałek.',
        'Wszystko będzie pani miała na skrzynce mailowej.',
      ],
    },
    {
      step: 5,
      icon: '👋',
      title: 'Zamknięcie + follow-up',
      goal: 'Potwierdzić co zostało ustalone. Zostawić otwarte drzwi. Zachęcić do kontaktu.',
      exampleScript: 'Rezerwacja jest na skrzynce mailowej. Gdyby były pytania — proszę dzwonić na ten numer. Dziękuję za rozmowę!',
      possibleOutcomes: ['Zakończono z rezerwacją', 'Zakończono z umówionym callback', 'Zakończono z wysłanym mailem'],
      realExamples: [
        'Gdyby były jakieś pytania, to proszę o kontakt.',
        'Gdyby się coś pojawiło będę dzwoniła, a Państwo będziecie decydować.',
        'Skontaktuję się z panią w przyszłym tygodniu.',
        'Jeśli chodzi o zniżki — najlepiej byłoby jakby pani zadzwoniła z powrotem na ten numer.',
      ],
    },
  ],
  objections: [
    {
      trigger: 'Muszę pomyśleć / porozmawiać z mężem/żoną',
      response: 'Wyślę wszystko mailem — cennik, lokalizacje, harmonogram. Umówmy się na telefon np. w poniedziałek?',
      category: 'timing',
      realExample: 'Możemy się umówić w ten sposób. Ja pani podeślę informację na maila. Umawiamy się na kontakt w poniedziałek.',
    },
    {
      trigger: 'Za drogo / dużo na 7 dni',
      response: 'Mamy raty 0% (2-5 rat). Przy dwójce dzieci mogę zapytać menadżera o dodatkową zniżkę. Powracający klienci mają -150 zł.',
      category: 'price',
      realExample: 'Przy dwójce dzieci mogłabym zapytać menadżera czy możemy zrobić jakiś układ w pani stronę.',
    },
    {
      trigger: 'Opcja narciarska wyprzedana',
      response: 'Mogę zapisać na listę rezerwową. Jeśli się zwolni miejsce — dzwonię. W międzyczasie mogę zaproponować opcję językową.',
      category: 'availability',
      realExample: 'Mogę panią zapisać jako osobę zainteresowaną opcją narciarską. Jeśli cokolwiek się zmieni — będę dzwoniła.',
    },
    {
      trigger: 'Nie mogłam doczytać / strona zagmatwana',
      response: 'Rozumiem. Powiem wszystko w skrócie przez telefon + wyślę podsumowanie mailem.',
      category: 'interest',
      realExample: 'Nie mogłam do niczego dotrzeć, przestałam szukać. → Oczywiście w skrócie pani tutaj wszystko powiem.',
    },
    {
      trigger: 'Chcę usunąć dane / wycofałam zgody',
      response: 'Rozumiem. Czy mogę tylko krótko opowiedzieć o ofercie? Jeśli nie zainteresuje — oczywiście uszanuję.',
      category: 'interest',
      realExample: 'Ja już się wycofałam ze wszystkich zgód. → Bo dla dziecka pani szuka czegoś?',
    },
    {
      trigger: 'Nieznana obiekcja',
      response: '2 próby wyjaśnienia/dopasowania oferty, potem eskalacja do konsultanta.',
      category: 'unknown',
    },
  ],
  notes: [
    'Karolina NIE informuje o nagrywaniu rozmowy (w realnych rozmowach tego nie ma)',
    'Kluczowy trigger zakupowy: ograniczona dostępność ("ostatnie miejsca", "wyprzedane")',
    'Karolina często robi rezerwację ZA klienta przez telefon ("przeklikam") zamiast wysyłać linka',
    'Zniżki: Early Bird, za ponowne uczestnictwo (-150 zł), za rodzeństwo (do negocjacji z menadżerem)',
    'Pytanie o województwo jest ważne — dobiera lokalizację/dojazd',
    'Pytanie o poziom angielskiego dziecka buduje rapport + pozwala dopasować program',
    'Często kończy z umówionym callback zamiast definitywnego zamknięcia',
    'Przekazuje do innego konsultanta sprawy poza zakresem (np. Rok w USA)',
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
