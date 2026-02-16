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
      exampleScript: 'Dzień dobry, czy rozmawiam z rodzicem [dziecka]? Z tej strony [agent], firma Angloville, programy językowe. Ma Pan/Pani teraz chwilę na rozmowę?',
      possibleOutcomes: ['Ma czas → krok 1', 'Nie ma czasu → umówienie callback'],
      realExamples: [
        'Dzień dobry pani Beato, z tej strony Karolina firma Angloville.',
        'Dzień dobry pani Aniu. Z tej strony Karolina firma Angloville, programy językowe.',
        'Kontaktuje się z panią, ponieważ wykazała pani zainteresowanie naszą ofertą.',
      ],
    },
    {
      step: 1,
      icon: '🔍',
      title: 'Rozpoznanie potrzeb',
      goal: 'Nawiązać do uczestnictwa w programach + ustalić preferencje: Polska vs zagranica, wiek dziecka, poziom języka, narty/język.',
      exampleScript: '[Dziecko] uczestniczyło w naszych programach — ostatnio na [program]. Jak się podobało? I czy szukają Państwo czegoś na 2026 — w Polsce, czy za granicą?',
      possibleOutcomes: ['Jasne potrzeby → prezentacja programu', 'Ogólna odpowiedź → dopytanie o szczegóły'],
      realExamples: [
        'A proszę powiedzieć, szuka pani czegoś dla siebie czy dla dziecka?',
        'A w jakim wieku są dzieci? I z jakiego jesteście województwa?',
        'Jak dzieciaki radzą sobie z językiem angielskim?',
        'Opcja narciarska panią interesuje?',
      ],
    },
    {
      step: 2,
      icon: '📖',
      title: 'Prezentacja programu',
      goal: 'Opisać format dopasowanego programu: 40 uczestników + 20 NS, stosunek 2:1, sesje językowe, animacje, 70h zanurzenia. NIE podawać jeszcze ceny — najpierw zaangażować opisem.',
      exampleScript: 'Polecam [program]. To wyjazd, gdzie do grupy 40 polskich uczestników dołącza 20 native speakerów. Na dwóch uczestników przypada jeden NS. Nauka przez zabawę — sesje językowe, karaoke, talent show, tańce irlandzkie. 70 godzin zanurzenia w angielskim. Czy chce Pan/Pani poznać cenę?',
      possibleOutcomes: ['Chce cenę → krok 3', 'Pytania → odpowiedzi', 'Nie pasuje → dopytanie o preferencje'],
      realExamples: [
        'Do grupy 40 polskich uczestników dołącza 20 native speakerów.',
        'Nauka odbywa się poprzez zabawę, bez zeszytów, bez książek.',
        'W ciągu tygodnia aż 70 godzin zanurzenia się w języku angielskim.',
        'Organizują karaoke, talent show, tańce szkockie, irlandzkie.',
      ],
    },
    {
      step: 3,
      icon: '🏷️',
      title: 'Cena + dostępność',
      goal: 'Podać cenę (Early Bird jeśli jest), raty 0%, podkreślić "ostatnie miejsca". Zapytać czy wysłać szczegóły mailem.',
      exampleScript: '[Cena Early Bird] zamiast [cena regularna]. Mamy raty 0% od 2 do 5. Zostały ostatnie miejsca. Czy wysłać szczegóły i link mailem?',
      possibleOutcomes: ['Tak → potwierdzenie emaila', 'Za drogo → raty/zniżki', 'Musi pomyśleć → mail + follow-up'],
      realExamples: [
        'Cena regularna to 3899 złotych. Mogłabym zaproponować 3649 złotych.',
        'Te ostatnie miejsca sprzedajemy ze zniżką 250 złotych.',
        'Mamy od 2 do 5 rat. To są raty 0 procent.',
        'Na pewno dostałaby pani zniżkę 150 złotych za ponowne uczestnictwo.',
      ],
    },
    {
      step: 4,
      icon: '📋',
      title: 'Rezerwacja lub wysyłka maila',
      goal: 'Klient gotowy → potwierdzić email i wysłać szczegóły. Niezdecydowany → wysłać info + umówić follow-up. Za drogo → raty, zniżki.',
      exampleScript: 'WARIANT A: "Mam adres [email]. Czy jest aktualny?" WARIANT B: "Wyślę info na maila. Umówimy się na telefon za kilka dni?"',
      possibleOutcomes: ['Email potwierdzony → wysyłka', 'Musi pomyśleć → mail + callback', 'Odmowa → alternatywa'],
      realExamples: [
        'Ja pani podeślę informację na maila. Umawiamy się na kontakt w poniedziałek.',
        'Wszystko będzie pani miała na skrzynce mailowej.',
        'Dojazd własny czy z Warszawy? Dieta normalna czy wegetariańska?',
      ],
    },
    {
      step: 5,
      icon: '👋',
      title: 'Zamknięcie + follow-up',
      goal: 'Potwierdzić email, wysłać, pożegnać. Zostawić otwarte drzwi.',
      exampleScript: 'Wyślę wszystko na [email]. Gdyby były pytania — proszę dzwonić na ten numer. Dziękuję za rozmowę!',
      possibleOutcomes: ['Zakończono z wysłanym mailem', 'Zakończono z umówionym callback'],
      realExamples: [
        'Gdyby były jakieś pytania, to proszę o kontakt.',
        'Skontaktuję się z panią w przyszłym tygodniu.',
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
