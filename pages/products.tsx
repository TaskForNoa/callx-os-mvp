import { useState, useEffect } from 'react';
import productsData from '../data/products-full.json';

interface Product {
  id: string;
  kategoria: string;
  kategoriaFilter: string;
  name: string;
  segment: string;
  wariant: string;
  czasTrwania: string;
  terminy: string;
  cenaRegularna: number | null;
  cenaZnizka: number | null;
  znizki: string;
  cechy: string;
  program: string;
  coZawiera: string;
  url: string;
  ratio: string;
  ubezpieczenie: string;
}

const CATEGORIES = [
  { key: 'Wszystkie', color: 'bg-av-navy' },
  { key: 'Dorośli', color: 'bg-av-blue' },
  { key: 'Młodzież PL', color: 'bg-green-600' },
  { key: 'Zagranica', color: 'bg-purple-600' },
  { key: 'Świat', color: 'bg-av-orange' },
  { key: 'Exchange', color: 'bg-red-600' },
  { key: 'Online', color: 'bg-teal-600' },
  { key: 'Pakiety Pro', color: 'bg-indigo-600' },
];

const CATEGORY_BADGE: Record<string, string> = {
  'Dorośli': 'bg-av-blue/10 text-av-blue border-av-blue/20',
  'Młodzież PL': 'bg-green-50 text-green-700 border-green-200',
  'Zagranica': 'bg-purple-50 text-purple-700 border-purple-200',
  'Świat': 'bg-orange-50 text-av-orange border-orange-200',
  'Exchange': 'bg-red-50 text-red-700 border-red-200',
  'Online': 'bg-teal-50 text-teal-700 border-teal-200',
  'Pakiety Pro': 'bg-indigo-50 text-indigo-700 border-indigo-200',
};

function formatPrice(price: number | null): string {
  if (price === null) return '—';
  return price.toLocaleString('pl-PL') + ' zł';
}

