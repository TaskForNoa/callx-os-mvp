import { useState, useEffect } from 'react';
import type { ScenarioDefinition } from '../lib/scenarioFlow';

const categoryLabels: Record<string, string> = {
  timing: '⏰ Czas',
  price: '💰 Cena',
  interest: '🤷 Zainteresowanie',
  child: '👦 Dziecko',
  unknown: '❓ Inne',
};

export default function Scenarios() {
  const [scenarios, setScenarios] = useState<ScenarioDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedStep, setExpandedStep] = useState<number | null>(null);
  const [showObjections, setShowObjections] = useState(false);

  useEffect(() => {
    fetch('/api/scenarios')
      .then(r => r.json())
      .then(data => { setScenarios(data.scenarios || []); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center min-h-[60vh]">
        <div className="text-gray-400 text-lg">Ładowanie scenariuszy...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-av-navy">Scenariusze</h1>
        <p className="text-gray-500 text-sm mt-1">Aktualne flow rozmów agenta — odzwierciedla logikę w silniku konwersacji</p>
      </div>

      {scenarios.map(scenario => (
        <div key={scenario.id} className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
          {/* Header */}
          <button
            onClick={() => setExpandedId(expandedId === scenario.id ? null : scenario.id)}
            className="w-full p-5 flex items-center justify-between hover:bg-gray-50 text-left"
          >
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl">🔄</div>
              <div>
                <div className="font-bold text-av-navy text-lg">{scenario.name}</div>
                <div className="text-gray-500 text-sm">{scenario.description} • {scenario.steps.length} kroków</div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="px-3 py-1 bg-blue-100 text-blue-700 text-xs font-bold rounded-full">AKTYWNY</span>
              <span className="text-gray-400 text-xl">{expandedId === scenario.id ? '▲' : '▼'}</span>
            </div>
          </button>

          {expandedId === scenario.id && (
            <div className="border-t border-gray-100">
              {/* Target group */}
              <div className="px-5 pt-4 pb-2">
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  <span>🎯</span> <strong>Grupa docelowa:</strong> {scenario.targetGroup}
                </div>
              </div>

              {/* Flow steps */}
              <div className="p-5">
                <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">
                  Flow rozmowy — {scenario.steps.length} kroków
                </h3>

                {/* Visual flow line */}
                <div className="space-y-0">
                  {scenario.steps.map((step, i) => (
                    <div key={step.step} className="relative">
                      {/* Connecting line */}
                      {i < scenario.steps.length - 1 && (
                        <div className="absolute left-6 top-14 bottom-0 w-0.5 bg-gray-200 z-0" />
                      )}

                      <div className="relative z-10">
                        <button
                          onClick={() => setExpandedStep(expandedStep === i ? null : i)}
                          className="w-full px-0 py-2 flex items-start gap-3 hover:bg-gray-50 rounded-lg text-left transition-colors"
                        >
                          {/* Step number circle */}
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl shrink-0 ${
                            expandedStep === i ? 'bg-av-blue text-white' : 'bg-gray-100'
                          }`}>
                            {step.icon}
                          </div>
                          <div className="flex-1 pt-1">
                            <div className="font-medium text-av-navy text-sm">
                              <span className="text-gray-400 mr-1">{i + 1}.</span> {step.title}
                            </div>
                            <div className="text-xs text-gray-400 mt-0.5">{step.goal}</div>
                          </div>
                          <span className="text-gray-300 text-sm pt-2">{expandedStep === i ? '▲' : '▼'}</span>
                        </button>

                        {expandedStep === i && (
                          <div className="ml-15 pl-15 mb-3 ml-[60px]">
                            {/* Example script */}
                            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-2">
                              <div className="text-xs text-blue-500 font-medium mb-1">💬 Przykładowy skrypt:</div>
                              <div className="text-sm text-av-navy leading-relaxed">{step.exampleScript}</div>
                            </div>

                            {/* Possible outcomes */}
                            <div className="space-y-1">
                              <div className="text-xs text-gray-500 font-medium">Możliwe wyniki:</div>
                              {step.possibleOutcomes.map((out, j) => (
                                <div key={j} className="flex items-center gap-2 text-xs text-gray-600">
                                  <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" />
                                  {out}
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Objections */}
              <div className="p-5 border-t border-gray-100">
                <button
                  onClick={() => setShowObjections(!showObjections)}
                  className="flex items-center gap-2 text-sm font-semibold text-gray-500 uppercase tracking-wider hover:text-av-navy"
                >
                  🛡️ Obsługa obiekcji ({scenario.objections.length})
                  <span className="text-xs normal-case font-normal">{showObjections ? '▲' : '▼'}</span>
                </button>

                {showObjections && (
                  <div className="mt-4 space-y-2">
                    {scenario.objections.map((obj, i) => (
                      <div key={i} className="border border-gray-200 rounded-lg p-3 hover:bg-gray-50">
                        <div className="flex items-start gap-3">
                          <span className="text-xs px-2 py-0.5 bg-gray-100 rounded-full text-gray-500 shrink-0 mt-0.5">
                            {categoryLabels[obj.category] || obj.category}
                          </span>
                          <div className="flex-1">
                            <div className="text-sm font-medium text-red-600">❝ {obj.trigger} ❞</div>
                            <div className="text-sm text-green-700 mt-1">→ {obj.response}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Anti-hallucination note */}
              <div className="px-5 pb-5">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
                  <strong>⚠️ Zasada zero-hallucination:</strong> Agent podaje TYLKO dane z bazy produktów (products-full.json).
                  Jeśli brakuje ceny, ratio lub linku → mówi „sprawdzę i wrócę mailowo".
                </div>
              </div>
            </div>
          )}
        </div>
      ))}

      {/* Placeholder */}
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
