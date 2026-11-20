import { useMemo } from "react";
import { formatCurrency } from "@/components/loaners/loanerUtils";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
  PieChart, Pie, Cell, Legend,
} from "recharts";

const COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#10b981", "#8b5cf6"];

export default function DemoAnalytics({ loaners, missingParts }) {
  const finesByRep = useMemo(() => {
    const map = {};
    loaners
      .filter((l) => l.returnStatus !== "sent_back" && l.returnStatus !== "received" && !l.feesWaived)
      .forEach((l) => {
        const k = l.repName || "Unassigned";
        map[k] = (map[k] || 0) + (l.fineAmount || 0);
      });
    return Object.entries(map)
      .map(([name, fines]) => ({ name, fines }))
      .filter((x) => x.fines > 0)
      .sort((a, b) => b.fines - a.fines)
      .slice(0, 8);
  }, [loaners]);

  const partsByStatus = useMemo(() => {
    const map = {};
    missingParts.forEach((p) => {
      const k = p.status || "missing";
      map[k] = (map[k] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [missingParts]);

  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Fine Exposure by Rep</h3>
        {finesByRep.length ? (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={finesByRep} layout="vertical" margin={{ left: 8, right: 16 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
              <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={(v) => formatCurrency(v)} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
              <Tooltip formatter={(v) => formatCurrency(v)} />
              <Bar dataKey="fines" fill="#6366f1" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-slate-400 py-16 text-center">No fine exposure</p>
        )}
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <h3 className="text-sm font-semibold text-slate-900 mb-4">Missing Parts by Status</h3>
        {partsByStatus.length ? (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie data={partsByStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                {partsByStatus.map((entry, i) => (
                  <Cell key={entry.name} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-slate-400 py-16 text-center">No missing parts</p>
        )}
      </div>
    </div>
  );
}