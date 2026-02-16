import type { NextApiRequest, NextApiResponse } from 'next';
import productsData from '../../data/products-full.json';

const regulations = {
  breakdownCeny: [
    { produkt: 'Junior', sezon: 'Lato 2026', kurs: 2699, turystyka: 2000, lacznie: 4699 },
    { produkt: 'Junior', sezon: 'Zima 2026', kurs: 2999, turystyka: 1700, lacznie: 4699 },
    { produkt: 'Kids', sezon: 'Lato 2026', kurs: 2299, turystyka: 2000, lacznie: 4299 },
    { produkt: 'Kids', sezon: 'Zima 2026', kurs: 2499, turystyka: 1800, lacznie: 4299 },
    { produkt: 'Junior SKI', sezon: 'Zima 2026', kurs: 2899, turystyka: 2100, lacznie: 4999 },
    { produkt: 'Family Adult', sezon: 'Lato 2026', kurs: 3499, turystyka: 2000, lacznie: 5499 },
    { produkt: 'Family Kids', sezon: 'Lato 2026', kurs: 2499, turystyka: 2000, lacznie: 4499 },
    { produkt: 'Adult Premium', sezon: '2026', kurs: 6099, turystyka: 2000, lacznie: 8099 },
    { produkt: 'Adult Standard', sezon: '2026', kurs: 3999, turystyka: 2000, lacznie: 5999 },
    { produkt: 'Adult Tandem', sezon: '2026', kurs: 2999, turystyka: 2000, lacznie: 4999 },
  ],
  ratioNS: [
    { produkt: 'Kids (7–11)', ratio: '1 NS : 6 uczestników' },
    { produkt: 'Junior (11–18)', ratio: '1 NS : 2 (sesje 2 na 1)' },
    { produkt: 'Junior SKI', ratio: '1 NS : 2 (sesje 2 na 1)' },
    { produkt: 'Family Adult', ratio: '2 na 1 z NS' },
    { produkt: 'Family Kids', ratio: '3 na 1 + gry/zabawy' },
    { produkt: 'Malta International', ratio: '1 NS : 2 (sesje 2 na 1 i 1 na 1)' },
    { produkt: 'Anglia International', ratio: '1 NS : 2 (formuła 2 na 1)' },
    { produkt: 'UK Trip Standard', ratio: 'BRAK sesji językowych (koordynatorzy NS)' },
    { produkt: 'UK Trip Intensive', ratio: '1 NS : 3 uczestników' },
    { produkt: 'Eurotrip Standard', ratio: 'BRAK sesji językowych' },
    { produkt: 'Eurotrip Intensive', ratio: '1 NS : 3' },
    { produkt: 'Baltic/Italy Trip', ratio: 'BRAK sesji językowych (koordynatorzy NS)' },
    { produkt: 'Tripy światowe (młodzież)', ratio: 'Koordynatorzy NS + kierownik PL' },
    { produkt: 'Adult Premium/Standard', ratio: '1 NS : 1 uczestnik (70h w 6 dni)' },
    { produkt: 'Adult Tandem', ratio: '1 NS : 2 uczestników (70h w 6 dni)' },
    { produkt: 'Tripy 40+', ratio: 'Pilot PL + pilot EN, program dwujęzyczny' },
    { produkt: 'Tripy 18–40', ratio: 'Koordynatorzy NS, grupa międzynarodowa' },
  ],
  ubezpieczenie: {
    polska: 'Signal Iduna — KL 20 000 EUR + NNW 20 000 PLN',
    zagranica: 'Signal Iduna — KL 20 000 EUR + NNW 15 000 EUR',
    opcjonalne: 'Ubezpieczenie od kosztów rezygnacji 100% (Signal Iduna)',
  },
  rezygnacjaKursPL: [
    { termin: '>30 dni', koszt: '25%' },
    { termin: '29–22 dni', koszt: '41%' },
    { termin: '21–14 dni', koszt: '53%' },
    { termin: '13–7 dni', koszt: '76%' },
    { termin: '6 dni lub mniej', koszt: '92%' },
    { termin: 'W trakcie kursu', koszt: '100%' },
  ],
  rezygnacjaTurystykaPL: [
    { termin: '>28 dni', koszt: '0% (bezpłatne)' },
    { termin: '27–22 dni', koszt: '30%' },
    { termin: '21–14 dni', koszt: '50%' },
    { termin: '13–7 dni', koszt: '70%' },
    { termin: '6–3 dni', koszt: '80%' },
    { termin: '2 dni lub mniej', koszt: '95%' },
    { termin: 'W trakcie', koszt: '100%' },
  ],
  rezygnacjaZagranica: [
    { termin: '>30 dni', koszt: '25%' },
    { termin: '29–21 dni', koszt: '50%' },
    { termin: '20–7 dni', koszt: '70%' },
    { termin: '6–3 dni', koszt: '80%' },
    { termin: '2 dni lub mniej', koszt: '95%' },
    { termin: 'W trakcie', koszt: '100%' },
  ],
  polecenia: {
    opis: 'Polecić można wyłącznie osobę, która nigdy nie była klientem Angloville. Max 2 poleconych/rok. Zniżka polecającego od opłaty turystycznej, poleconego od szkoleniowej. Kwota 300–1200 zł zależnie od programu.',
    maxPoleconych: 2,
    kwota: '300–1 200 zł (zależy od programu)',
  },
  platnosci: {
    metody: 'PayU, tPay, przelew bankowy',
    raty: 'Raty 0% (harmonogram od Organizatora)',
    terminKurs: 'Przy rejestracji lub do 3 dni od potwierdzenia',
    terminTurystykaPL: 'Najpóźniej 14 dni przed rozpoczęciem',
    terminTurystykaZagr: 'Najpóźniej 30 dni przed rozpoczęciem',
    faktury: 'VAT Marża (turystyka), do 15. dnia miesiąca po wpłacie',
  },
  kursOnline: {
    junior: '75 lekcji po 20 min, 5 miesięcy',
    kids: '60 lekcji po 20 min, 5 miesięcy',
    ski: '50 lekcji po 20 min, 5 miesięcy',
  },
  kontakt: {
    tel: '+48 533 655 147',
    email: 'kontakt@angloville.pl',
    rodo: 'rodo@angloville.pl',
    adres: 'Angloville sp. z o.o., ul. Św. Leonarda 1/8, 25-311 Kielce',
    krs: '0000541765',
    nip: '6572916430',
    organizatorTurystyki: '119/15',
  },
};

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    products: productsData,
    regulations,
    meta: {
      totalProducts: productsData.length,
      lastUpdate: '2026-02-16',
      source: 'Excel zestawienie + regulaminy PDF + strony produktowe',
    },
  });
}
