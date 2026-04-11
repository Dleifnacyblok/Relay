import { useState } from "react";
import { ChevronDown, ChevronUp, AlertTriangle } from "lucide-react";

function EffBadge({ val }) {
  if (val === null || val === undefined) return <span className="text-slate-400">—</span>;
  const pct = parseFloat(val);
  if (isNaN(pct)) return <span className="text-slate-400">—</span>;
  if (pct >= 100) return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-700">{pct.toFixed(1)}%</span>;
  if (pct >= 70) return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-yellow-100 text-yellow-700">{pct.toFixed(1)}%</span>;
  return <span className="inline-block px-2 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-700">{pct.toFixed(1)}%</span>;
}

function DetailModal({ item, onClose }) {
  const fields = [
    ["AD", item.ad],
    ["Field Sales", item.fieldSales],
    ["System", item.system],
    ["Type", item.type],
    ["Set ID", item.setId],
    ["Loaner ID", item.loanerId],
    ["Consignment ID", item.consignmentId],
    ["Rep", item.rep],
    ["Associate Rep", item.assocRep],
    ["Status", item.status],
    ["Placement Date", item.placementDate],
    ["Return Date", item.returnDate],
    ["Loaner Completions", item.loanerCmpl],
    ["Last 2 Mo.", item.loanerLast2Mo],
    ["Loaner Proj", item.loanerProj],
    ["Total Projected", item.loanerTotProj],
    ["Eff %", item.effPct != null ? `${item.effPct.toFixed(1)}%` : "—"],
  ];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-800 text-base">{item.setName}</h3>
              {item.isMissing && (
                <span className="inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">
                  <AlertTriangle className="w-3 h-3" /> Missing
                </span>
              )}
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Etch ID: {item.etchId || "—"}</p>
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 text-xl leading-none">&times;</button>
        </div>
        <div className="overflow-y-auto grid grid-cols-2 gap-2">
          {fields.map(([label, value]) => (
            <div key={label} className="bg-slate-50 rounded-lg px-3 py-2">
              <p className="text-[10px] text-slate-400 font-medium uppercase tracking-wide">{label}</p>
              <p className="text-sm font-semibold text-slate-800 mt-0.5">{value ?? "—"}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function LoanerRows({ data, showMissingOnly }) {
  const [selected, setSelected] = useState(null);
  const [search, setSearch] = useState("");

  const filtered = data
    .filter(r => !showMissingOnly || r.isMissing)
    .filter(r =>
      !search ||
      r.setName?.toLowerCase().includes(search.toLowerCase()) ||
      r.etchId?.toLowerCase().includes(search.toLowerCase()) ||
      r.rep?.toLowerCase().includes(search.toLowerCase())
    );

  return (
    <>
      <div className="px-4 py-2">
        <input
          type="text"
          placeholder="Search by set name, etch ID, or rep…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-300"
        />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
            <tr>
              <th className="px-4 py-2.5 text-left font-medium">Set Name</th>
              <th className="px-4 py-2.5 text-left font-medium">Etch ID</th>
              <th className="px-4 py-2.5 text-left font-medium">Rep</th>
              <th className="px-4 py-2.5 text-left font-medium">Assoc. Rep</th>
              <th className="px-4 py-2.5 text-center font-medium">Eff %</th>
              {showMissingOnly && <th className="px-4 py-2.5 text-center font-medium">Status</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filtered.map((r, i) => (
              <tr key={r.id || i}
                onClick={() => setSelected(r)}
                className="hover:bg-slate-50 cursor-pointer transition-colors">
                <td className="px-4 py-2.5 font-medium text-slate-800">
                  <span className="flex items-center gap-1.5">
                    {r.isMissing && <AlertTriangle className="w-3.5 h-3.5 text-red-500 shrink-0" />}
                    {r.setName}
                  </span>
                </td>
                <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{r.etchId || "—"}</td>
                <td className="px-4 py-2.5 text-slate-600">{r.rep || "—"}</td>
                <td className="px-4 py-2.5 text-slate-500 text-xs">{r.assocRep || "—"}</td>
                <td className="px-4 py-2.5 text-center"><EffBadge val={r.effPct} /></td>
                {showMissingOnly && (
                  <td className="px-4 py-2.5 text-center">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-red-100 text-red-700">{r.status || "Missing"}</span>
                  </td>
                )}
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={showMissingOnly ? 6 : 5} className="text-center py-6 text-xs text-slate-400">No results</td></tr>
            )}
          </tbody>
        </table>
      </div>
      {selected && <DetailModal item={selected} onClose={() => setSelected(null)} />}
    </>
  );
}

export default function IEPLoanerTable({ data }) {
  const [activeTab, setActiveTab] = useState("all"); // "all" | "missing"
  const [open, setOpen] = useState(false);

  const missingCount = data.filter(r => r.isMissing).length;

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
        <div className="text-left">
          <h2 className="text-sm font-semibold text-slate-700">Loaner Sets — Individual Efficiency</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {data.length} sets · {missingCount} missing · click a row for full detail
          </p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-slate-100">
          {/* Tab toggle */}
          <div className="flex gap-2 px-4 pt-3 pb-1">
            <button
              onClick={() => setActiveTab("all")}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors ${
                activeTab === "all"
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              All Loaners ({data.length})
            </button>
            <button
              onClick={() => setActiveTab("missing")}
              className={`text-xs font-medium px-3 py-1.5 rounded-full transition-colors flex items-center gap-1 ${
                activeTab === "missing"
                  ? "bg-red-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              <AlertTriangle className="w-3 h-3" /> Missing ({missingCount})
            </button>
          </div>
          <LoanerRows data={data} showMissingOnly={activeTab === "missing"} />
        </div>
      )}
    </div>
  );
}