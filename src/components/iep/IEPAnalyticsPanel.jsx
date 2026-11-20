import { useMemo, useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, Target } from "lucide-react";

const effOf = (s) => s.effPct ?? s.effPctProj ?? null;

function effClass(eff) {
  if (eff == null) return "bg-slate-100 text-slate-500";
  if (eff >= 100) return "bg-green-100 text-green-700";
  if (eff >= 70) return "bg-amber-100 text-amber-700";
  return "bg-red-100 text-red-700";
}

function n1(v) {
  const n = typeof v === "number" ? v : parseFloat(v);
  return isNaN(n) ? "—" : n.toFixed(1);
}

export default function IEPAnalyticsPanel({ systems }) {
  const [showAll, setShowAll] = useState(false);

  const stats = useMemo(() => {
    const rows = systems.map((s) => {
      const usage = s.totalExpUsage ?? 0;
      const proc = s.procCmpl ?? 0;
      return {
        id: s.id,
        name: s.systemName || "—",
        usage,
        proc,
        gap: usage - proc,
        eff: effOf(s),
        cons: s.consExpUsage ?? 0,
        loaner: s.loanerExpUsage ?? 0,
      };
    });

    const totalUsage = rows.reduce((a, r) => a + r.usage, 0);
    const totalProc = rows.reduce((a, r) => a + r.proc, 0);
    const overall = totalUsage > 0 ? (totalProc / totalUsage) * 100 : null;

    const enriched = rows.map((r) => ({
      ...r,
      impact: totalUsage > 0 ? (Math.max(0, r.gap) / totalUsage) * 100 : 0,
      share: totalUsage > 0 ? (r.usage / totalUsage) * 100 : 0,
    }));

    const opportunities = enriched
      .filter((r) => r.impact > 0.001)
      .sort((a, b) => b.impact - a.impact);

    const deficit = enriched.filter((r) => r.gap > 0).reduce((a, r) => a + r.gap, 0);
    const surplus = enriched.filter((r) => r.gap < 0).reduce((a, r) => a - r.gap, 0);

    return { enriched, opportunities, totalUsage, totalProc, overall, deficit, surplus };
  }, [systems]);

  const { opportunities, enriched, overall, deficit, surplus, totalUsage } = stats;
  const maxImpact = opportunities.length ? opportunities[0].impact : 0;

  const tableRows = useMemo(
    () => [...enriched].sort((a, b) => b.impact - a.impact),
    [enriched]
  );

  if (!totalUsage) {
    return (
      <div className="text-center py-8">
        <Target className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">No expected-usage data to analyze yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-slate-50 border border-slate-100 p-3">
          <p className="text-[10px] text-slate-500 font-medium uppercase tracking-wide">Overall</p>
          <p className="text-lg font-bold text-purple-600 leading-tight">
            {overall != null ? `${overall.toFixed(1)}%` : "—"}
          </p>
        </div>
        <div className="rounded-lg bg-red-50 border border-red-100 p-3">
          <p className="text-[10px] text-red-500 font-medium uppercase tracking-wide">Procs short</p>
          <p className="text-lg font-bold text-red-600 leading-tight">{n1(deficit)}</p>
        </div>
        <div className="rounded-lg bg-green-50 border border-green-100 p-3">
          <p className="text-[10px] text-green-600 font-medium uppercase tracking-wide">Pts available</p>
          <p className="text-lg font-bold text-green-700 leading-tight">
            {overall != null ? `+${(100 - overall).toFixed(1)}` : "—"}
          </p>
        </div>
      </div>

      {/* Where to improve */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <AlertTriangle className="w-4 h-4 text-amber-500" />
          <h3 className="text-sm font-semibold text-slate-700">Where to Improve</h3>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          Systems ranked by points they could add to the overall score by reaching 100% efficiency.
        </p>

        {opportunities.length === 0 ? (
          <p className="text-sm text-slate-500 py-3">Every system is at or above its expected usage. No gaps to close.</p>
        ) : (
          <div className="space-y-3">
            {opportunities.slice(0, 8).map((r, i) => (
              <div key={r.id || i} className="flex items-start gap-2.5">
                <span className="w-4 shrink-0 text-[11px] font-semibold text-slate-400 mt-0.5">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs font-medium text-slate-800 truncate">{r.name}</p>
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full shrink-0 ${effClass(r.eff)}`}>
                      {r.eff != null ? `${r.eff.toFixed(0)}%` : "—"}
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-purple-500"
                      style={{ width: `${maxImpact > 0 ? Math.max(4, (r.impact / maxImpact) * 100) : 0}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">
                    {n1(r.gap)} procs below expected · +{r.impact.toFixed(2)} pts
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 flex flex-wrap gap-2 text-[11px]">
          <span className="px-2 py-1 rounded-md bg-red-50 text-red-600 font-medium">
            {enriched.filter((r) => r.gap > 0).length} systems short
          </span>
          <span className="px-2 py-1 rounded-md bg-green-50 text-green-700 font-medium">
            {enriched.filter((r) => r.gap < 0).length} systems over target
          </span>
          <span className="px-2 py-1 rounded-md bg-slate-50 text-slate-600 font-medium">
            {n1(surplus)} surplus procs offsetting gaps
          </span>
        </div>
      </div>

      {/* Full breakdown */}
      <div className="border border-slate-200 rounded-lg overflow-hidden">
        <button
          onClick={() => setShowAll((o) => !o)}
          className="w-full flex items-center justify-between px-3 py-2.5 bg-slate-50 hover:bg-slate-100 transition-colors"
        >
          <span className="text-xs font-semibold text-slate-700">System Breakdown</span>
          <span className="flex items-center gap-1 text-[10px] text-slate-400">
            {tableRows.length} systems
            {showAll ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </span>
        </button>
        {showAll && (
          <div className="overflow-x-auto max-h-80 overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-white sticky top-0 text-[10px] text-slate-500 uppercase tracking-wide border-b border-slate-100">
                <tr>
                  <th className="px-2 py-2 text-left font-medium">System</th>
                  <th className="px-2 py-2 text-right font-medium">Usage</th>
                  <th className="px-2 py-2 text-right font-medium">Done</th>
                  <th className="px-2 py-2 text-right font-medium">Gap</th>
                  <th className="px-2 py-2 text-center font-medium">Eff %</th>
                  <th className="px-2 py-2 text-right font-medium">Pts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {tableRows.map((r, i) => (
                  <tr key={r.id || i} className="hover:bg-slate-50">
                    <td className="px-2 py-2 font-medium text-slate-800 max-w-[110px] truncate">{r.name}</td>
                    <td className="px-2 py-2 text-right text-slate-600">{n1(r.usage)}</td>
                    <td className="px-2 py-2 text-right text-slate-600">{n1(r.proc)}</td>
                    <td className={`px-2 py-2 text-right font-medium ${r.gap > 0 ? "text-red-600" : "text-green-600"}`}>
                      {r.gap > 0 ? n1(r.gap) : r.gap < 0 ? `+${n1(-r.gap)}` : "0"}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className={`inline-block px-1.5 py-0.5 rounded-full text-[10px] font-semibold ${effClass(r.eff)}`}>
                        {r.eff != null ? `${r.eff.toFixed(0)}%` : "—"}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right text-purple-600 font-medium">
                      {r.impact > 0.001 ? `+${r.impact.toFixed(2)}` : "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}