import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { Card } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/components/loaners/loanerUtils";
import { DollarSign, Filter } from "lucide-react";
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
} from "recharts";

export default function MonthlyFinesHistory({ loaners = [], missingParts = [] }) {
  const [accountFilter, setAccountFilter] = useState("all");
  const [repFilter, setRepFilter] = useState("all");

  // Unique accounts and reps for filter dropdowns
  const accounts = useMemo(() => {
    const set = new Set(loaners.map(l => l.accountName).filter(Boolean));
    return [...set].sort();
  }, [loaners]);

  const reps = useMemo(() => {
    const set = new Set([
      ...loaners.map(l => l.repName).filter(Boolean),
      ...missingParts.map(p => p.repName).filter(Boolean),
    ]);
    return [...set].sort();
  }, [loaners, missingParts]);

  // Filter loaners
  const filteredLoaners = useMemo(() => loaners.filter(l => {
    if (accountFilter !== "all" && l.accountName !== accountFilter) return false;
    if (repFilter !== "all" && l.repName !== repFilter) return false;
    return true;
  }), [loaners, accountFilter, repFilter]);

  // Filter missing parts (no accountName field, only repName)
  const filteredParts = useMemo(() => missingParts.filter(p => {
    if (repFilter !== "all" && p.repName !== repFilter) return false;
    return true;
  }), [missingParts, repFilter]);

  // Build monthly buckets
  const monthlyData = useMemo(() => {
    const buckets = {};

    // Loaner fines — bucket by expectedReturnDate month
    filteredLoaners.forEach(l => {
      const dateStr = l.expectedReturnDate || l.loanedDate;
      if (!dateStr || !l.fineAmount || l.fineAmount <= 0) return;
      let month;
      try { month = format(parseISO(dateStr), "MMM yyyy"); } catch { return; }
      if (!buckets[month]) buckets[month] = { month, _date: parseISO(dateStr), loanerFines: 0, partFines: 0 };
      buckets[month].loanerFines += l.feesWaived ? 0 : (l.fineAmount || 0);
    });

    // Missing part fines — bucket by missingDate
    filteredParts.forEach(p => {
      if (!p.missingDate || !p.fineAmount || p.fineAmount <= 0) return;
      let month;
      try { month = format(parseISO(p.missingDate), "MMM yyyy"); } catch { return; }
      if (!buckets[month]) {
        try { buckets[month] = { month, _date: parseISO(p.missingDate), loanerFines: 0, partFines: 0 }; } catch { return; }
      }
      buckets[month].partFines += p.fineAmount || 0;
    });

    return Object.values(buckets)
      .sort((a, b) => a._date - b._date)
      .map(({ _date, ...rest }) => ({
        ...rest,
        total: rest.loanerFines + rest.partFines,
      }));
  }, [filteredLoaners, filteredParts]);

  const grandTotal = monthlyData.reduce((s, m) => s + m.total, 0);
  const loanerTotal = monthlyData.reduce((s, m) => s + m.loanerFines, 0);
  const partTotal = monthlyData.reduce((s, m) => s + m.partFines, 0);

  const activeFilters = [accountFilter, repFilter].filter(f => f !== "all").length;

  return (
    <Card className="p-5 bg-white border-slate-200 md:col-span-2">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 mb-4">
        <div>
          <h2 className="text-sm font-semibold text-slate-700 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-slate-500" />
            Monthly Fines History
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">Loaner overdue fines + missing part fines by month</p>
        </div>
        <div className="flex flex-wrap gap-2 items-center">
          {activeFilters > 0 && (
            <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full font-medium">
              {activeFilters} filter{activeFilters > 1 ? "s" : ""} active
            </span>
          )}
          <div className="flex gap-2">
            <Select value={accountFilter} onValueChange={setAccountFilter}>
              <SelectTrigger className="h-8 text-xs w-40">
                <SelectValue placeholder="All Accounts" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Accounts</SelectItem>
                {accounts.map(a => (
                  <SelectItem key={a} value={a}>{a}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={repFilter} onValueChange={setRepFilter}>
              <SelectTrigger className="h-8 text-xs w-40">
                <SelectValue placeholder="All Reps" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Reps (Territory)</SelectItem>
                {reps.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* Summary pills */}
      <div className="flex flex-wrap gap-3 mb-4">
        <div className="flex items-center gap-1.5 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
          <span className="text-xs text-amber-600 font-medium">Grand Total</span>
          <span className="text-sm font-bold text-amber-700">{formatCurrency(grandTotal)}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-red-50 border border-red-200 rounded-lg px-3 py-1.5">
          <span className="text-xs text-red-600 font-medium">Loaner Fines</span>
          <span className="text-sm font-bold text-red-700">{formatCurrency(loanerTotal)}</span>
        </div>
        <div className="flex items-center gap-1.5 bg-orange-50 border border-orange-200 rounded-lg px-3 py-1.5">
          <span className="text-xs text-orange-600 font-medium">Part Fines</span>
          <span className="text-sm font-bold text-orange-700">{formatCurrency(partTotal)}</span>
        </div>
      </div>

      {monthlyData.length === 0 ? (
        <p className="text-sm text-slate-400 text-center py-12">No fine data for selected filters</p>
      ) : (
        <>
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart data={monthlyData} barSize={24}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `$${v >= 1000 ? (v/1000).toFixed(0)+"k" : v}`} />
              <Tooltip formatter={(v, name) => [formatCurrency(v), name]} />
              <Legend />
              <Bar dataKey="loanerFines" stackId="a" fill="#ef4444" radius={[0, 0, 0, 0]} name="Loaner Fines" />
              <Bar dataKey="partFines" stackId="a" fill="#f97316" radius={[4, 4, 0, 0]} name="Part Fines" />
              <Line type="monotone" dataKey="total" stroke="#6366f1" strokeWidth={2} dot={{ r: 3 }} name="Total" />
            </ComposedChart>
          </ResponsiveContainer>

          {/* Monthly breakdown table */}
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-400 border-b border-slate-100">
                  <th className="pb-2 font-medium">Month</th>
                  <th className="pb-2 font-medium text-right text-red-500">Loaner Fines</th>
                  <th className="pb-2 font-medium text-right text-orange-500">Part Fines</th>
                  <th className="pb-2 font-medium text-right text-amber-600">Total</th>
                </tr>
              </thead>
              <tbody>
                {monthlyData.map((row, i) => (
                  <tr key={i} className="border-b border-slate-50 hover:bg-slate-50">
                    <td className="py-2 font-medium text-slate-700">{row.month}</td>
                    <td className="py-2 text-right text-red-600">{formatCurrency(row.loanerFines)}</td>
                    <td className="py-2 text-right text-orange-600">{formatCurrency(row.partFines)}</td>
                    <td className="py-2 text-right font-bold text-amber-700">{formatCurrency(row.total)}</td>
                  </tr>
                ))}
                <tr className="border-t-2 border-slate-200 bg-slate-50">
                  <td className="py-2 font-bold text-slate-800 text-xs uppercase tracking-wide">Total</td>
                  <td className="py-2 text-right font-bold text-red-700">{formatCurrency(loanerTotal)}</td>
                  <td className="py-2 text-right font-bold text-orange-700">{formatCurrency(partTotal)}</td>
                  <td className="py-2 text-right font-bold text-amber-800">{formatCurrency(grandTotal)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </>
      )}
    </Card>
  );
}