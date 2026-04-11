import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";

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
    ["AD Name", item.adName],
    ["Field Sales", item.fieldSales],
    ["System", item.system],
    ["Type", item.type],
    ["Set ID", item.setId],
    ["Consignment ID", item.consignmentId],
    ["Placement Date", item.placementDate],
    ["Return Date", item.returnDate],
    ["Days Kept", item.daysKept],
    ["Last 2 Mo. Days Kept", item.last2MoDaysKept],
    ["Proj Days Kept", item.projDaysKept],
    ["Cons Completions", item.consCompl],
    ["Last 2 Mo. Cmpl", item.last2MoCmpl],
    ["Total Projected", item.consTotProj],
    ["Eff %", item.effPct != null ? `${item.effPct.toFixed(1)}%` : "—"],
  ];

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 max-h-[85vh] flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="font-semibold text-slate-800 text-base">{item.setName}</h3>
            <p className="text-xs text-slate-400 mt-0.5">Tag ID: {item.tagId || "—"}</p>
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

export default function IEPConsignmentTable({ data }) {
  const [selected, setSelected] = useState(null);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const filtered = data.filter(r =>
    !search ||
    r.setName?.toLowerCase().includes(search.toLowerCase()) ||
    r.tagId?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-6">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition-colors">
        <div className="text-left">
          <h2 className="text-sm font-semibold text-slate-700">Consignment Sets — Individual Efficiency</h2>
          <p className="text-xs text-slate-400 mt-0.5">{data.length} sets · click a row for full detail</p>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {open && (
        <div className="border-t border-slate-100">
          <div className="px-4 py-2">
            <input
              type="text"
              placeholder="Search by set name or tag ID…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full text-sm border border-slate-200 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-purple-300"
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500 uppercase tracking-wide">
                <tr>
                  <th className="px-4 py-2.5 text-left font-medium">Tag ID</th>
                  <th className="px-4 py-2.5 text-left font-medium">Set Name</th>
                  <th className="px-4 py-2.5 text-right font-medium">Cons Cmpl</th>
                  <th className="px-4 py-2.5 text-right font-medium">Tot Proj</th>
                  <th className="px-4 py-2.5 text-center font-medium">Eff %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filtered.map((r, i) => (
                  <tr key={r.id || i}
                    onClick={() => setSelected(r)}
                    className="hover:bg-slate-50 cursor-pointer transition-colors">
                    <td className="px-4 py-2.5 text-slate-500 font-mono text-xs">{r.tagId || "—"}</td>
                    <td className="px-4 py-2.5 font-medium text-slate-800">{r.setName}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{r.consCompl ?? "—"}</td>
                    <td className="px-4 py-2.5 text-right text-slate-600">{r.consTotProj ?? "—"}</td>
                    <td className="px-4 py-2.5 text-center"><EffBadge val={r.effPct} /></td>
                  </tr>
                ))}
                {filtered.length === 0 && (
                  <tr><td colSpan={5} className="text-center py-6 text-xs text-slate-400">No results</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {selected && <DetailModal item={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}