import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ArrowDownRight, ArrowUpRight, History, Minus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";

const recEff = (r) => {
  if (r.effPct != null) return r.effPct;
  if (r.effPctProj != null) return r.effPctProj;
  if (r.procCmpl != null && r.totalExpUsage > 0) return (r.procCmpl / r.totalExpUsage) * 100;
  return null;
};

const scoreOf = (snap) => {
  if (snap.overallEffPct != null) return snap.overallEffPct;
  const recs = snap.records || [];
  const usage = recs.reduce((a, r) => a + (r.totalExpUsage || 0), 0);
  const proc = recs.reduce((a, r) => a + (r.procCmpl || 0), 0);
  return usage > 0 ? (proc / usage) * 100 : null;
};

function Delta({ value, digits = 1 }) {
  if (value == null || Math.abs(value) < 0.05) {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-slate-400">
        <Minus className="w-3 h-3" /> flat
      </span>
    );
  }
  const up = value > 0;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold ${up ? "text-green-600" : "text-red-600"}`}>
      {up ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
      {up ? "+" : ""}
      {value.toFixed(digits)}
    </span>
  );
}

export default function IEPHistoryPanel() {
  const { data: snapshots = [], isLoading } = useQuery({
    queryKey: ["iepImportSnapshots"],
    queryFn: async () => {
      const res = await base44.entities.IEPImportSnapshot.filter({}, { sort: "-importedAt", limit: 24 });
      return res?.items || [];
    },
  });

  const ordered = useMemo(
    () => [...snapshots].sort((a, b) => new Date(a.importedAt || 0) - new Date(b.importedAt || 0)),
    [snapshots]
  );

  const points = useMemo(
    () =>
      ordered.map((s) => ({
        id: s.id,
        label: s.importedAt
          ? new Date(s.importedAt).toLocaleDateString("en-US", { month: "short", day: "numeric" })
          : "—",
        score: scoreOf(s),
        systems: (s.records || []).length || s.totalRecords || 0,
      })),
    [ordered]
  );

  const movers = useMemo(() => {
    if (ordered.length < 2) return null;
    const latest = ordered[ordered.length - 1];
    const prev = ordered[ordered.length - 2];
    const prevMap = {};
    (prev.records || []).forEach((r) => {
      if (r.systemName) prevMap[r.systemName.toLowerCase().trim()] = recEff(r);
    });

    const rows = (latest.records || [])
      .filter((r) => r.systemName && prevMap[r.systemName.toLowerCase().trim()] != null)
      .map((r) => {
        const now = recEff(r);
        const before = prevMap[r.systemName.toLowerCase().trim()];
        return {
          name: r.systemName,
          before,
          now,
          delta: now != null ? now - before : null,
        };
      })
      .filter((r) => r.delta != null);

    return {
      prevLabel: points[points.length - 2]?.label,
      latestLabel: points[points.length - 1]?.label,
      up: rows.filter((r) => r.delta > 0.05).sort((a, b) => b.delta - a.delta).slice(0, 3),
      down: rows.filter((r) => r.delta < -0.05).sort((a, b) => a.delta - b.delta).slice(0, 3),
    };
  }, [ordered, points]);

  const historyRows = useMemo(
    () =>
      [...ordered].reverse().map((s, i, arr) => {
        const next = arr[i + 1];
        const score = scoreOf(s);
        const prevScore = next ? scoreOf(next) : null;
        return {
          id: s.id,
          at: s.importedAt,
          systems: (s.records || []).length || s.totalRecords || 0,
          score,
          delta: score != null && prevScore != null ? score - prevScore : null,
        };
      }),
    [ordered]
  );

  if (isLoading) {
    return (
      <div className="py-10 flex justify-center">
        <div className="w-6 h-6 border-4 border-slate-200 border-t-purple-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!ordered.length) {
    return (
      <div className="text-center py-10">
        <History className="w-8 h-8 text-slate-300 mx-auto mb-2" />
        <p className="text-sm text-slate-500">No import history yet.</p>
        <p className="text-xs text-slate-400 mt-1">Each IEP import is archived automatically, so history appears here after your first upload.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Score trend */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <History className="w-4 h-4 text-purple-500" />
          <h3 className="text-sm font-semibold text-slate-700">Overall IEP Score Trend</h3>
        </div>
        <p className="text-xs text-slate-400 mb-3">
          {points.length} archived import{points.length === 1 ? "" : "s"} · target line at 100%
        </p>
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={points} margin={{ top: 8, right: 12, left: -18, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#94a3b8" }} />
            <YAxis tick={{ fontSize: 10, fill: "#94a3b8" }} domain={["auto", "auto"]} />
            <Tooltip
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const row = payload[0].payload;
                return (
                  <div className="bg-white border border-slate-200 rounded-lg p-2.5 shadow-lg text-xs">
                    <p className="font-semibold text-slate-800 mb-1">{label}</p>
                    <p className="text-purple-600 font-medium">
                      Score: {row.score != null ? `${row.score.toFixed(1)}%` : "—"}
                    </p>
                    <p className="text-slate-500">{row.systems} systems</p>
                  </div>
                );
              }}
            />
            <ReferenceLine y={100} stroke="#22c55e" strokeDasharray="4 4" />
            <Line
              type="monotone"
              dataKey="score"
              stroke="#8b5cf6"
              strokeWidth={2.5}
              dot={{ r: 3, fill: "#8b5cf6" }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Movers */}
      {movers && (movers.up.length > 0 || movers.down.length > 0) && (
        <div>
          <h3 className="text-sm font-semibold text-slate-700 mb-1">Biggest Movers</h3>
          <p className="text-xs text-slate-400 mb-3">
            Efficiency change per system, {movers.prevLabel} → {movers.latestLabel}
          </p>
          <div className="space-y-2">
            {[...movers.up, ...movers.down].map((r, i) => (
              <div key={r.name || i} className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-slate-50">
                <p className="text-xs font-medium text-slate-800 truncate flex-1">{r.name}</p>
                <span className="text-[10px] text-slate-400 shrink-0">
                  {r.before.toFixed(0)}% → {r.now.toFixed(0)}%
                </span>
                <Delta value={r.delta} />
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Snapshot history */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-2">Import History</h3>
        <div className="divide-y divide-slate-100 border border-slate-200 rounded-lg overflow-hidden">
          {historyRows.map((row) => (
            <div key={row.id} className="flex items-center justify-between gap-2 px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-xs font-medium text-slate-800">
                  {row.at
                    ? new Date(row.at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                      })
                    : "—"}
                </p>
                <p className="text-[10px] text-slate-400">{row.systems} systems</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="text-sm font-bold text-purple-600">
                  {row.score != null ? `${row.score.toFixed(1)}%` : "—"}
                </span>
                <Delta value={row.delta} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}