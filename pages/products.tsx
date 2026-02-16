import { useState, useEffect } from 'react';

interface Product {
  id: string;
  name: string;
  category: 'Youth' | 'Adult' | 'Exchange';
  description: string;
  priceRegular: number;
  priceEarlyBird: number | null;
  ageRange: string;
  destinations: string[];
  dates: string;
  includes: string[];
  excludes: string[];
}

const defaultProducts: Product[] = [
  {
    id: 'kids-pl',
    name: 'Kids PL (7-11)',
    category: 'Youth',
    description: 'Program dla dzieci 7-11 lat w Polsce. Angielski przez zabawę z native speakerami.',
    priceRegular: 4299,
    priceEarlyBird: null,
    ageRange: '7-11 lat',
    destinations: ['Polska'],
    dates: 'Lipiec-Sierpień 2026',
    includes: ['Zakwaterowanie', 'Wyżywienie', 'Zajęcia z native speakerami', 'Materiały', 'Ubezpieczenie'],
    excludes: ['Dojazd', 'Kieszonkowe']
  },
  {
    id: 'junior-pl',
    name: 'Junior PL (11-18)',
    category: 'Youth',
    description: 'Program młodzieżowy w Polsce. Intensywny angielski z native speakerami w formule Angloville.',
    priceRegular: 4699,
    priceEarlyBird: 4449,
    ageRange: '11-18 lat',
    destinations: ['Polska — różne lokalizacje'],
    dates: 'Lipiec-Sierpień 2026',
    includes: ['Zakwaterowanie', 'Wyżywienie', 'Zajęcia 1:1 z native speakerami', 'Materiały', 'Ubezpieczenie', 'Certyfikat'],
    excludes: ['Dojazd', 'Kieszonkowe']
  },
  {
    id: 'junior-malta',
    name: 'Junior Malta',
    category: 'Youth',
    description: 'Program młodzieżowy na Malcie. Angielski + słońce + przygoda.',
    priceRegular: 6499,
    priceEarlyBird: 5999,
    ageRange: '11-18 lat',
    destinations: ['Malta — St. Julians'],
    dates: 'Lipiec 2026',
    includes: ['Przelot', 'Zakwaterowanie', 'Wyżywienie', 'Zajęcia', 'Wycieczki', 'Ubezpieczenie'],
    excludes: ['Kieszonkowe', 'Opcjonalne wycieczki']
  },
  {
    id: 'junior-uk',
    name: 'Junior UK',
    category: 'Youth',
    description: 'Program młodzieżowy w Wielkiej Brytanii. Immersja językowa w autentycznym środowisku.',
    priceRegular: 7299,
    priceEarlyBird: 6799,
    ageRange: '13-18 lat',
    destinations: ['Wielka Brytania'],
    dates: 'Lipiec 2026',
    includes: ['Przelot', 'Zakwaterowanie', 'Wyżywienie', 'Zajęcia', 'Wycieczki', 'Ubezpieczenie'],
    excludes: ['Kieszonkowe', 'Paszport/wiza']
  },
  {
    id: 'adult-wioska',
    name: 'Adult Angielska Wioska',
    category: 'Adult',
    description: 'Program dla dorosłych. 6 dni intensywnej konwersacji z native speakerami 1:1.',
    priceRegular: 2990,
    priceEarlyBird: 2690,
    ageRange: '18+ lat',
    destinations: ['Polska — różne lokalizacje'],
    dates: 'Cały rok — turnusy co 2 tygodnie',
    includes: ['Zakwaterowanie', 'Wyżywienie', 'Zajęcia 1:1', 'Materiały', 'Certyfikat'],
    excludes: ['Dojazd']
  },
  {
    id: 'exchange',
    name: 'Native Speaker Exchange',
    category: 'Exchange',
    description: 'Program wymiany — native speakerzy uczą angielskiego w zamian za naukę polskiego.',
    priceRegular: 0,
    priceEarlyBird: null,
    ageRange: '21+ lat',
    destinations: ['Polska'],
    dates: 'Cały rok',
    includes: ['Zakwaterowanie', 'Wyżywienie', 'Szkolenie metodyczne'],
    excludes: ['Dojazd do Polski']
  },
];

