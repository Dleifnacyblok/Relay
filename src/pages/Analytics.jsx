import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { computeLoanerData, formatCurrency } from "@/components/loaners/loanerUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { differenceInDays, parseISO, format } from "date-fns";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, LineChart, Line, ComposedChart, Area,
} from "recharts";
import { TrendingUp, AlertTriangle, Package, DollarSign, Building2, Layers, Download } from "lucide-react";
import AIInsights from "@/components/analytics/AIInsights";
import ConsignmentUtilization from "@/components/analytics/ConsignmentUtilization";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import ExportPDFDialog from "@/components/analytics/ExportPDFDialog";

const COLORS = ["#ef4444", "#f59e0b", "#3b82f6", "#10b981", "#8b5cf6", "#ec4899", "#06b6d4", "#f97316"];

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

const SectionHeader = ({ label }) => (
  <div className="mt-8 mb-3">
    <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400">{label}</h2>
    <div className="h-px bg-slate-100 mt-1" />
  </div>
);

export default function Analytics() {
  const [accountSort, setAccountSort] = useState("overdue");
  const [showExportDialog, setShowExportDialog] = useState(false);

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
          {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
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
  const dueSoonCount = computed.filter(l => l.risk_status === "Due Soon").length;

  // --- Overdue by Rep ---
  const repMap = {};
  computed.forEach(l => {
    const rep = l.repName || "Unknown";
    if (!repMap[rep]) repMap[rep] = { rep, overdue: 0, total: 0, fines: 0 };
    repMap[rep].total++;
    if (l.risk_status === "Overdue") repMap[rep].overdue++;
    repMap[rep].fines += (l.fineAmount || 0);
  });
  const overdueByRep = Object.values(repMap)
    .filter(r => r.total > 0)
    .sort((a, b) => b.overdue - a.overdue)
    .slice(0, 10);

  // --- Overdue by Account ---
  const accountMap = {};
  computed.forEach(l => {
    const acct = l.accountName || "Unknown";
    if (!accountMap[acct]) accountMap[acct] = { account: acct, overdue: 0, dueSoon: 0, total: 0, fines: 0 };
    accountMap[acct].total++;
    if (l.risk_status === "Overdue") accountMap[acct].overdue++;
    if (l.risk_status === "Due Soon") accountMap[acct].dueSoon++;
    accountMap[acct].fines += (l.fineAmount || 0);
  });
  const accountData = Object.values(accountMap)
    .filter(a => a.total > 0)
    .sort((a, b) => accountSort === "fines" ? b.fines - a.fines : b.overdue - a.overdue)
    .slice(0, 10)
    .map(a => ({ ...a, account: a.account.length > 20 ? a.account.slice(0, 20) + "…" : a.account }));

  // --- Overdue by Set Name ---
  const setMap = {};
  computed.forEach(l => {
    const setName = l.setName || "Unknown";
    if (!setMap[setName]) setMap[setName] = { setName, overdue: 0, total: 0, fines: 0 };
    setMap[setName].total++;
    if (l.risk_status === "Overdue") setMap[setName].overdue++;
    setMap[setName].fines += (l.fineAmount || 0);
  });
  const topOverdueSets = Object.values(setMap)
    .filter(s => s.overdue > 0)
    .sort((a, b) => b.overdue - a.overdue)
    .slice(0, 10)
    .map(s => ({ ...s, setName: s.setName.length > 22 ? s.setName.slice(0, 22) + "…" : s.setName }));

  // --- Return Rate Over Time (by expected return month) ---
  const returnRateMap = {};
  computed.forEach(l => {
    if (!l.expectedReturnDate) return;
    const month = format(parseISO(l.expectedReturnDate), "MMM yy");
    const _date = parseISO(l.expectedReturnDate);
    if (!returnRateMap[month]) returnRateMap[month] = { month, total: 0, returned: 0, _date };
    returnRateMap[month].total++;
    if (l.returnStatus === "sent_back" || l.returnStatus === "received") returnRateMap[month].returned++;
  });
  const returnRateData = Object.values(returnRateMap)
    .sort((a, b) => a._date - b._date)
    .slice(-12)
    .map(({ _date, ...rest }) => ({
      ...rest,
      rate: rest.total > 0 ? Math.round((rest.returned / rest.total) * 100) : 0,
    }));

  // --- Monthly loan volume by loanedDate ---
  const monthMap = {};
  computed.forEach(l => {
    if (!l.loanedDate) return;
    const month = format(parseISO(l.loanedDate), "MMM yy");
    if (!monthMap[month]) monthMap[month] = { month, total: 0, overdue: 0, dueSoon: 0, _date: parseISO(l.loanedDate) };
    monthMap[month].total++;
    if (l.risk_status === "Overdue") monthMap[month].overdue++;
    if (l.risk_status === "Due Soon") monthMap[month].dueSoon++;
  });
  const monthlyData = Object.values(monthMap)
    .sort((a, b) => a._date - b._date)
    .slice(-12)
    .map(({ _date, ...rest }) => rest);

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
    .map(r => ({ rep: r.rep, fines: r.fines }))
    .filter(r => r.fines > 0)
    .sort((a, b) => b.fines - a.fines)
    .slice(0, 8);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pb-24">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-lg bg-indigo-100">
                <TrendingUp className="w-5 h-5 text-indigo-600" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Analytics</h1>
            </div>
            <Button onClick={() => setShowExportDialog(true)} variant="outline" className="gap-2">
              <Download className="w-4 h-4" />
              Export PDF
            </Button>
            <ExportPDFDialog open={showExportDialog} onClose={() => setShowExportDialog(false)} loaners={computed} />
          </div>
          <p className="text-slate-500 ml-12">Loaner performance, overdue frequency & missing parts insights</p>
        </div>

        {/* KPIs */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
          <KpiCard title="Total Loaners" value={totalLoaners} icon={Package}
            color={{ bg: "bg-white", border: "border-slate-200", text: "text-slate-900", iconBg: "bg-slate-100", iconText: "text-slate-600" }} />
          <KpiCard title="Overdue Rate" value={`${overdueRate}%`} sub={`${overdueCount} of ${totalLoaners}`} icon={AlertTriangle}
            color={{ bg: "bg-red-50", border: "border-red-200", text: "text-red-700", iconBg: "bg-red-100", iconText: "text-red-600" }} />
          <KpiCard title="Total Fines" value={formatCurrency(totalFines)} icon={DollarSign}
            color={{ bg: "bg-amber-50", border: "border-amber-200", text: "text-amber-700", iconBg: "bg-amber-100", iconText: "text-amber-600" }} />
          <KpiCard title="Missing Parts" value={activeMissingParts} sub="currently active" icon={Package}
            color={{ bg: "bg-orange-50", border: "border-orange-200", text: "text-orange-700", iconBg: "bg-orange-100", iconText: "text-orange-600" }} />
        </div>

        {/* ── RETURN PERFORMANCE OVER TIME ── */}
        <SectionHeader label="Return Performance Over Time" />
        <div className="grid gap-5 md:grid-cols-2">

          {/* Return Rate Over Time */}
          <Card className="p-5 bg-white border-slate-200 md:col-span-2">
            <h2 className="text-sm font-semibold text-slate-700 mb-1">Return Rate Over Time</h2>
            <p className="text-xs text-slate-400 mb-4">% of loaners returned by their expected return month</p>
            {returnRateData.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-12">No return date data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <ComposedChart data={returnRateData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis yAxisId="left" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 11 }} unit="%" domain={[0, 100]} />
                  <Tooltip formatter={(v, name) => name === "Return Rate" ? `${v}%` : v} />
                  <Legend />
                  <Bar yAxisId="left" dataKey="total" fill="#e2e8f0" radius={[4, 4, 0, 0]} name="Total Due" barSize={28} />
                  <Bar yAxisId="left" dataKey="returned" fill="#10b981" radius={[4, 4, 0, 0]} name="Returned" barSize={28} />
                  <Line yAxisId="right" type="monotone" dataKey="rate" stroke="#6366f1" strokeWidth={2} dot={{ r: 4 }} name="Return Rate" />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Monthly Volume Trend */}
          <Card className="p-5 bg-white border-slate-200 md:col-span-2">
            <h2 className="text-sm font-semibold text-slate-700 mb-1">Monthly Loan Volume & Overdue/Due-Soon by Loan Date</h2>
            <p className="text-xs text-slate-400 mb-4">Active loaners grouped by the month they were loaned out</p>
            {monthlyData.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-12">No dated loan data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <ComposedChart data={monthlyData} barSize={24}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="month" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total" fill="#e2e8f0" radius={[4, 4, 0, 0]} name="Total Loaned" />
                  <Bar dataKey="dueSoon" fill="#f59e0b" radius={[4, 4, 0, 0]} name="Due Soon" />
                  <Bar dataKey="overdue" fill="#ef4444" radius={[4, 4, 0, 0]} name="Overdue" />
                </ComposedChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Risk Status Pie */}
          <Card className="p-5 bg-white border-slate-200">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Current Status Breakdown</h2>
            {riskPieData.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-12">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie data={riskPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}
                    label={({ name, percent }) => `${name} ${Math.round(percent * 100)}%`} labelLine={false}>
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
        </div>

        {/* ── HIGHEST OVERDUE FREQUENCY ── */}
        <SectionHeader label="Highest Overdue Frequency" />
        <div className="grid gap-5 md:grid-cols-2">

          {/* Overdue by Account */}
          <Card className="p-5 bg-white border-slate-200 md:col-span-2">
            <div className="flex items-center justify-between mb-1">
              <div>
                <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-slate-500" /> Overdue Frequency by Account
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">Accounts with the most active overdue loaners</p>
              </div>
              <div className="flex gap-1">
                <button onClick={() => setAccountSort("overdue")}
                  className={`text-xs px-2 py-1 rounded-md font-medium transition-colors ${accountSort === "overdue" ? "bg-red-100 text-red-700" : "text-slate-400 hover:bg-slate-100"}`}>
                  By Overdue
                </button>
                <button onClick={() => setAccountSort("fines")}
                  className={`text-xs px-2 py-1 rounded-md font-medium transition-colors ${accountSort === "fines" ? "bg-amber-100 text-amber-700" : "text-slate-400 hover:bg-slate-100"}`}>
                  By Fines
                </button>
              </div>
            </div>
            {accountData.filter(a => a.overdue > 0 || a.dueSoon > 0).length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-12">No overdue accounts</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={accountData} layout="vertical" barSize={14}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="account" tick={{ fontSize: 11 }} width={140} />
                  <Tooltip formatter={(v, name) => name === "fines" ? formatCurrency(v) : v} />
                  <Legend />
                  <Bar dataKey="overdue" fill="#ef4444" radius={[0, 4, 4, 0]} name="Overdue" stackId="a" />
                  <Bar dataKey="dueSoon" fill="#f59e0b" radius={[0, 4, 4, 0]} name="Due Soon" stackId="a" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>

          {/* Overdue by Set Name */}
          <Card className="p-5 bg-white border-slate-200 md:col-span-2">
            <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2 mb-1">
              <Layers className="w-4 h-4 text-slate-500" /> Sets with Highest Overdue Count
            </h2>
            <p className="text-xs text-slate-400 mb-4">Which loaner sets are most frequently overdue</p>
            {topOverdueSets.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-12">No overdue sets</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                      <th className="pb-2 font-medium">#</th>
                      <th className="pb-2 font-medium">Set Name</th>
                      <th className="pb-2 font-medium text-center">Total</th>
                      <th className="pb-2 font-medium text-center text-red-500">Overdue</th>
                      <th className="pb-2 font-medium text-right text-amber-500">Fines</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topOverdueSets.map((s, i) => (
                      <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                        <td className="py-2 text-slate-300 font-mono">{i + 1}</td>
                        <td className="py-2 font-medium text-slate-800">{s.setName}</td>
                        <td className="py-2 text-center text-slate-500">{s.total}</td>
                        <td className="py-2 text-center">
                          <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-red-100 text-red-700 text-xs font-bold">{s.overdue}</span>
                        </td>
                        <td className="py-2 text-right font-medium text-amber-700">{formatCurrency(s.fines)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>

          {/* Overdue by Rep */}
          <Card className="p-5 bg-white border-slate-200 md:col-span-2">
            <h2 className="text-sm font-semibold text-slate-700 mb-4">Overdue Loaners by Representative</h2>
            {overdueByRep.length === 0 ? (
              <p className="text-sm text-slate-400 text-center py-12">No overdue loaners</p>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, overdueByRep.length * 32)}>
                <BarChart data={overdueByRep} layout="vertical" barSize={16}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 11 }} allowDecimals={false} />
                  <YAxis type="category" dataKey="rep" tick={{ fontSize: 11 }} width={110} />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="total" fill="#e2e8f0" radius={[0, 4, 4, 0]} name="Total" />
                  <Bar dataKey="overdue" fill="#ef4444" radius={[0, 4, 4, 0]} name="Overdue" />
                </BarChart>
              </ResponsiveContainer>
            )}
          </Card>
        </div>

        {/* ── TERRITORY CONSIGNMENT UTILIZATION ── */}
        <SectionHeader label="Territory Consignment Utilization" />
        <p className="text-xs text-slate-400 -mt-2 mb-4">Active loaners cross-referenced against your consigned territory sets — identify displaced & overdue inventory</p>
        <ConsignmentUtilization computed={computed} />

        {/* ── MISSING PARTS & FINES ── */}
        <SectionHeader label="Missing Parts & Fines" />
        <div className="grid gap-5 md:grid-cols-2">

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

          {/* AI Insights */}
          <AIInsights analyticsData={{
            totalLoaners, overdueCount, overdueRate, dueSoonCount, totalFines, activeMissingParts,
            overdueByRep, durationData, topMissingParts, finesByRep,
            topOverdueSets: topOverdueSets.slice(0, 5),
            topOverdueAccounts: accountData.slice(0, 5),
          }} />
        </div>
      </div>
    </div>
  );
}