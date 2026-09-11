import { useState } from 'react';
import { scoreApplicant, explainApplicant } from '../api';
import DecisionBadge from '../components/DecisionBadge';
import ShapChart from '../components/ShapChart';
import { useApplicant, FEATURE_LABELS } from '../context/ApplicantContext';

export default function Scorer() {
  const { features, setFeatures, setLastScore } = useApplicant();
  const [result,  setResult]  = useState(null);
  const [loading, setLoading] = useState(false);

  const handleChange = (key, val) =>
    setFeatures(f => ({ ...f, [key]: parseFloat(val) || 0 }));

  const handleScore = async () => {
    setLoading(true);
    try {
      const [score, explain] = await Promise.all([
        scoreApplicant(features),
        explainApplicant(features),
      ]);
      const combined = { ...score.data, top_factors: explain.data.top_factors };
      setResult(combined);
      setLastScore(combined);  // share with agent
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const keyFeatures = [
    'EXT_SOURCE_1','EXT_SOURCE_2','EXT_SOURCE_3',
    'AMT_INCOME_TOTAL','AMT_CREDIT','CREDIT_INCOME_RATIO',
    'ANNUITY_INCOME_RATIO','LOAN_TERM_MONTHS','EMPLOYMENT_YEARS',
  ];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-gray-800">Applicant Scorer</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Applicant Features</h2>
          <div className="grid grid-cols-2 gap-3">
            {keyFeatures.map(key => (
              <div key={key}>
                <label className="text-xs text-gray-500 block mb-1">{FEATURE_LABELS[key] || key}</label>
                <input
                  type="number"
                  step="any"
                  value={features[key] ?? 0}
                  onChange={e => handleChange(key, e.target.value)}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
                />
              </div>
            ))}
          </div>
          <button
            onClick={handleScore}
            disabled={loading}
            className="mt-4 w-full bg-blue-900 text-white py-2 rounded-lg font-semibold hover:bg-blue-800 disabled:opacity-50 transition"
          >
            {loading ? 'Scoring...' : 'Score Applicant'}
          </button>
        </div>

        <div className="bg-white rounded-xl shadow p-6">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Decision</h2>
          {result ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-sm">Decision</span>
                <DecisionBadge decision={result.decision} />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-500 text-sm">Default Probability</span>
                <span className="text-2xl font-bold text-gray-800">
                  {result.default_probability_pct}
                </span>
              </div>
              {result.warnings && (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-xs font-semibold text-yellow-700 mb-1">⚠ Input Warnings</p>
                  {result.warnings.map((w, i) => (
                    <p key={i} className="text-xs text-yellow-600">{w}</p>
                  ))}
                </div>
              )}
              <div className="border-t pt-4">
                <p className="text-sm font-semibold text-gray-600 mb-3">Top SHAP Factors</p>
                <ShapChart factors={result.top_factors} />
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-48 text-gray-300 text-sm">
              Enter features and click Score
            </div>
          )}
        </div>
      </div>
    </div>
  );
}