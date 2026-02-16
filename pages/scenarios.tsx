import { useState, useRef } from 'react';

interface Objection {
  id: string;
  trigger: string;
  response: string;
}

const defaultObjections: Objection[] = [
  { id: '1', trigger: 'Jeszcze nie wiem / muszę pomyśleć', response: 'Rozumiem. Early Bird kończy się [data] — mogę wysłać link, żeby mieli Państwo czas spokojnie się zapoznać?' },
  { id: '2', trigger: 'W tym roku chyba nie', response: 'Czy jest coś co mogłoby zmienić zdanie? Może inna destynacja lub termin?' },
  { id: '3', trigger: 'Za drogo', response: 'Mamy raty 0% do 6 rat. Mogę wysłać szczegóły?' },
  { id: '4', trigger: 'Dziecko nie chce', response: 'Co się zmieniło? Może inna forma — np. [alternatywny program]?' },
  { id: '5', trigger: 'Nieznana obiekcja', response: '2 próby wyjaśnienia, potem eskalacja do konsultanta.' },
];

const flowSteps = [
  {
    icon: '👋', title: 'Powitanie + identyfikacja',
    script: 'Dzień dobry, czy rozmawiam z [imię rodzica]? Tu Kasia z Angloville.',
    details: 'Potwierdź tożsamość rozmówcy. Ciepły, profesjonalny ton.'
  },
  {
    icon: '🔗', title: 'Nawiązanie do historii',
    script: 'Dzwonię bo [dziecko] był/a u nas na [ostatni program]. Chciałam zapytać jak wspomina pobyt?',
    details: 'Buduj relację. Odwołaj się do konkretnego programu z danych leada.'
  },
  {
    icon: '💡', title: 'Propozycja (rekomendacja AI)',
    script: 'Wielu uczestników którzy byli na [poprzedni] decyduje się na [rekomendowany]. Mamy teraz Early Bird — cena od [cena EB].',
    details: 'Użyj rekomendacji AI z karty leada. Podaj cenę Early Bird z bazy produktów.'
  },
  {
    icon: '🎯', title: 'Analiza potrzeb',
    script: 'Jakie macie plany na wakacje? Czy [dziecko] chciałby spróbować czegoś nowego?',
    details: 'Pytania otwarte. Zbieraj info o preferencjach, terminach, budżecie.'
  },
  {
    icon: '🛡️', title: 'Obiekcje',
    script: '[Patrz tabela obiekcji poniżej]',
    details: 'Użyj tabeli obiekcji. Maks. 2 próby na obiekcję. Nieznana → eskalacja.'
  },
  {
    icon: '✅', title: 'Closing',
    script: 'Wariant A: "Mogę teraz wypełnić zgłoszenie — zajmie 2 minuty."\nWariant B: "Wysyłam link na email/SMS — proszę kliknąć i wypełnić."\nWariant C: "Kiedy mogę zadzwonić ponownie?"',
    details: '3 warianty zamknięcia: aplikacja, link, callback. Dopasuj do sygnałów klienta.'
  },
  {
    icon: '👋', title: 'Pożegnanie',
    script: 'Dziękuję za rozmowę! Gdyby mieli Państwo pytania — proszę śmiało dzwonić. Miłego dnia!',
    details: 'Zawsze pozytywne zakończenie niezależnie od wyniku.'
  },
];

