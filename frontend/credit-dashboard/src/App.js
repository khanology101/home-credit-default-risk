import { useState } from 'react';
import Dashboard from './pages/Dashboard';
import Scorer    from './pages/Scorer';
import Agent     from './pages/Agent';
import { LayoutDashboard, Search, Bot } from 'lucide-react';

const NAV = [
  { id: 'dashboard', label: 'Dashboard',  icon: LayoutDashboard, page: Dashboard },
  { id: 'scorer',    label: 'Scorer',     icon: Search,           page: Scorer    },
  { id: 'agent',     label: 'AI Agent',   icon: Bot,              page: Agent     },
];

export default function App() {
  const [active, setActive] = useState('dashboard');
  const Page = NAV.find(n => n.id === active)?.page || Dashboard;

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-56 bg-blue-900 text-white flex flex-col">
        <div className="px-6 py-6 border-b border-blue-800">
          <h1 className="text-lg font-bold leading-tight">Credit</h1>
          <p className="text-xs text-blue-300">Decisioning System</p>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActive(id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                active === id
                  ? 'bg-blue-700 text-white'
                  : 'text-blue-200 hover:bg-blue-800'
              }`}
            >
              <Icon size={16} />
              {label}
            </button>
          ))}
        </nav>
        <div className="px-4 py-4 border-t border-blue-800 text-xs text-blue-400">
          XGBoost + LangGraph + CPLEX
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-8">
        <Page />
      </main>
    </div>
  );
}