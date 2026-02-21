import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { computeLoanerData, formatCurrency } from "@/components/loaners/loanerUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { differenceInDays, parseISO } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from "recharts";
import { TrendingUp, AlertTriangle, Package, DollarSign } from "lucide-react";

const COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

export default function Analytics() {
  const { data: loaners = [], isLoading: loadingLoaners } = useQuery({
    queryKey: ["loaners"],
    queryFn: () => base44.entities.Loaners.list(),
  });

  const { data: missingParts = [], isLoading: loadingParts } = useQuery({
    queryKey: ["missingParts"],
    queryFn: () => base44.entities.MissingPart.list(),
  });

  const isLoading = loadingLoaners || loadingParts;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-5xl mx-auto space-y-4">
          <Skeleton className="h-10 w-48" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
          {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const computed = loaners.map(computeLoanerData);

  // --- KPIs ---
  const totalLoaners = computed.length;
  const overdueCount = computed.filter(l => l.risk_status === "Overdue").length;
  const overdueRate = totalLoaners > 0 ? Math.round((overdueCount / totalLoaners) * 100) : 0;
  const totalFines = computed.reduce((s, l) => s + (l.fineAmount || 0), 0);
  const activeMissingParts = missingParts.filter(p => p.status === "missing").length;

  // --- Overdue by Rep ---
  const repMap = {};
  computed.forEach(l => {
    const rep = l.repName || "Unknown";
    if (!repMap[rep]) repMap[rep] = { rep, overdue: 0, total: 0 };
    repMap[rep].total++;
    if (l.risk_status === "Overdue") repMap[rep].overdue++;
  });
  const overdueByRep = Object.values(repMap)
    .filter(r => r.total > 0)
    .sort((a, b) => b.overdue - a.overdue)
    .slice(0, 10);

  // --- Loan Duration Distribution ---
  const durationBuckets = { "0-7d": 0, "8-14d": 0, "15-30d": 0, "31-60d": 0, "60d+": 0 };
  computed.forEach(l => {
    if (!l.loanedDate) return;
    const days = differenceInDays(new Date(), parseISO(l.loanedDate));
    if (days <= 7) durationBuckets["0-7d"]++;
    else if (days <= 14) durationBuckets["8-14d"]++;
    else if (days <= 30) durationBuckets["15-30d"]++;
    else if (days <= 60) durationBuckets["31-60d"]++;
    else durationBuckets["60d+"]++;
  });
  const durationData = Object.entries(durationBuckets).map(([range, count]) => ({ range, count }));

  // --- Risk Status Pie ---
  const riskCounts = { Safe: 0, "Due Soon": 0, Overdue: 0 };
  computed.forEach(l => { if (riskCounts[l.risk_status] !== undefined) riskCounts[l.risk_status]++; });
  const riskPieData = [
    { name: "Safe", value: riskCounts["Safe"], color: "#10b981" },
    { name: "Due Soon", value: riskCounts["Due Soon"], color: "#f59e0b" },
    { name: "Overdue", value: riskCounts["Overdue"], color: "#ef4444" },
  ].filter(d => d.value > 0);

  // --- Common Missing Parts ---
  const partCounts = {};
  missingParts.filter(p => p.status === "missing").forEach(p => {
    const name = p.partName || "Unknown";
    partCounts[name] = (partCounts[name] || 0) + (p.missingQuantity || 1);
  });
  const topMissingParts = Object.entries(partCounts)
    .map(([name, count]) => ({ name: name.length > 22 ? name.slice(0, 22) + "…" : name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);

  // --- Fines by Rep ---
  const finesByRep = Object.values(repMap)
    .map(r => ({ rep: r.rep, fines: computed.filter(l => l.repName === r.rep).reduce((s, l) => s + (l.fineAmount || 0), 0) }))
    .filter(r => r.fines > 0)
    .sort((a, b) => b.fines - a.fines)
    .slice(0, 8);

  const KpiCard = ({ title, value, sub, icon: Icon, color }) => (
    <Card className={`p-4 border ${color.border} ${color.bg}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-medium text-slate-500 mb-1">{title}</p>
          <p className={`text-2xl font-bold ${color.text}`}>{value}</p>
          {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
        </div>
        <div className={`p-2 rounded-lg ${color.iconBg}`}>
          <Icon className={`w-5 h-5 ${color.iconText}`} />
        </div>
      </div>
    </Card>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pb-24">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-indigo-100">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Analytics</h1>
          </div>
          <p className="text-slate-500 ml-12">Loaner trends, overdue rates, and missing parts insights</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
          <KpiCard title="Total Loaners" value={totalLoaners} icon={Package}
            color={{ bg: "bg-white", border: "border-slate-200", text: "text-slate-900", iconBg: "bg-slate-100", iconText: "text-slate-600" }} />
          <KpiCard title="Overdue Rate" value={`${overdueRate}%`} sub={`${overdueCount} of ${totalLoaners}`} icon={AlertTriangle}
            color={{ bg: "bg-red-50", border: "border-red-200", text: "text-red-700", iconBg: "bg-red-100", iconText: "text-red-600" }} />
          <KpiCard title="Total Fines" value={formatCurrency(totalFines)} icon={DollarSign}
            color={{ bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", iconBg: "bg-amber-100", iconText: "text-amber-600" }} />
          <KpiCard title="Missing Parts" value={activeMissingParts} sub="currently active" icon={Package}
            color={{ bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", iconBg: "bg-orange-100", iconText: "text-orange-600" }} />
        </div>

        {/* Charts Grid */}
        <div className="grid gap-5 md:grid-cols-2">

          {/* Risk Status Pie */}
          <Card className="p-5 bg-white border-slate-200">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Loaner Status Breakdown</h2>
            {riskPieData.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-12">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={riskPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`} labelLine={false}>
                    {riskPieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                  </Pie>
                  <Legend />
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Loan Duration Distribution */}
          <Card className="p-5 bg-white border-slate-200">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Loan Duration Distribution</h2>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={durationData} barSize={32}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="range" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip />
                <Bar dataKey="count" fill="#6366f1" radius={[4, 4, 0, 0]} name="Loaners" />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* Overdue by Rep */}
          <Card className="p-5 bg-white border-slate-200 md:col-span-2">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Overdue Loaners by Representative</h2>
            {overdueByRep.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-12">No overdue loaners</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={overdueByRep} layout="vertical" barSize={16}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="rep" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip />
                  <Bar dataKey="overdue" fill="#ef4444" radius={[0, 4, 4, 0]} name="Overdue" />
                  <Bar dataKey="total" fill="#e2e8f0" radius={[0, 4, 4, 0]} name="Total" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Top Missing Parts */}
          <Card className="p-5 bg-white border-slate-200">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Most Common Missing Parts</h2>
            {topMissingParts.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-12">No missing parts</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={topMissingParts} layout="vertical" barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={110} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Quantity" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Fines by Rep */}
          <Card className="p-5 bg-white border-slate-200">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Fine Exposure by Representative</h2>
            {finesByRep.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-12">No fines</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={finesByRep} layout="vertical" barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} tickFormatter={v => `$${v}`} />
                  <YAxis type="category" dataKey="rep" tick={{ fontSize: 10 }} width={110} />
                  <Tooltip formatter={v => formatCurrency(v)} />
                  <Bar dataKey="fines" fill="#8b5cf6" radius={[0, 4, 4, 0]} name="Fines" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

        </div>
      </div>
    </div>
  );
}