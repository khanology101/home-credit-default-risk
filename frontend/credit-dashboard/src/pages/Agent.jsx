import { useState } from 'react';
import { askAgent } from '../api';
import DecisionBadge from '../components/DecisionBadge';
import { useApplicant, FEATURE_LABELS } from '../context/ApplicantContext';

const DECISION_COLOR = {
  'AUTO-APPROVE' : 'text-green-700',
  'MANUAL REVIEW': 'text-yellow-700',
  'SENIOR REVIEW': 'text-orange-700',
  'DECLINED'     : 'text-red-700',
};

function parseShapBullets(shapContext) {
  if (!shapContext) return { title: null, bullets: [] };
  const lines = shapContext.split('\n').filter(Boolean);
  const [title, ...rest] = lines;
  const bullets = rest.map(line => {
    const clean = line.replace(/^\s*-\s*/, '');
    const increases = clean.includes('INCREASES');
    return { text: clean, increases };
  });
  return { title, bullets };
}

function AgentAnswer({ answer, decision }) {
  const color = DECISION_COLOR[decision] || 'text-gray-700';
  const match = /^FINAL ANSWER:\s*(.+?)\s*\n([\s\S]*)$/i.exec((answer || '').trim());

  if (!match) {
    return <p className="text-sm text-gray-700 leading-relaxed">{answer}</p>;
  }

  const [, verdict, rest] = match;
  return (
    <div className="space-y-2">
      <p className={`font-serif text-lg font-bold tracking-wide ${color}`}>
        FINAL ANSWER: <span className="uppercase">{verdict}</span>
      </p>
      <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{rest.trim()}</p>
    </div>
  );
}

const SAMPLE_QUESTIONS = [
  "Why was this applicant declined and what would change the decision?",
  "Is this applicant eligible under our credit policy?",
  "What is the risk level of this applicant and why?",
  "What would the applicant need to change to get approved?",
];

export default function Agent() {
  const { features } = useApplicant();
  const [question, setQuestion] = useState(SAMPLE_QUESTIONS[0]);
  const [result,   setResult]   = useState(null);
  const [loading,  setLoading]  = useState(false);

  const handleAsk = async () => {
    setLoading(true);
    try {
      const res = await askAgent(features, question);
      setResult(res.data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">AI Loan Officer Agent</h1>
      <p className="text-sm text-gray-500">
        Agent uses the current applicant features from the Scorer tab.
        Update features there first, then ask questions here.
      </p>

      {/* Current applicant summary */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <p className="text-xs font-semibold text-blue-600 uppercase mb-2">
          Current Applicant Features (from Scorer)
        </p>
        <div className="grid grid-cols-3 gap-2 text-xs text-blue-800">
          {['EXT_SOURCE_1','EXT_SOURCE_2','EXT_SOURCE_3',
            'AMT_INCOME_TOTAL','AMT_CREDIT','EMPLOYMENT_YEARS'].map(k => (
           <span key={k}>
              <span className="text-blue-400">{FEATURE_LABELS[k] || k}:</span>{' '}
              <span className="font-medium">{features[k] !== undefined ? features[k] : '—'}</span>
            </span>
          ))}
        </div>
      </div>

      <div className="bg-white rounded-xl shadow p-6 space-y-4">
        <div>
          <label className="text-sm font-semibold text-gray-600 block mb-2">
            Sample Questions
          </label>
          <div className="flex flex-wrap gap-2">
            {SAMPLE_QUESTIONS.map(q => (
              <button
                key={q}
                onClick={() => setQuestion(q)}
                className={`text-xs px-3 py-1 rounded-full border transition ${
                  question === q
                    ? 'bg-blue-900 text-white border-blue-900'
                    : 'text-gray-500 border-gray-300 hover:border-blue-400'
                }`}
              >
                {q.slice(0, 45)}...
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-sm font-semibold text-gray-600 block mb-2">
            Your Question
          </label>
          <textarea
            value={question}
            onChange={e => setQuestion(e.target.value)}
            rows={3}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
          />
        </div>

        <button
          onClick={handleAsk}
          disabled={loading}
          className="w-full bg-blue-900 text-white py-2 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50 transition"
        >
          {loading ? 'Agent thinking...' : 'Ask Agent'}
        </button>
      </div>

      {result && (
        <div className="bg-white rounded-xl shadow p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-700">Agent Response</h2>
            <DecisionBadge decision={result.decision} />
          </div>

          <div className="text-sm text-gray-500">
            Default probability:
            <span className="ml-2 font-bold text-gray-800">
              {result.default_probability}
            </span>
          </div>

          <div className="border-2 border-gray-300 rounded-xl p-4 bg-gray-100">
            <p className="text-xs font-semibold text-gray-700 uppercase mb-3">
              SHAP Context
            </p>
            {(() => {
              const { title, bullets } = parseShapBullets(result.shap_context);
              return (
                <>
                  {title && <p className="text-xs font-medium text-gray-600 mb-2">{title}</p>}
                  <ul className="space-y-1.5">
                    {bullets.map((b, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-800">
                        <span className={b.increases ? 'text-red-500' : 'text-green-500'}>
                          {b.increases ? '▲' : '▼'}
                        </span>
                        <span>{b.text}</span>
                      </li>
                    ))}
                  </ul>
                </>
              );
            })()}
          </div>

          <div className="bg-blue-50 rounded-lg p-4">
            <p className="text-xs font-semibold text-blue-400 uppercase mb-2">
              Agent Answer
            </p>
            <AgentAnswer answer={result.answer} decision={result.decision} />
          </div>
        </div>
      )}
    </div>
  );
}