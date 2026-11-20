import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import { formatCurrency } from "@/components/loaners/loanerUtils";

function RiskBadge({ status }) {
  if (status === "Overdue") return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">Overdue</span>;
  if (status === "Due Soon") return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">Due Soon</span>;
  return <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-700">OK</span>;
}

export default function DemoLoaners({ loaners }) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const active = loaners.filter((l) => l.returnStatus !== "sent_back" && l.returnStatus !== "received");
    if (!q.trim()) return active;
    const s = q.toLowerCase();
    return active.filter(
      (l) =>
        l.setName?.toLowerCase().includes(s) ||
        l.accountName?.toLowerCase().includes(s) ||
        l.etchId?.toLowerCase().includes(s) ||
        l.repName?.toLowerCase().includes(s)
    );
  }, [loaners, q]);

  return (
    <div className="space-y-4">
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search loaners…"
          className="w-full pl-9 pr-3 h-10 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-300"
        />
      </div>

      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500 border-b border-slate-100">
                <th className="px-4 py-3 font-semibold">Set</th>
                <th className="px-4 py-3 font-semibold">Account</th>
                <th className="px-4 py-3 font-semibold">Rep</th>
                <th className="px-4 py-3 font-semibold">Due</th>
                <th className="px-4 py-3 font-semibold">Status</th>
                <th className="px-4 py-3 font-semibold text-right">Fine</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-slate-900">{l.setName}</p>
                    <p className="text-xs text-slate-400">{l.etchId}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-600">{l.accountName}</td>
                  <td className="px-4 py-3 text-slate-600">{l.repName}</td>
                  <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{l.expectedReturnDate}</td>
                  <td className="px-4 py-3"><RiskBadge status={l.risk_status} /></td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900 whitespace-nowrap">
                    {l.fineAmount > 0 ? formatCurrency(l.fineAmount) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <p className="text-center text-sm text-slate-400 py-12">No loaners match your search</p>
        )}
      </div>
      <p className="text-xs text-slate-400">Showing {filtered.length} active loaners</p>
    </div>
  );
}