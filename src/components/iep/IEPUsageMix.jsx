import { useMemo } from "react";
import { Layers } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";

export default function IEPUsageMix({ systems }) {
  const data = useMemo(() => {
    return systems
      .map((s) => {
        const cons = s.consExpUsage ?? 0;
        const loaner = s.loanerExpUsage ?? 0;
        const name = s.systemName || "—";
        return {
          label: name.length > 14 ? `${name.slice(0, 14)}…` : name,
          fullName: name,
          Consignment: cons,
          Loaner: loaner,
          total: cons + loaner,
        };
      })
      .filter((r) => r.total > 0)
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
  }, [systems]);

  if (!data.length) return null;

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <Layers className="w-4 h-4 text-blue-500" />
        <h3 className="text-sm font-semibold text-slate-700">Expected Usage Mix</h3>
      </div>
      <p className="text-xs text-slate-400 mb-3">
        Top systems by expected procedures, split between consignment and loaner demand.
      </p>
      <ResponsiveContainer width="100%" height={Math.max(180, data.length * 30)}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 12, left: 4, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
          <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} />
          <YAxis type="category" dataKey="label" tick={{ fontSize: 10, fill: "#64748b" }} width={78} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const row = payload[0].payload;
              return (
                <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-lg text-xs">
                  <p className="font-semibold text-slate-800 mb-1">{row.fullName}</p>
                  <p className="text-slate-500">Consignment: {row.Consignment.toFixed(1)}</p>
                  <p className="text-slate-500">Loaner: {row.Loaner.toFixed(1)}</p>
                  <p className="text-slate-700 font-medium mt-1">Total expected: {row.total.toFixed(1)}</p>
                </div>
              );
            }}
          />
          <Bar dataKey="Consignment" stackId="u" fill="#8b5cf6" radius={[0, 0, 0, 0]} />
          <Bar dataKey="Loaner" stackId="u" fill="#60a5fa" radius={[0, 3, 3, 0]} />
          <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}