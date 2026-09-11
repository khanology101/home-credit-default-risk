import { useEffect, useState } from 'react';
import { getPortfolio, healthCheck } from '../api';
import StatCard from '../components/StatCard';

export default function Dashboard() {
  const [portfolio, setPortfolio] = useState(null);
  const [health,    setHealth]    = useState(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    Promise.all([getPortfolio(), healthCheck()])
      .then(([p, h]) => {
        setPortfolio(p.data);
        setHealth(h.data);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">
      Loading portfolio...
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Portfolio Overview</h1>
        <p className="text-sm text-gray-400">
          API status:
          <span className={`ml-2 font-semibold ${health?.status === 'ok' ? 'text-green-500' : 'text-red-500'}`}>
            {health?.status === 'ok' ? '● Live' : '● Offline'}
          </span>
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Loans Approved"
          value={portfolio?.loans_approved}
          subtitle={`of ${portfolio?.loans_approved + portfolio?.loans_rejected} evaluated`}
          color="primary"
        />
        <StatCard
          title="Capital Deployed"
          value={`$${(portfolio?.capital_deployed / 1_000_000).toFixed(2)}M`}
          subtitle="Total loan book"
          color="success"
        />
        <StatCard
          title="Return on Capital"
          value={`${(portfolio?.return_on_capital * 100).toFixed(2)}%`}
          subtitle="Risk-adjusted"
          color="warning"
        />
        <StatCard
          title="Avg Default Prob"
          value={`${(portfolio?.avg_default_prob * 100).toFixed(2)}%`}
          subtitle="Portfolio weighted"
          color="danger"
        />
      </div>

      <div className="bg-white rounded-xl shadow p-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">Portfolio Summary</h2>
        <div className="grid grid-cols-2 gap-4 text-sm">
          {[
            ['Loans Approved',        portfolio?.loans_approved],
            ['Loans Rejected',        portfolio?.loans_rejected],
            ['Capital Deployed',      `$${portfolio?.capital_deployed?.toLocaleString()}`],
            ['Risk-Adj Return',       `$${portfolio?.total_risk_adj_return?.toLocaleString()}`],
            ['Avg Default Prob',      `${(portfolio?.avg_default_prob * 100).toFixed(2)}%`],
            ['Return on Capital',     `${(portfolio?.return_on_capital * 100).toFixed(2)}%`],
          ].map(([label, val]) => (
            <div key={label} className="flex justify-between border-b pb-2">
              <span className="text-gray-500">{label}</span>
              <span className="font-semibold text-gray-800">{val}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}