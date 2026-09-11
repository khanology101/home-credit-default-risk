export default function StatCard({ title, value, subtitle, color = "primary" }) {
  const colors = {
    primary: "border-blue-900  text-blue-900",
    success: "border-green-500 text-green-600",
    warning: "border-yellow-500 text-yellow-600",
    danger : "border-red-500   text-red-600",
  };
  return (
    <div className={`bg-white rounded-xl shadow p-5 border-l-4 ${colors[color]}`}>
      <p className="text-xs uppercase tracking-widest text-gray-400 mb-1">{title}</p>
      <p className={`text-3xl font-bold ${colors[color].split(' ')[1]}`}>{value}</p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );
}