export default function Products() {
  const [products, setProducts] = useState<Product[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('callx-products');
      if (saved) return JSON.parse(saved);
    }
    return defaultProducts;
  });
  const [selected, setSelected] = useState<string | null>(null);
  const [editing, setEditing] = useState<Product | null>(null);
  const [filterCat, setFilterCat] = useState<string>('all');

  const save = (updated: Product[]) => {
    setProducts(updated);
    localStorage.setItem('callx-products', JSON.stringify(updated));
  };

  const startEdit = (p: Product) => {
    setEditing({ ...p });
    setSelected(p.id);
  };

  const saveEdit = () => {
    if (!editing) return;
    const updated = products.map(p => p.id === editing.id ? editing : p);
    save(updated);
    setEditing(null);
  };

  const cancelEdit = () => setEditing(null);

  const filtered = filterCat === 'all' ? products : products.filter(p => p.category === filterCat);

  const catColors: Record<string, string> = {
    'Youth': 'bg-blue-100 text-blue-700',
    'Adult': 'bg-green-100 text-green-700',
    'Exchange': 'bg-purple-100 text-purple-700',
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-av-navy mb-6">Produkty Angloville</h1>

      {/* Filter */}
      <div className="flex gap-2 mb-5">
        {['all', 'Youth', 'Adult', 'Exchange'].map(cat => (
          <button key={cat} onClick={() => setFilterCat(cat)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              filterCat === cat ? 'bg-av-blue text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-av-blue'
            }`}>
            {cat === 'all' ? 'Wszystkie' : cat}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filtered.map(p => (
          <div key={p.id}
            className={`bg-white rounded-xl shadow-sm border overflow-hidden ${
              selected === p.id ? 'border-av-blue ring-2 ring-av-blue/20' : 'border-gray-100'
            }`}>
            {/* Card header */}
            <div className="p-5 cursor-pointer" onClick={() => { setSelected(selected === p.id ? null : p.id); setEditing(null); }}>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-bold text-av-navy">{p.name}</h3>
                <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${catColors[p.category]}`}>
                  {p.category}
                </span>
              </div>
              <p className="text-gray-500 text-sm mb-3">{p.description}</p>
              <div className="flex items-center gap-4">
                <div>
                  <div className="text-xs text-gray-400">Cena regularna</div>
                  <div className="font-bold text-av-navy">{p.priceRegular > 0 ? `${p.priceRegular.toLocaleString('pl-PL')} zł` : 'Bezpłatny'}</div>
                </div>
                {p.priceEarlyBird && (
                  <div>
                    <div className="text-xs text-gray-400">Early Bird 🐦</div>
                    <div className="font-bold text-green-600">{p.priceEarlyBird.toLocaleString('pl-PL')} zł</div>
                  </div>
                )}
                <div className="ml-auto text-xs text-gray-400">{p.ageRange}</div>
              </div>
            </div>

            {/* Expanded detail / edit form */}
            {selected === p.id && (
              <div className="border-t border-gray-100 p-5 bg-gray-50">
                {editing && editing.id === p.id ? (
                  <div className="space-y-3">
                    <div>
                      <label className="text-xs font-medium text-gray-500">Nazwa</label>
                      <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:border-av-blue" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Opis</label>
                      <textarea value={editing.description} onChange={e => setEditing({ ...editing, description: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:border-av-blue" rows={2} />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs font-medium text-gray-500">Cena regularna (zł)</label>
                        <input type="number" value={editing.priceRegular} onChange={e => setEditing({ ...editing, priceRegular: +e.target.value })}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:border-av-blue" />
                      </div>
                      <div>
                        <label className="text-xs font-medium text-gray-500">Cena Early Bird (zł)</label>
                        <input type="number" value={editing.priceEarlyBird || ''} onChange={e => setEditing({ ...editing, priceEarlyBird: e.target.value ? +e.target.value : null })}
                          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:border-av-blue" />
                      </div>
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Wiek</label>
                      <input value={editing.ageRange} onChange={e => setEditing({ ...editing, ageRange: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:border-av-blue" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Destynacje (po przecinku)</label>
                      <input value={editing.destinations.join(', ')} onChange={e => setEditing({ ...editing, destinations: e.target.value.split(',').map(s => s.trim()) })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:border-av-blue" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Terminy</label>
                      <input value={editing.dates} onChange={e => setEditing({ ...editing, dates: e.target.value })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:border-av-blue" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Co zawiera (po przecinku)</label>
                      <input value={editing.includes.join(', ')} onChange={e => setEditing({ ...editing, includes: e.target.value.split(',').map(s => s.trim()) })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:border-av-blue" />
                    </div>
                    <div>
                      <label className="text-xs font-medium text-gray-500">Czego nie zawiera (po przecinku)</label>
                      <input value={editing.excludes.join(', ')} onChange={e => setEditing({ ...editing, excludes: e.target.value.split(',').map(s => s.trim()) })}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm mt-1 focus:outline-none focus:border-av-blue" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={saveEdit} className="px-4 py-2 bg-av-blue text-white rounded-lg text-sm font-medium">Zapisz</button>
                      <button onClick={cancelEdit} className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg text-sm font-medium">Anuluj</button>
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <div className="text-xs text-gray-400 font-medium">Destynacje</div>
                        <div className="text-sm text-gray-700">{p.destinations.join(', ')}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 font-medium">Terminy</div>
                        <div className="text-sm text-gray-700">{p.dates}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4 mb-4">
                      <div>
                        <div className="text-xs text-gray-400 font-medium mb-1">✅ Zawiera</div>
                        {p.includes.map((item, i) => (
                          <div key={i} className="text-sm text-gray-700">• {item}</div>
                        ))}
                      </div>
                      <div>
                        <div className="text-xs text-gray-400 font-medium mb-1">❌ Nie zawiera</div>
                        {p.excludes.map((item, i) => (
                          <div key={i} className="text-sm text-gray-700">• {item}</div>
                        ))}
                      </div>
                    </div>
                    <button onClick={() => startEdit(p)}
                      className="px-4 py-2 bg-av-blue text-white rounded-lg text-sm font-medium">
                      ✏️ Edytuj produkt
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
