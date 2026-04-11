import { useMemo, useState, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { TrendingUp, Upload, Target, Activity, BarChart2, Clock, PackageSearch, MapPin, AlertTriangle, Box, ChevronDown, ChevronUp } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, Legend } from "recharts";

function StatCard({ label, value, sub, icon: Icon, color = "blue", onClick, active }) {
  const colors = {
    blue: "bg-blue-50 text-blue-600",
    green: "bg-green-50 text-green-600",
    yellow: "bg-yellow-50 text-yellow-600",
    red: "bg-red-50 text-red-600",
    purple: "bg-purple-50 text-purple-600",
  };
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border shadow-sm p-5 flex items-start gap-4 transition-all ${
        onClick ? "cursor-pointer hover:shadow-md" : ""
      } ${
        active ? "border-blue-400 ring-1 ring-blue-300" : "border-slate-200"
      }`}
    >
      <div className={`p-2.5 rounded-lg ${colors[color]}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
        <p className="text-2xl font-bold text-slate-900 mt-0.5">{value}</p>
        {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
      </div>
    </div>
  );
}

function EffBadge({ val }) {
  if (val === null || val === undefined) return <span className="text-slate-400">—</span>;
  const pct = typeof val === "number" ? val : parseFloat(val);
  if (pct >= 100) return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">{pct.toFixed(1)}%</span>;
  if (pct >= 70) return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">{pct.toFixed(1)}%</span>;
  return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">{pct.toFixed(1)}%</span>;
}

function ScoreCell({ val }) {
  if (val === null || val === undefined) return <span className="text-slate-400">—</span>;
  const n = typeof val === "number" ? val : parseFloat(val);
  if (isNaN(n)) return <span className="text-slate-400">—</span>;
  return <span className={n < 0 ? "text-red-600 font-medium" : "text-green-700 font-medium"}>{n.toFixed(2)}</span>;
}

function fmt(val) {
  if (val === null || val === undefined || val === "") return "—";
  const n = typeof val === "number" ? val : parseFloat(val);
  return isNaN(n) ? "—" : n.toFixed(1);
}