export default function Scenarios() {
  const [expandedScenario, setExpandedScenario] = useState<string | null>(null);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [objections, setObjections] = useState<Objection[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('callx-objections');
      if (saved) return JSON.parse(saved);
    }
    return defaultObjections;
  });
  const [editingObj, setEditingObj] = useState<string | null>(null);
  const [uploadedFiles, setUploadedFiles] = useState<string[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('callx-transcripts');
      if (saved) return JSON.parse(saved);
    }
    return [];
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const saveObjections = (updated: Objection[]) => {
    setObjections(updated);
    localStorage.setItem('callx-objections', JSON.stringify(updated));
  };

  const updateObjField = (id: string, field: 'trigger' | 'response', value: string) => {
    const updated = objections.map(o => o.id === id ? { ...o, [field]: value } : o);
    saveObjections(updated);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    const names = Array.from(files).map(f => f.name);
    const updated = [...uploadedFiles, ...names];
    setUploadedFiles(updated);
    localStorage.setItem('callx-transcripts', JSON.stringify(updated));
  };

  const removeFile = (name: string) => {
    const updated = uploadedFiles.filter(f => f !== name);
    setUploadedFiles(updated);
    localStorage.setItem('callx-transcripts', JSON.stringify(updated));
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold text-av-navy mb-6">Scenariusze</h1>

      {/* Scenario card */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
        <button
          onClick={() => setExpandedScenario(expandedScenario === 'reengagement' ? null : 'reengagement')}
          className="w-full p-5 flex items-center justify-between hover:bg-gray-50 text-left"
        >
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl">🔄</div>
            <div>
              <div className="font-bold text-av-navy text-lg">Re-engagement Paści</div>
              <div className="text-gray-500 text-sm">Scenariusz reaktywacji klientów powracających • 7 kroków</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">AKTYWNY</span>
            <span className="text-gray-400 text-xl">{expandedScenario === 'reengagement' ? '▲' : '▼'}</span>
          </div>
        </button>

        {expandedScenario === 'reengagement' && (
          <div className="border-t border-gray-100">
            {/* Flow steps */}
            <div className="p-5">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Flow rozmowy — 7 kroków</h3>
              <div className="space-y-2">
                {flowSteps.map((step, i) => (
                  <div key={i} className="border border-gray-200 rounded-lg overflow-hidden">
                    <button
                      onClick={() => setExpandedStep(expandedStep === i ? null : i)}
                      className="w-full px-4 py-3 flex items-center gap-3 hover:bg-gray-50 text-left"
                    >
                      <span className="text-xl">{step.icon}</span>
                      <span className="font-medium text-av-navy text-sm flex-1">
                        {i + 1}. {step.title}
                      </span>
                      <span className="text-gray-400 text-sm">{expandedStep === i ? '▲' : '▼'}</span>
                    </button>
                    {expandedStep === i && (
                      <div className="px-4 pb-4 pt-1 bg-gray-50 border-t border-gray-200">
                        <div className="bg-white rounded-lg p-3 mb-2 border border-gray-200">
                          <div className="text-xs text-gray-500 font-medium mb-1">Skrypt:</div>
                          <div className="text-sm text-av-navy whitespace-pre-line">{step.script}</div>
                        </div>
                        <div className="text-xs text-gray-500 italic">{step.details}</div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Objections table */}
            <div className="p-5 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">🛡️ Tabela obiekcji</h3>
              <div className="space-y-2">
                {objections.map(obj => (
                  <div key={obj.id} className="border border-gray-200 rounded-lg p-3">
                    {editingObj === obj.id ? (
                      <div className="space-y-2">
                        <input
                          value={obj.trigger}
                          onChange={e => updateObjField(obj.id, 'trigger', e.target.value)}
                          className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-av-blue"
                          placeholder="Obiekcja klienta..."
                        />
                        <textarea
                          value={obj.response}
                          onChange={e => updateObjField(obj.id, 'response', e.target.value)}
                          className="w-full border border-gray-200 rounded px-3 py-2 text-sm focus:outline-none focus:border-av-blue"
                          rows={2}
                          placeholder="Odpowiedź agenta..."
                        />
                        <button onClick={() => setEditingObj(null)}
                          className="px-3 py-1 bg-av-blue text-white text-xs rounded-lg">
                          Zapisz
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-start justify-between gap-3 cursor-pointer" onClick={() => setEditingObj(obj.id)}>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-red-600">❝ {obj.trigger} ❞</div>
                          <div className="text-sm text-green-700 mt-1">→ {obj.response}</div>
                        </div>
                        <button className="text-gray-400 hover:text-av-blue text-xs shrink-0">✏️ Edytuj</button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Transcript upload */}
            <div className="p-5 border-t border-gray-100">
              <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">📄 Transkrypty rozmów</h3>
              <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center mb-3">
                <input
                  ref={fileRef}
                  type="file"
                  accept=".txt,.pdf"
                  multiple
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button onClick={() => fileRef.current?.click()}
                  className="px-4 py-2 bg-av-blue text-white rounded-lg text-sm font-medium hover:bg-av-blue-dark">
                  📁 Wgraj transkrypty (.txt / .pdf)
                </button>
                <p className="text-xs text-gray-400 mt-2">Pliki przechowywane lokalnie — analiza wkrótce</p>
              </div>
              {uploadedFiles.length > 0 && (
                <div className="space-y-1">
                  {uploadedFiles.map((f, i) => (
                    <div key={i} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <span className="text-sm text-gray-700">📄 {f}</span>
                      <button onClick={() => removeFile(f)} className="text-red-400 hover:text-red-600 text-xs">✕ Usuń</button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Placeholder for future scenarios */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5 opacity-50">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-2xl">➕</div>
          <div>
            <div className="font-bold text-gray-400">Nowy scenariusz</div>
            <div className="text-gray-400 text-sm">Wkrótce — dodawanie własnych scenariuszy</div>
          </div>
        </div>
      </div>
    </div>
  );
}