function ProductCard({ product, onEdit }: { product: Product; onEdit: (p: Product) => void }) {
  const [expanded, setExpanded] = useState(false);
  const badge = CATEGORY_BADGE[product.kategoriaFilter] || 'bg-gray-50 text-gray-700 border-gray-200';
  const hasDiscount = product.cenaZnizka !== null && product.cenaRegularna !== null && product.cenaZnizka < product.cenaRegularna;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
      <div className="p-5">
        <div className="flex items-start justify-between gap-2 mb-3">
          <div className="flex-1">
            <span className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full border mb-2 ${badge}`}>
              {product.kategoriaFilter}
            </span>
            <h3 className="text-lg font-bold text-av-navy">{product.name}</h3>
            {product.wariant && (
              <p className="text-sm text-gray-500 mt-0.5">{product.wariant}</p>
            )}
          </div>
          <div className="text-right shrink-0">
            {hasDiscount ? (
              <>
                <div className="text-xs text-gray-400 line-through">{formatPrice(product.cenaRegularna)}</div>
                <div className="text-xl font-bold text-green-600">{formatPrice(product.cenaZnizka)}</div>
              </>
            ) : product.cenaRegularna ? (
              <div className="text-xl font-bold text-av-navy">{formatPrice(product.cenaRegularna)}</div>
            ) : (
              <div className="text-sm text-gray-400 italic">Wycena indywidualna</div>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2 text-xs text-gray-600 mb-3">
          {product.segment && (
            <span className="bg-gray-100 px-2 py-1 rounded">👤 {product.segment}</span>
          )}
          {product.czasTrwania && product.czasTrwania !== 'wg strony' && (
            <span className="bg-gray-100 px-2 py-1 rounded">⏱ {product.czasTrwania}</span>
          )}
          {product.terminy && (
            <span className="bg-gray-100 px-2 py-1 rounded">📅 {product.terminy}</span>
          )}
        </div>

        {product.cechy && (
          <p className="text-sm text-gray-600 line-clamp-2 mb-3">{product.cechy}</p>
        )}

        {product.znizki && (
          <p className="text-xs text-green-700 bg-green-50 rounded px-2 py-1 mb-3">💰 {product.znizki}</p>
        )}

        <div className="flex gap-2">
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-sm text-av-blue hover:text-av-blue-dark font-medium"
          >
            {expanded ? '▲ Zwiń' : '▼ Szczegóły'}
          </button>
          {product.url && (
            <a href={product.url} target="_blank" rel="noopener noreferrer"
              className="text-sm text-gray-400 hover:text-av-blue ml-auto">
              🔗 Strona
            </a>
          )}
        </div>
      </div>

      {expanded && (
        <div className="border-t border-gray-100 px-5 py-4 bg-gray-50/50 space-y-3 text-sm">
          {product.program && (
            <div>
              <span className="font-semibold text-av-navy">Program / wycieczki:</span>
              <p className="text-gray-600 mt-1">{product.program}</p>
            </div>
          )}
          {product.coZawiera && (
            <div>
              <span className="font-semibold text-av-navy">Co zawiera cena:</span>
              <p className="text-gray-600 mt-1">{product.coZawiera}</p>
            </div>
          )}
          {product.ratio && (
            <div>
              <span className="font-semibold text-av-navy">Proporcja NS:</span>
              <span className="text-gray-600 ml-2">{product.ratio}</span>
            </div>
          )}
          {product.ubezpieczenie && (
            <div>
              <span className="font-semibold text-av-navy">Ubezpieczenie:</span>
              <span className="text-gray-600 ml-2">{product.ubezpieczenie}</span>
            </div>
          )}
          <div className="pt-2 flex gap-2">
            <button
              onClick={() => onEdit(product)}
              className="text-xs bg-av-navy text-white px-3 py-1 rounded hover:bg-av-navy/90"
            >
              ✏️ Edytuj lokalnie
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function ProductsPage() {
  const [activeCategory, setActiveCategory] = useState('Wszystkie');
  const [search, setSearch] = useState('');
  const [products, setProducts] = useState<Product[]>(productsData as Product[]);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [editJson, setEditJson] = useState('');
  const [showKnowledgeBase, setShowKnowledgeBase] = useState(false);

  // Load localStorage overrides
  useEffect(() => {
    const overrides = localStorage.getItem('product-overrides');
    if (overrides) {
      try {
        const map: Record<string, Partial<Product>> = JSON.parse(overrides);
        setProducts(prev => prev.map(p => map[p.id] ? { ...p, ...map[p.id] } : p));
      } catch {}
    }
  }, []);

  const filtered = products.filter(p => {
    if (activeCategory !== 'Wszystkie' && p.kategoriaFilter !== activeCategory) return false;
    if (search) {
      const q = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(q) ||
        p.segment.toLowerCase().includes(q) ||
        p.wariant.toLowerCase().includes(q) ||
        p.kategoria.toLowerCase().includes(q)
      );
    }
    return true;
  });

  function handleEdit(p: Product) {
    setEditProduct(p);
    setEditJson(JSON.stringify(p, null, 2));
  }

  function saveEdit() {
    if (!editProduct) return;
    try {
      const updated: Product = JSON.parse(editJson);
      const overrides = JSON.parse(localStorage.getItem('product-overrides') || '{}');
      overrides[editProduct.id] = updated;
      localStorage.setItem('product-overrides', JSON.stringify(overrides));
      setProducts(prev => prev.map(p => p.id === editProduct.id ? { ...p, ...updated } : p));
      setEditProduct(null);
    } catch (e) {
      alert('Nieprawidłowy JSON');
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-av-navy text-white py-8">
        <div className="max-w-7xl mx-auto px-4">
          <h1 className="text-3xl font-bold">📦 Produkty Angloville</h1>
          <p className="text-av-blue-light mt-2">
            Pełna baza produktów — {products.length} ofert z aktualnego cennika
          </p>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 py-6">
        {/* Search */}
        <div className="mb-4">
          <input
            type="text"
            placeholder="🔍 Szukaj produktu (nazwa, segment, wariant...)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full max-w-md border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:ring-2 focus:ring-av-blue focus:border-av-blue outline-none"
          />
        </div>

        {/* Category tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {CATEGORIES.map(cat => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(cat.key)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeCategory === cat.key
                  ? `${cat.color} text-white shadow-md`
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-gray-300'
              }`}
            >
              {cat.key}
              {cat.key === 'Wszystkie' ? ` (${products.length})` : ` (${products.filter(p => p.kategoriaFilter === cat.key).length})`}
            </button>
          ))}
        </div>

        {/* Results count */}
        <p className="text-sm text-gray-500 mb-4">
          Wyświetlono {filtered.length} z {products.length} produktów
        </p>

        {/* Product grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-12">
          {filtered.map(p => (
            <ProductCard key={p.id} product={p} onEdit={handleEdit} />
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="text-center py-12 text-gray-400">
            Brak produktów pasujących do kryteriów wyszukiwania.
          </div>
        )}

        {/* Knowledge Base Section */}
        <div className="border-t border-gray-200 pt-8 mt-8">
          <button
            onClick={() => setShowKnowledgeBase(!showKnowledgeBase)}
            className="text-xl font-bold text-av-navy flex items-center gap-2 mb-4"
          >
            📚 Baza wiedzy — regulaminy i zasady
            <span className="text-sm font-normal text-av-blue">
              {showKnowledgeBase ? '▲ Zwiń' : '▼ Rozwiń'}
            </span>
          </button>

          {showKnowledgeBase && <KnowledgeBaseSection />}
        </div>
      </div>

      {/* Edit Modal */}
      {editProduct && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-av-navy">Edycja lokalna: {editProduct.name}</h3>
              <button onClick={() => setEditProduct(null)} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
            </div>
            <div className="p-4 flex-1 overflow-auto">
              <p className="text-xs text-gray-500 mb-2">Zmiany zapisywane w localStorage (nie wpływają na serwer)</p>
              <textarea
                value={editJson}
                onChange={e => setEditJson(e.target.value)}
                className="w-full h-96 font-mono text-xs border border-gray-200 rounded-lg p-3 focus:ring-2 focus:ring-av-blue outline-none"
              />
            </div>
            <div className="flex gap-2 p-4 border-t">
              <button onClick={saveEdit} className="bg-av-blue text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-av-blue-dark">
                💾 Zapisz
              </button>
              <button onClick={() => setEditProduct(null)} className="bg-gray-100 text-gray-600 px-4 py-2 rounded-lg text-sm">
                Anuluj
              </button>
              <button
                onClick={() => {
                  const overrides = JSON.parse(localStorage.getItem('product-overrides') || '{}');
                  delete overrides[editProduct.id];
                  localStorage.setItem('product-overrides', JSON.stringify(overrides));
                  setProducts((productsData as Product[]).map(p => {
                    const o = overrides[p.id];
                    return o ? { ...p, ...o } : p;
                  }));
                  setEditProduct(null);
                }}
                className="bg-red-50 text-red-600 px-4 py-2 rounded-lg text-sm ml-auto"
              >
                🔄 Przywróć oryginał
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function KnowledgeBaseSection() {
  return (
    <div className="space-y-8 text-sm text-gray-700">
      {/* Breakdown ceny */}
      <section>
        <h3 className="text-lg font-bold text-av-navy mb-3">💰 Breakdown ceny (kurs + turystyka) — programy w Polsce</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200 rounded-lg text-xs">
            <thead className="bg-av-navy text-white">
              <tr>
                <th className="px-3 py-2 text-left">Produkt</th>
                <th className="px-3 py-2 text-left">Sezon</th>
                <th className="px-3 py-2 text-right">Opłata za Kurs</th>
                <th className="px-3 py-2 text-right">Opłata za Turystykę</th>
                <th className="px-3 py-2 text-right">Łącznie</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                ['Junior', 'Lato 2026', '2 699 zł', '2 000 zł', '4 699 zł'],
                ['Junior', 'Zima 2026', '2 999 zł', '1 700 zł', '4 699 zł'],
                ['Kids', 'Lato 2026', '2 299 zł', '2 000 zł', '4 299 zł'],
                ['Kids', 'Zima 2026', '2 499 zł', '1 800 zł', '4 299 zł'],
                ['Junior SKI', 'Zima 2026', '2 899 zł', '2 100 zł', '4 999 zł'],
                ['Family Adult', 'Lato 2026', '3 499 zł', '2 000 zł', '5 499 zł'],
                ['Family Kids', 'Lato 2026', '2 499 zł', '2 000 zł', '4 499 zł'],
                ['Adult Premium', '2026', '6 099 zł', '2 000 zł', '8 099 zł'],
                ['Adult Standard', '2026', '3 999 zł', '2 000 zł', '5 999 zł'],
                ['Adult Tandem', '2026', '2 999 zł', '2 000 zł', '4 999 zł'],
              ].map(([prod, sezon, kurs, turyst, total], i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2 font-medium">{prod}</td>
                  <td className="px-3 py-2">{sezon}</td>
                  <td className="px-3 py-2 text-right">{kurs}</td>
                  <td className="px-3 py-2 text-right">{turyst}</td>
                  <td className="px-3 py-2 text-right font-bold">{total}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Ratio NS */}
      <section>
        <h3 className="text-lg font-bold text-av-navy mb-3">👥 Proporcja Native Speaker : uczestnik</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200 rounded-lg text-xs">
            <thead className="bg-av-navy text-white">
              <tr>
                <th className="px-3 py-2 text-left">Produkt</th>
                <th className="px-3 py-2 text-left">Ratio</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                ['Kids (7–11)', '1 NS : 6 uczestników'],
                ['Junior (11–18)', '1 NS : 2 (sesje 2 na 1)'],
                ['Junior SKI', '1 NS : 2 (sesje 2 na 1)'],
                ['Family Adult', '2 na 1 z NS'],
                ['Family Kids', '3 na 1 + gry/zabawy'],
                ['Malta International', '1 NS : 2 (sesje 2 na 1 i 1 na 1)'],
                ['Anglia International', '1 NS : 2 (formuła 2 na 1)'],
                ['UK Trip Standard', 'BRAK sesji językowych (koordynatorzy NS)'],
                ['UK Trip Intensive', '1 NS : 3 uczestników'],
                ['Eurotrip Standard', 'BRAK sesji językowych'],
                ['Eurotrip Intensive', '1 NS : 3'],
                ['Baltic/Italy Trip', 'BRAK sesji językowych (koordynatorzy NS)'],
                ['Tripy światowe (młodzież)', 'Koordynatorzy NS + kierownik PL'],
                ['Adult Premium/Standard', '1 NS : 1 uczestnik (70h w 6 dni)'],
                ['Adult Tandem', '1 NS : 2 uczestników (70h w 6 dni)'],
                ['Tripy 40+', 'Pilot PL + pilot EN, program dwujęzyczny'],
                ['Tripy 18–40', 'Koordynatorzy NS, grupa międzynarodowa'],
              ].map(([prod, ratio], i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2 font-medium">{prod}</td>
                  <td className="px-3 py-2">{ratio}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Ubezpieczenie */}
      <section>
        <h3 className="text-lg font-bold text-av-navy mb-3">🛡️ Ubezpieczenie</h3>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 space-y-2">
          <p><strong>Polska (obozy PL):</strong> Signal Iduna — KL 20 000 EUR + NNW 20 000 PLN</p>
          <p><strong>Zagranica (młodzież):</strong> Signal Iduna — KL 20 000 EUR + NNW 15 000 EUR</p>
          <p><strong>Opcjonalnie:</strong> Ubezpieczenie od kosztów rezygnacji 100% (Signal Iduna)</p>
          <div className="pt-2 text-xs text-blue-600">
            <a href="https://app.signal-iduna.pl/files/IPID_OWU_Bezpieczne%20Podroze.pdf.pdf" target="_blank" rel="noopener noreferrer">📄 OWU zagranica</a>
            {' • '}
            <a href="https://app.signal-iduna.pl/files/IPID%20OWUKIT2018%20Ankes1%20Klauzule1,2,3.pdf.pdf" target="_blank" rel="noopener noreferrer">📄 OWU rezygnacja</a>
          </div>
        </div>
      </section>

      {/* Cancellation tables */}
      <section>
        <h3 className="text-lg font-bold text-av-navy mb-3">❌ Zasady rezygnacji</h3>

        <h4 className="font-semibold text-av-navy mt-4 mb-2">Kurs (obozy PL: Kids, Junior, SKI)</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200 rounded-lg text-xs">
            <thead className="bg-red-600 text-white">
              <tr>
                <th className="px-3 py-2 text-left">Termin przed rozpoczęciem</th>
                <th className="px-3 py-2 text-right">Koszt rezygnacji (% opłaty za Kurs)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                ['>30 dni', '25%'],
                ['29–22 dni', '41%'],
                ['21–14 dni', '53%'],
                ['13–7 dni', '76%'],
                ['6 dni lub mniej', '92%'],
                ['W trakcie kursu', '100%'],
              ].map(([term, cost], i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2">{term}</td>
                  <td className="px-3 py-2 text-right font-medium">{cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h4 className="font-semibold text-av-navy mt-4 mb-2">Impreza Turystyczna (obozy PL)</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200 rounded-lg text-xs">
            <thead className="bg-red-600 text-white">
              <tr>
                <th className="px-3 py-2 text-left">Termin przed rozpoczęciem</th>
                <th className="px-3 py-2 text-right">Koszt rezygnacji (% opłaty za IT)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                ['>28 dni', '0% (bezpłatne)'],
                ['27–22 dni', '30%'],
                ['21–14 dni', '50%'],
                ['13–7 dni', '70%'],
                ['6–3 dni', '80%'],
                ['2 dni lub mniej', '95%'],
                ['W trakcie', '100%'],
              ].map(([term, cost], i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2">{term}</td>
                  <td className="px-3 py-2 text-right font-medium">{cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h4 className="font-semibold text-av-navy mt-4 mb-2">Zagranica (Junior International, Junior Plus)</h4>
        <div className="overflow-x-auto">
          <table className="min-w-full border border-gray-200 rounded-lg text-xs">
            <thead className="bg-red-600 text-white">
              <tr>
                <th className="px-3 py-2 text-left">Termin przed rozpoczęciem</th>
                <th className="px-3 py-2 text-right">Koszt rezygnacji (% opłaty za IT)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {[
                ['>30 dni', '25%'],
                ['29–21 dni', '50%'],
                ['20–7 dni', '70%'],
                ['6–3 dni', '80%'],
                ['2 dni lub mniej', '95%'],
                ['W trakcie', '100%'],
              ].map(([term, cost], i) => (
                <tr key={i} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                  <td className="px-3 py-2">{term}</td>
                  <td className="px-3 py-2 text-right font-medium">{cost}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Referral rules */}
      <section>
        <h3 className="text-lg font-bold text-av-navy mb-3">🤝 Zasady zniżek za polecenie</h3>
        <div className="bg-green-50 border border-green-200 rounded-lg p-4 space-y-2 text-xs">
          <ul className="list-disc pl-4 space-y-1">
            <li>Polecić można <strong>wyłącznie</strong> osobę, która nigdy nie była klientem Angloville</li>
            <li>Klient rozpoznawany po adresie email</li>
            <li>Polecający podaje adres email swój i osoby polecanej</li>
            <li>Osoba polecana dokonuje zapisu wyłącznie przy pomocy adresu podanego przez polecającego</li>
            <li>Zniżka polecającego odejmowana od <strong>opłaty turystycznej (2. płatność)</strong></li>
            <li>Zniżka poleconego odejmowana od <strong>opłaty szkoleniowej (1. płatność)</strong></li>
            <li>Zniżka nalicza się po: (1) opłacie 1. raty przez polecającego, (2) zapisie i opłacie 1. raty przez poleconego</li>
            <li><strong>Max poleconych:</strong> 2 osoby w roku kalendarzowym</li>
            <li>System poleceń działa wyłącznie w danym roku kalendarzowym</li>
            <li>Kwota zniżki zależy od programu (300–1 200 zł)</li>
            <li>Można polecić więcej osób i sumować zniżki (max 2 premiowane)</li>
          </ul>
        </div>
      </section>

      {/* Payment terms */}
      <section>
        <h3 className="text-lg font-bold text-av-navy mb-3">💳 Płatności</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2 text-xs">
          <ul className="list-disc pl-4 space-y-1">
            <li>Wpłaty przez PayU, tPay lub przelew bankowy</li>
            <li>Raty 0% (harmonogram od Organizatora)</li>
            <li>Opłata za kurs: przy rejestracji lub do 3 dni od potwierdzenia</li>
            <li>Opłata za turystykę: najpóźniej 14 dni przed rozpoczęciem (PL) / 30 dni (zagranica)</li>
            <li>Faktury: VAT Marża (turystyka), wystawiane do 15. dnia miesiąca po wpłacie</li>
          </ul>
        </div>
      </section>

      {/* Online alternatives */}
      <section>
        <h3 className="text-lg font-bold text-av-navy mb-3">💻 Kurs online (gdy odwołany wyjazd)</h3>
        <div className="bg-teal-50 border border-teal-200 rounded-lg p-4 space-y-2 text-xs">
          <ul className="list-disc pl-4 space-y-1">
            <li><strong>Junior:</strong> 75 lekcji po 20 min, do wykorzystania w 5 miesięcy</li>
            <li><strong>Kids:</strong> 60 lekcji po 20 min, do wykorzystania w 5 miesięcy</li>
            <li><strong>SKI:</strong> 50 lekcji po 20 min, do wykorzystania w 5 miesięcy</li>
          </ul>
        </div>
      </section>

      {/* Zmiana terminu */}
      <section>
        <h3 className="text-lg font-bold text-av-navy mb-3">🔄 Zmiana terminu kursu</h3>
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 space-y-2 text-xs">
          <ul className="list-disc pl-4 space-y-1">
            <li>Możliwa za zgodą Organizatora (może odmówić bez podania przyczyny)</li>
            <li>Może wymagać aneksu i opłaty administracyjnej</li>
            <li>Po zmianie terminu — zasady rezygnacji liczone od kosztów rzeczywiście poniesionych</li>
          </ul>
        </div>
      </section>

      {/* Odstąpienie od umowy */}
      <section>
        <h3 className="text-lg font-bold text-av-navy mb-3">📜 Odstąpienie od umowy (konsument)</h3>
        <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 space-y-2 text-xs">
          <ul className="list-disc pl-4 space-y-1">
            <li>14 dni od zawarcia umowy (poza lokalem / na odległość) — bez podania przyczyny</li>
            <li>Nie dotyczy Imprezy Turystycznej (ustawa o imprezach turystycznych)</li>
            <li>Rozpoczęcie kursu = utrata prawa do odstąpienia</li>
          </ul>
        </div>
      </section>

      {/* Contact */}
      <section>
        <h3 className="text-lg font-bold text-av-navy mb-3">📞 Dane kontaktowe</h3>
        <div className="bg-av-blue/5 border border-av-blue/20 rounded-lg p-4 text-xs space-y-1">
          <p><strong>Tel:</strong> +48 533 655 147</p>
          <p><strong>Email:</strong> kontakt@angloville.pl</p>
          <p><strong>RODO:</strong> rodo@angloville.pl</p>
          <p><strong>Adres:</strong> Angloville sp. z o.o., ul. Św. Leonarda 1/8, 25-311 Kielce</p>
          <p><strong>KRS:</strong> 0000541765 | <strong>NIP:</strong> 6572916430 | <strong>REGON:</strong> 360712701</p>
          <p><strong>Nr Organizatora Turystyki:</strong> 119/15 (Marszałek Woj. Świętokrzyskiego)</p>
        </div>
      </section>
    </div>
  );
}
