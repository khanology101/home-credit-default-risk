import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { FEATURE_LABELS } from '../context/ApplicantContext';

export default function ShapChart({ factors }) {
  if (!factors || factors.length === 0) return null;

const data = factors.slice(0, 8).map(f => ({
  name : FEATURE_LABELS[f.feature] || f.feature,
  shap : parseFloat(f.shap_value.toFixed(4)),
  value: f.feature_value,
}));

  return (
    <ResponsiveContainer width="100%" height={280}>
      <BarChart data={data} layout="vertical" margin={{ left: 20, right: 30 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="name" tick={{ fontSize: 11 }} width={160} />
        <Tooltip
          formatter={(val, name, props) =>
            [`SHAP: ${val}  |  Value: ${props.payload.value?.toFixed(3)}`, props.payload.name]
          }
        />
        <Bar dataKey="shap" radius={[0, 4, 4, 0]}>
          {data.map((d, i) => (
            <Cell key={i} fill={d.shap > 0 ? '#e74c3c' : '#2ecc71'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}