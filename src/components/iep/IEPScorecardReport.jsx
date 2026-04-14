import { useMemo } from "react";
import { X } from "lucide-react";

function effColor(val) {
  if (val == null) return "text-slate-400";
  return val >= 90 ? "text-green-600 font-bold" : "text-red-600 font-bold";
}

function fmt(val) {
  if (val == null || val === "") return "—";
  const n = parseFloat(val);
  return isNaN(n) ? "—" : n % 1 === 0 ? n.toString() : n.toFixed(1);
}

export default function IEPScorecardReport({ report, onClose }) {
  const systems = useMemo(() =>
    [...(report.systems || [])].sort((a, b) => (b.effPctProj ?? b.effPct ?? -999) - (a.effPctProj ?? a.effPct ?? -999)),
    [report]
  );

  return (
    <div className="fixed inset-0 bg-black/50 z-50 overflow-y-auto" onClick={onClose}>
      <div className="min-h-screen flex items-start justify-center p-4 py-8">
        <div className="bg-white w-full max-w-5xl rounded-2xl shadow-2xl" onClick={e => e.stopPropagation()}>

          {/* Header */}
          <div className="flex items-start justify-between p-8 pb-0">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-slate-800" style={{ fontFamily: "serif" }}>
                IEP Efficiency Scorecard — {report.title}
              </h1>
              <p className="text-sm text-slate-500 mt-1">
                Ordering these sets counts against your efficiency score. Procedures completed vs. total expected usage determines Eff score.
              </p>
              {report.notes && (
                <p className="text-xs text-slate-400 mt-1 italic">{report.notes}</p>
              )}
            </div>
            <div className="flex items-start gap-4 ml-6">
              <div className="text-right border-2 border-red-500 rounded-lg p-4 min-w-[120px] text-center">
                <p className="text-[10px] font-bold text-red-500 uppercase tracking-widest mb-1">OVERALL SCORE</p>
                <p className="text-5xl font-extrabold text-red-500">
                  {report.overallScore != null ? report.overallScore.toFixed(1) : "—"}
                </p>
              </div>
              <button onClick={onClose} className="text-slate-400 hover:text-slate-600 mt-1">
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="overflow-x-auto mt-6">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ backgroundColor: "#1e3a5f" }}>
                  {["Set ID", "Set Name", "Cons Exp Usage Proj", "Loaner Exp Usage Proj", "Total Exp Usage Proj", "Proc Cmpl Proj", "Eff Proj"].map((col, i) => (
                    <th key={col}
                      className={`py-3 px-4 text-white text-xs font-semibold ${i === 0 || i === 1 ? "text-left" : "text-center"}`}
                      style={{ borderRight: "1px solid #2d4f7a" }}>
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {systems.map((s, i) => {
                  const effVal = s.effPctProj ?? s.effPct;
                  return (
                    <tr key={s.id || i} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}
                      style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td className="px-4 py-2.5 text-xs text-slate-500 font-mono whitespace-nowrap"
                        style={{ borderRight: "1px solid #e2e8f0" }}>{s.systemName || "—"}</td>
                      <td className="px-4 py-2.5 text-sm text-slate-700"
                        style={{ borderRight: "1px solid #e2e8f0" }}>{s.systemName || "—"}</td>
                      <td className="px-4 py-2.5 text-center text-slate-600"
                        style={{ borderRight: "1px solid #e2e8f0" }}>{fmt(s.consExpUsageProj ?? s.consExpUsage)}</td>
                      <td className="px-4 py-2.5 text-center text-slate-600"
                        style={{ borderRight: "1px solid #e2e8f0" }}>{fmt(s.loanerExpUsageProj ?? s.loanerExpUsage)}</td>
                      <td className="px-4 py-2.5 text-center text-slate-600"
                        style={{ borderRight: "1px solid #e2e8f0" }}>{fmt(s.totalExpUsageProj ?? s.totalExpUsage)}</td>
                      <td className="px-4 py-2.5 text-center text-slate-600"
                        style={{ borderRight: "1px solid #e2e8f0" }}>{fmt(s.procCmplProj ?? s.procCmpl)}</td>
                      <td className={`px-4 py-2.5 text-center ${effColor(effVal)}`}>{effVal != null ? effVal.toFixed(1) : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer */}
          <div className="p-6 pt-4 text-xs text-slate-400 italic">
            Eff Proj = Projected Procedures Completed / Total Expected Usage Proj × 100 | Red = below 90 | Green = 90 or above | {report.title}
          </div>
        </div>
      </div>
    </div>
  );
}