export default function IEPDashboard() {
  const { data: systems = [], isLoading } = useQuery({
    queryKey: ["iepSystemData"],
    queryFn: () => base44.entities.IEPSystemData.list(),
  });

  const { data: allLoaners = [] } = useQuery({
    queryKey: ["loaners"],
    queryFn: () => base44.entities.Loaners.list(),
  });

  const sorted = useMemo(() =>
    [...systems].sort((a, b) => (b.effPct ?? -999) - (a.effPct ?? -999)),
    [systems]
  );

  const avgEffPct = useMemo(() => {
    const vals = systems.filter(s => s.effPct != null).map(s => s.effPct);
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  }, [systems]);

  const aboveTarget = useMemo(() => systems.filter(s => s.effPct != null && s.effPct >= 100).length, [systems]);
  const belowTarget = useMemo(() => systems.filter(s => s.effPct != null && s.effPct < 70).length, [systems]);

  const lastImport = useMemo(() => {
    const dates = systems.filter(s => s.importedAt).map(s => new Date(s.importedAt));
    if (!dates.length) return null;
    return new Date(Math.max(...dates));
  }, [systems]);

  const [tableFilter, setTableFilter] = useState(null);
  const tableRef = useRef(null);
  const [modalFilter, setModalFilter] = useState(null);
  const [selectedSystem, setSelectedSystem] = useState(null); // null | 'above' | 'below'

  const handleCardClick = (filter) => {
    setModalFilter(filter);
  };

  const modalSystems = useMemo(() => {
    if (modalFilter === "above") return sorted.filter(s => s.effPct != null && s.effPct >= 100);
    if (modalFilter === "below") return sorted.filter(s => s.effPct != null && s.effPct < 70);
    return [];
  }, [sorted, modalFilter]);

  const filteredSystems = useMemo(() => {
    if (tableFilter === "above") return sorted.filter(s => s.effPct != null && s.effPct >= 100);
    if (tableFilter === "below") return sorted.filter(s => s.effPct != null && s.effPct < 70);
    return sorted;
  }, [sorted, tableFilter]);

  const iepSystemNames = useMemo(() =>
    new Set(systems.map(s => s.systemName?.toLowerCase().trim())),
    [systems]
  );

  const iepAffectedLoaners = useMemo(() =>
    allLoaners.filter(l =>
      l.setName && iepSystemNames.has(l.setName.toLowerCase().trim()) &&
      l.returnStatus !== "received"
    ),
    [allLoaners, iepSystemNames]
  );

  const iepOverdue = useMemo(() => iepAffectedLoaners.filter(l => l.isOverdue), [iepAffectedLoaners]);
  const iepDueSoon = useMemo(() => iepAffectedLoaners.filter(l => !l.isOverdue && l.daysUntilDue != null && l.daysUntilDue <= 7), [iepAffectedLoaners]);

  const repChartData = useMemo(() => {
    const map = {};
    iepAffectedLoaners.forEach(l => {
      const rep = l.repName || l.fieldSalesRep || "Unknown";
      if (!map[rep]) map[rep] = { rep, total: 0, overdue: 0, dueSoon: 0, loaners: [] };
      map[rep].total++;
      if (l.isOverdue) map[rep].overdue++;
      else if (l.daysUntilDue != null && l.daysUntilDue <= 7) map[rep].dueSoon++;
      map[rep].loaners.push(l);
    });
    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [iepAffectedLoaners]);

  const [expandedIepCard, setExpandedIepCard] = useState(null);
  const [top10Open, setTop10Open] = useState(false);
  const [bottom10Open, setBottom10Open] = useState(false);
  const [allTableOpen, setAllTableOpen] = useState(false);

  const top10 = useMemo(() =>
    sorted.slice(0, 10).map(s => ({
      name: s.systemName?.length > 16 ? s.systemName.slice(0, 16) + "…" : s.systemName,
      effPct: s.effPct ?? 0,
    })),
    [sorted]
  );

  const bottom10 = useMemo(() =>
    [...sorted].reverse().slice(0, 10),
    [sorted]
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!systems.length) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-6">
        <div className="text-center max-w-sm">
          <div className="w-16 h-16 bg-purple-100 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <TrendingUp className="w-8 h-8 text-purple-500" />
          </div>
          <h2 className="text-xl font-bold text-slate-800 mb-2">No IEP Data Yet</h2>
          <p className="text-slate-500 text-sm mb-6">Import a Globus Grid 6 efficiency report to populate this dashboard.</p>
          <Link to="/IEPImport"
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors">
            <Upload className="w-4 h-4" /> Upload IEP Report
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-100">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">IEP Efficiency Dashboard</h1>
              <p className="text-xs text-slate-400 mt-0.5">{systems.length} systems tracked</p>
              {lastImport && (
                <p className="text-xs text-slate-400 flex items-center gap-1 mt-0.5">
                  <Clock className="w-3 h-3" />
                  Last updated {lastImport.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                </p>
              )}
            </div>
          </div>
          <Link to="/IEPImport"
            className="inline-flex items-center gap-2 px-4 py-2 border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 rounded-lg text-sm font-medium transition-colors shadow-sm">
            <Upload className="w-4 h-4" /> Re-import Data
          </Link>
        </div>

        {/* Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <StatCard label="Territory Avg Eff %" value={avgEffPct != null ? `${avgEffPct.toFixed(1)}%` : "—"} icon={Activity} color="purple" sub="across all systems" />
          <StatCard label="Above Target (≥100%)" value={aboveTarget} icon={Target} color="green" sub={`${((aboveTarget / systems.length) * 100).toFixed(0)}% of systems`} onClick={() => handleCardClick("above")} active={tableFilter === "above"} />
          <StatCard label="Below Target (<70%)" value={belowTarget} icon={Target} color="red" sub={`${((belowTarget / systems.length) * 100).toFixed(0)}% of systems`} onClick={() => handleCardClick("below")} active={tableFilter === "below"} />
        </div>

        {/* Modal for above/below target set names */}
        {modalFilter && (
          <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => { setModalFilter(null); setSelectedSystem(null); }}>
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>

              {/* Detail view */}
              {selectedSystem ? (
                <>
                  <div className="flex items-center gap-3 mb-5">
                    <button onClick={() => setSelectedSystem(null)} className="text-slate-400 hover:text-slate-700 text-sm flex items-center gap-1">← Back</button>
                    <h3 className="font-semibold text-slate-800 text-base flex-1 truncate">{selectedSystem.systemName}</h3>
                    <button onClick={() => { setModalFilter(null); setSelectedSystem(null); }} className="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
                  </div>
                  <div className="overflow-y-auto space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: "Eff %", value: selectedSystem.effPct != null ? `${selectedSystem.effPct.toFixed(1)}%` : "—" },
                        { label: "Proj Eff %", value: selectedSystem.effPctProj != null ? `${selectedSystem.effPctProj.toFixed(1)}%` : "—" },
                        { label: "Eff Score", value: selectedSystem.effScore != null ? selectedSystem.effScore.toFixed(2) : "—" },
                        { label: "Proj Eff Score", value: selectedSystem.effScoreProj != null ? selectedSystem.effScoreProj.toFixed(2) : "—" },
                        { label: "System Count", value: fmt(selectedSystem.sysCnt) },
                        { label: "Proc Completed", value: fmt(selectedSystem.procCmpl) },
                        { label: "Proj Proc Cmpl", value: fmt(selectedSystem.procCmplProj) },
                        { label: "Total Exp Usage", value: fmt(selectedSystem.totalExpUsage) },
                        { label: "Proj Exp Usage", value: fmt(selectedSystem.totalExpUsageProj) },
                        { label: "Cons Exp Usage", value: fmt(selectedSystem.consExpUsage) },
                        { label: "Loaner Exp Usage", value: fmt(selectedSystem.loanerExpUsage) },
                      ].map(({ label, value }) => (
                        <div key={label} className="bg-slate-50 rounded-lg px-4 py-3">
                          <p className="text-xs text-slate-400 font-medium uppercase tracking-wide mb-0.5">{label}</p>
                          <p className="text-lg font-bold text-slate-800">{value}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </>
              ) : (
                /* List view */
                <>
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-slate-800">
                      {modalFilter === "above" ? "Above Target (≥100%)" : "Below Target (<70%)"}
                      <span className="ml-2 text-xs font-normal text-slate-400">{modalSystems.length} systems</span>
                    </h3>
                    <button onClick={() => { setModalFilter(null); setSelectedSystem(null); }} className="text-slate-400 hover:text-slate-600 text-lg leading-none">&times;</button>
                  </div>
                  <div className="overflow-y-auto space-y-2">
                    {modalSystems.map((s, i) => (
                      <button key={s.id || i} onClick={() => setSelectedSystem(s)}
                        className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors text-left">
                        <span className="text-sm text-slate-700 font-medium">{s.systemName}</span>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            s.effPct >= 100 ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"
                          }`}>{s.effPct?.toFixed(1)}%</span>
                          <span className="text-slate-300 text-xs">›</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* IEP-Affected Loaners in Territory */}
        {iepAffectedLoaners.length > 0 && (
          <div className="bg-white rounded-xl border border-amber-200 shadow-sm p-6 mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-amber-50">
                <PackageSearch className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-slate-700">IEP-Tracked Sets Currently in Territory</h2>
                <p className="text-xs text-slate-400">{iepAffectedLoaners.length} loaner(s) matching active IEP systems</p>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">Set Name</th>
                    <th className="px-3 py-2 text-left font-medium">Account</th>
                    <th className="px-3 py-2 text-left font-medium">Rep</th>
                    <th className="px-3 py-2 text-left font-medium">Due Date</th>
                    <th className="px-3 py-2 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {iepAffectedLoaners.map((l, i) => (
                    <tr key={l.id || i} className="hover:bg-slate-50">
                      <td className="px-3 py-2.5 font-medium text-slate-800">{l.setName}</td>
                      <td className="px-3 py-2.5 text-slate-600">{l.accountName || "—"}</td>
                      <td className="px-3 py-2.5 text-slate-600">{l.repName || l.fieldSalesRep || "—"}</td>
                      <td className="px-3 py-2.5 text-slate-600">{l.expectedReturnDate || "—"}</td>
                      <td className="px-3 py-2.5 text-center">
                        <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${
                          l.isOverdue ? "bg-red-100 text-red-700" : l.daysUntilDue <= 3 ? "bg-amber-100 text-amber-700" : "bg-green-100 text-green-700"
                        }`}>
                          {l.isOverdue ? `${l.daysOverdue}d overdue` : l.daysUntilDue != null ? `Due in ${l.daysUntilDue}d` : "Active"}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Bar Chart */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
          <button onClick={() => setTop10Open(o => !o)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
            <h2 className="text-sm font-semibold text-slate-700">Top 10 Systems by Eff %</h2>
            {top10Open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {top10Open && (
            <div className="px-6 pb-6">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={top10} margin={{ top: 0, right: 0, left: -20, bottom: 40 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#94a3b8" }} angle={-35} textAnchor="end" interval={0} />
                  <YAxis tick={{ fontSize: 11, fill: "#94a3b8" }} />
                  <Tooltip formatter={(v) => [`${v.toFixed(1)}%`, "Eff %"]} />
                  <Bar dataKey="effPct" radius={[4, 4, 0, 0]}>
                    {top10.map((entry, i) => (
                      <Cell key={i} fill={entry.effPct >= 100 ? "#22c55e" : entry.effPct >= 70 ? "#eab308" : "#ef4444"} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Bottom 10 Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
          <button onClick={() => setBottom10Open(o => !o)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
            <div className="text-left">
              <h2 className="text-sm font-semibold text-slate-700">Bottom 10 Systems by Eff %</h2>
              <p className="text-xs text-slate-400 mt-0.5">Lowest performing systems — needs attention</p>
            </div>
            {bottom10Open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {bottom10Open && (
            <div className="overflow-x-auto border-t border-slate-100">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">#</th>
                    <th className="px-4 py-3 text-left font-medium">System Name</th>
                    <th className="px-4 py-3 text-right font-medium">Sets</th>
                    <th className="px-4 py-3 text-right font-medium">Proc Cmpl</th>
                    <th className="px-4 py-3 text-right font-medium">Expected</th>
                    <th className="px-4 py-3 text-center font-medium">Eff %</th>
                    <th className="px-4 py-3 text-center font-medium">Proj Eff %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {bottom10.map((s, i) => (
                    <tr key={s.id || i} className="hover:bg-red-50 transition-colors">
                      <td className="px-4 py-3 text-slate-300 font-mono text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-medium text-slate-800">{s.systemName}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{fmt(s.sysCnt)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{fmt(s.procCmpl)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{fmt(s.totalExpUsage)}</td>
                      <td className="px-4 py-3 text-center"><EffBadge val={s.effPct} /></td>
                      <td className="px-4 py-3 text-center"><EffBadge val={s.effPctProj} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Table */}
        <div ref={tableRef} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          <button onClick={() => setAllTableOpen(o => !o)}
            className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
            <div className="text-left">
              <h2 className="text-sm font-semibold text-slate-700">
                {tableFilter === "above" ? "Above Target Systems (≥100%)" : tableFilter === "below" ? "Below Target Systems (<70%)" : "All Systems — sorted by Eff % (descending)"}
              </h2>
              {tableFilter && (
                <button onClick={(e) => { e.stopPropagation(); setTableFilter(null); }} className="text-xs text-blue-500 hover:underline mt-0.5">Clear filter</button>
              )}
            </div>
            {allTableOpen ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
          </button>
          {allTableOpen && (
            <div className="overflow-x-auto border-t border-slate-100">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium">System Name</th>
                    <th className="px-4 py-3 text-right font-medium">Sets</th>
                    <th className="px-4 py-3 text-right font-medium">Proc Cmpl</th>
                    <th className="px-4 py-3 text-right font-medium">Expected</th>
                    <th className="px-4 py-3 text-center font-medium">Eff %</th>
                    <th className="px-4 py-3 text-center font-medium">Proj Eff %</th>
                    <th className="px-4 py-3 text-right font-medium">Eff Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredSystems.map((s, i) => (
                    <tr key={s.id || i} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 font-medium text-slate-800">{s.systemName}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{fmt(s.sysCnt)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{fmt(s.procCmpl)}</td>
                      <td className="px-4 py-3 text-right text-slate-600">{fmt(s.totalExpUsage)}</td>
                      <td className="px-4 py-3 text-center"><EffBadge val={s.effPct} /></td>
                      <td className="px-4 py-3 text-center"><EffBadge val={s.effPctProj} /></td>
                      <td className="px-4 py-3 text-right"><ScoreCell val={s.effScore} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* IEP Impact — Territory Set Loaners */}
        {iepAffectedLoaners.length > 0 && (
          <div className="mt-8">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-widest mb-3">IEP Impact — Territory Set Loaners</p>

            {/* Mini stat cards */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { key: "active", label: "Active IEP Loaners", value: iepAffectedLoaners.length, sub: "matching territory sets", icon: MapPin, bg: "bg-purple-50", text: "text-purple-600", border: "border-purple-100", loaners: iepAffectedLoaners },
                { key: "overdue", label: "IEP Overdue", value: iepOverdue.length, sub: "need immediate action", icon: AlertTriangle, bg: "bg-red-50", text: "text-red-500", border: "border-red-100", loaners: iepOverdue },
                { key: "dueSoon", label: "IEP Due Soon", value: iepDueSoon.length, sub: "coming up", icon: Box, bg: "bg-amber-50", text: "text-amber-500", border: "border-amber-100", loaners: iepDueSoon },
              ].map(card => {
                const Icon = card.icon;
                const isOpen = expandedIepCard === card.key;
                return (
                  <div key={card.key} className={`rounded-xl border ${card.border} bg-white shadow-sm overflow-hidden`}>
                    <button onClick={() => setExpandedIepCard(isOpen ? null : card.key)}
                      className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-slate-50 transition-colors">
                      <div className="flex items-center gap-2">
                        <div className={`p-1.5 rounded-lg ${card.bg}`}><Icon className={`w-3.5 h-3.5 ${card.text}`} /></div>
                        <div className="text-left">
                          <p className="text-[10px] text-slate-500 font-medium leading-tight">{card.label}</p>
                          <p className={`text-xl font-bold leading-tight ${card.text}`}>{card.value}</p>
                          <p className="text-[10px] text-slate-400">{card.sub}</p>
                        </div>
                      </div>
                      {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-400 shrink-0" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />}
                    </button>
                    {isOpen && (
                      <div className="border-t border-slate-100 max-h-48 overflow-y-auto">
                        {card.loaners.length === 0 ? (
                          <p className="text-xs text-slate-400 text-center py-3">None</p>
                        ) : card.loaners.map((l, i) => (
                          <div key={l.id || i} className="flex items-center justify-between px-3 py-2 border-b border-slate-50 last:border-0">
                            <div>
                              <p className="text-xs font-medium text-slate-700 leading-tight">{l.setName}</p>
                              <p className="text-[10px] text-slate-400">{l.accountName} · {l.repName || l.fieldSalesRep}</p>
                            </div>
                            <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ml-2 ${
                              l.isOverdue ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
                            }`}>
                              {l.isOverdue ? `${l.daysOverdue}d over` : `${l.daysUntilDue}d`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Rep bar chart */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-center gap-2 mb-1">
                <MapPin className="w-4 h-4 text-purple-500" />
                <h2 className="text-sm font-semibold text-slate-700">IEP-Impacted Loaners by Representative</h2>
              </div>
              <p className="text-xs text-slate-400 mb-4">Reps with active loaners that match IEP set names</p>
              <ResponsiveContainer width="100%" height={Math.max(160, repChartData.length * 32)}>
                <BarChart data={repChartData} layout="vertical" margin={{ top: 0, right: 20, left: 80, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" horizontal={false} />
                  <XAxis type="number" tick={{ fontSize: 10, fill: "#94a3b8" }} />
                  <YAxis type="category" dataKey="rep" tick={{ fontSize: 10, fill: "#64748b" }} width={78} />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload?.length) return null;
                      return (
                        <div className="bg-white border border-slate-200 rounded-lg p-3 shadow-lg text-xs">
                          <p className="font-semibold text-slate-800 mb-1">{label}</p>
                          <p className="text-slate-500">Total IEP : {payload[0]?.value ?? 0}</p>
                          <p className="text-red-500 font-medium">Overdue : {payload[1]?.value ?? 0}</p>
                          <p className="text-amber-500 font-medium">Due Soon : {payload[2]?.value ?? 0}</p>
                        </div>
                      );
                    }}
                  />
                  <Bar dataKey="total" fill="#e2e8f0" radius={[0, 3, 3, 0]} name="Total IEP" />
                  <Bar dataKey="overdue" fill="#ef4444" radius={[0, 3, 3, 0]} name="Overdue" />
                  <Bar dataKey="dueSoon" fill="#f59e0b" radius={[0, 3, 3, 0]} name="Due Soon" />
                  <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11, paddingTop: 8 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}