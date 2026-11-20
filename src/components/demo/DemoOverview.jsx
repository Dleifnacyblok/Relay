import { useMemo } from "react";
import { formatCurrency } from "@/components/loaners/loanerUtils";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { Package, AlertTriangle, Clock, DollarSign, AlertCircle } from "lucide-react";

const TONES = {
  red: "bg-red-50 text-red-600",
  amber: "bg-amber-50 text-amber-600",
  slate: "bg-slate-100 text-slate-600",
  indigo: "bg-indigo-50 text-indigo-600",
};

function Kpi({ icon: Icon, label, value, tone }) {
  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${TONES[tone] || TONES.slate}`}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-2xl font-bold text-slate-900 leading-none">{value}</p>
      <p className="text-xs text-slate-500 mt-1">{label}</p>
    </div>
  );
}

export default function DemoOverview({ loaners, missingParts }) {
  const active = useMemo(
    () => loaners.filter((l) => l.returnStatus !== "sent_back" && l.returnStatus !== "received"),
    [loaners]
  );
  const overdue = active.filter((l) => l.risk_status === "Overdue");
  const dueSoon = active.filter((l) => l.risk_status === "Due Soon");
  const fines = active.reduce((s, l) => (l.feesWaived ? s : s + (l.fineAmount || 0)), 0);
  const activeParts = missingParts.filter(
    (p) => p.status === "missing" && p.returnStatus !== "sent_back" && p.returnStatus !== "received"
  );
  const partFines = activeParts.reduce((s, p) => s + (p.fineAmount || 0), 0);

  const byRep = useMemo(() => {
    const map = {};
    overdue.forEach((l) => { const k = l.repName || "Unassigned"; map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  }, [overdue]);

  const topSets = useMemo(() => {
    const map = {};
    overdue.forEach((l) => { const k = l.setName || "Unknown"; map[k] = (map[k] || 0) + 1; });
    return Object.entries(map).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6);
  }, [overdue]);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <Kpi icon={Package} label="Active Loaners" value={active.length} tone="indigo" />
        <Kpi icon={AlertTriangle} label="Overdue" value={overdue.length} tone="red" />
        <Kpi icon={Clock} label="Due Soon" value={dueSoon.length} tone="amber" />
        <Kpi icon={DollarSign} label="Fine Exposure" value={formatCurrency(fines)} tone="red" />
        <Kpi icon={AlertCircle} label="Missing Parts" value={activeParts.length} tone="amber" />
        <Kpi icon={DollarSign} label="Part Fines" value={formatCurrency(partFines)} tone="red" />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Overdue by Rep</h3>
          {byRep.length ? (
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={byRep} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f1f5f9" />
                <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Bar dataKey="count" fill="#ef4444" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-slate-400 py-12 text-center">No overdue loaners</p>
          )}
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
          <h3 className="text-sm font-semibold text-slate-900 mb-4">Top Overdue Sets</h3>
          {topSets.length ? (
            <ul className="divide-y divide-slate-100">
              {topSets.map((s) => (
                <li key={s.name} className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-slate-700 truncate pr-3">{s.name}</span>
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-700 shrink-0">{s.count}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-slate-400 py-12 text-center">No overdue sets</p>
          )}
        </div>
      </div>
    </div>
  );
}