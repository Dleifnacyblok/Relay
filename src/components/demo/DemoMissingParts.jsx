import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { formatCurrency } from "@/components/loaners/loanerUtils";

const STATUS_COLORS = {
  missing: "bg-red-100 text-red-700",
  found: "bg-green-100 text-green-700",
  paid: "bg-blue-100 text-blue-700",
};

export default function DemoMissingParts({ parts }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const active = parts.filter((p) => p.returnStatus !== "sent_back" && p.returnStatus !== "received");
    if (!q.trim()) return active;
    const s = q.toLowerCase();
    return active.filter(
      (p) =>
        p.partName?.toLowerCase().includes(s) ||
        p.partNumber?.toLowerCase().includes(s) ||
        p.loanerSetName?.toLowerCase().includes(s) ||
        p.repName?.toLowerCase().includes(s)
    );
  }, [parts, q]);

  const totalFines = filtered
    .filter((p) => p.status === "missing")
    .reduce((sum, p) => sum + (p.fineAmount || 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="relative max-w-md flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search missing parts…"
            className="w-full pl-9 pr-3 h-10 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
          />
        </div>
        <div className="text-sm text-slate-600">
          Total missing fines: <span className="font-bold text-red-600">{formatCurrency(totalFines)}</span>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="px-4 py-3 font-semibold">Part</th>
                <th className="px-4 py-3 font-semibold">Part #</th>
                <th className="px-4 py-3 font-semibold">Rep</th>
                <th className="px-4 py-3 font-semibold">Loaner Set</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Fine</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium text-slate-900">{p.partName}</td>
                  <td className="px-4 py-3 text-slate-600">{p.partNumber || "—"}</td>
                  <td className="px-4 py-3 text-slate-600">{p.repName}</td>
                  <td className="px-4 py-3 text-slate-600">{p.loanerSetName || "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[p.status] || STATUS_COLORS.missing}`}>
                      {p.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900 whitespace-nowrap">
                    {p.fineAmount > 0 ? formatCurrency(p.fineAmount) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-12">No missing parts match your search</p>
        )}
      </div>
      <p className="text-xs text-slate-400">Showing {filtered.length} missing part records</p>
    </div>
  );
}