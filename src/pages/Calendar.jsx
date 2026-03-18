import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { computeLoanerData } from "@/components/loaners/loanerUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, ChevronLeft, ChevronRight, AlertTriangle, Clock, Package } from "lucide-react";
import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths, parseISO, isToday, isPast } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const DOT_COLORS = {
  Overdue: "bg-red-500",
  "Due Soon": "bg-amber-400",
  Safe: "bg-blue-500",
};

const PILL_COLORS = {
  Overdue: "bg-red-100 text-red-800 border border-red-200",
  "Due Soon": "bg-amber-100 text-amber-800 border border-amber-200",
  Safe: "bg-blue-100 text-blue-800 border border-blue-200",
};

export default function Calendar() {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(null);

  const { data: rawLoaners = [], isLoading } = useQuery({
    queryKey: ["loaners"],
    queryFn: () => base44.entities.Loaners.list(),
  });

  const activeLoaners = useMemo(() =>
    rawLoaners
      .map(computeLoanerData)
      .filter(l => l.returnStatus !== "sent_back" && l.returnStatus !== "received" && l.expectedReturnDate),
    [rawLoaners]
  );

  // Group by expected return date string
  const byDate = useMemo(() => {
    const map = {};
    activeLoaners.forEach(l => {
      const key = l.expectedReturnDate; // YYYY-MM-DD
      if (!map[key]) map[key] = [];
      map[key].push(l);
    });
    return map;
  }, [activeLoaners]);

  const days = useMemo(() => {
    const start = startOfMonth(currentMonth);
    const end = endOfMonth(currentMonth);
    return eachDayOfInterval({ start, end });
  }, [currentMonth]);

  // Pad so calendar grid starts on Sunday
  const startPad = useMemo(() => {
    const start = startOfMonth(currentMonth);
    return Array(start.getDay()).fill(null);
  }, [currentMonth]);

  const getLoanersForDay = (day) => byDate[format(day, "yyyy-MM-dd")] || [];

  const selectedLoaners = useMemo(() =>
    selectedDate ? getLoanersForDay(selectedDate) : [],
    [selectedDate, byDate]
  );

  // Month summary counts
  const monthLoaners = useMemo(() => {
    return days.flatMap(d => getLoanersForDay(d));
  }, [days, byDate]);

  const overdueMonth = monthLoaners.filter(l => l.risk_status === "Overdue").length;
  const dueSoonMonth = monthLoaners.filter(l => l.risk_status === "Due Soon").length;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <Skeleton className="h-10 w-48 mb-4" />
        <Skeleton className="h-96 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-lg bg-indigo-100">
            <CalendarDays className="w-5 h-5 text-indigo-600" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Return Calendar</h1>
        </div>
        <p className="text-slate-500 ml-12 mb-6">Active loaners by expected return date</p>

        {/* Month navigation + summary */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
              className="p-2 rounded-lg hover:bg-slate-200 transition-colors">
              <ChevronLeft className="w-4 h-4 text-slate-600" />
            </button>
            <h2 className="text-lg font-semibold text-slate-800 w-36 text-center">
              {format(currentMonth, "MMMM yyyy")}
            </h2>
            <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
              className="p-2 rounded-lg hover:bg-slate-200 transition-colors">
              <ChevronRight className="w-4 h-4 text-slate-600" />
            </button>
            <button onClick={() => setCurrentMonth(new Date())}
              className="text-xs px-3 py-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 transition-colors">
              Today
            </button>
          </div>
          <div className="flex gap-2 text-xs">
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-red-50 border border-red-200 text-red-700 font-medium">
              <AlertTriangle className="w-3 h-3" /> {overdueMonth} overdue
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-amber-50 border border-amber-200 text-amber-700 font-medium">
              <Clock className="w-3 h-3" /> {dueSoonMonth} due soon
            </span>
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 border border-blue-200 text-blue-700 font-medium">
              <Package className="w-3 h-3" /> {monthLoaners.length} total
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Calendar grid */}
          <Card className="lg:col-span-2 bg-white border-slate-200 p-4 overflow-hidden">
            {/* Day headers */}
            <div className="grid grid-cols-7 mb-2">
              {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
                <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>
              ))}
            </div>

            {/* Calendar cells */}
            <div className="grid grid-cols-7 gap-1">
              {startPad.map((_, i) => <div key={`pad-${i}`} />)}
              {days.map(day => {
                const dayLoaners = getLoanersForDay(day);
                const hasOverdue = dayLoaners.some(l => l.risk_status === "Overdue");
                const hasDueSoon = dayLoaners.some(l => l.risk_status === "Due Soon");
                const count = dayLoaners.length;
                const isSelected = selectedDate && isSameDay(day, selectedDate);
                const today = isToday(day);

                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => setSelectedDate(isSameDay(day, selectedDate) ? null : day)}
                    className={`
                      relative flex flex-col items-center rounded-lg p-1 min-h-[52px] transition-all text-left w-full
                      ${isSelected ? "bg-indigo-600 text-white ring-2 ring-indigo-400" : today ? "bg-indigo-50 ring-1 ring-indigo-300" : count > 0 ? "hover:bg-slate-50 cursor-pointer" : "cursor-default"}
                    `}
                  >
                    <span className={`text-xs font-semibold leading-none mb-1 ${isSelected ? "text-white" : today ? "text-indigo-700" : "text-slate-700"}`}>
                      {format(day, "d")}
                    </span>

                    {count > 0 && (
                      <div className="flex flex-col items-center gap-0.5 w-full">
                        {/* Cluster bubble */}
                        <span className={`
                          text-xs font-bold px-1.5 py-0.5 rounded-md leading-none
                          ${isSelected ? "bg-white/20 text-white"
                            : hasOverdue ? "bg-red-100 text-red-700"
                            : hasDueSoon ? "bg-amber-100 text-amber-700"
                            : "bg-blue-100 text-blue-700"}
                        `}>
                          {count}
                        </span>
                        {/* Status dots */}
                        <div className="flex gap-0.5 flex-wrap justify-center">
                          {hasOverdue && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-red-300" : "bg-red-500"}`} />}
                          {hasDueSoon && <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? "bg-amber-300" : "bg-amber-400"}`} />}
                        </div>
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Legend */}
            <div className="flex gap-4 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-400">
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" /> Overdue</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-amber-400 inline-block" /> Due Soon</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-blue-500 inline-block" /> Active</span>
            </div>
          </Card>

          {/* Side panel: selected day detail */}
          <div className="space-y-3">
            {selectedDate ? (
              <>
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-slate-800">{format(selectedDate, "EEEE, MMM d")}</h3>
                  <span className="text-xs text-slate-400">{selectedLoaners.length} return{selectedLoaners.length !== 1 ? "s" : ""}</span>
                </div>
                {selectedLoaners.length === 0 ? (
                  <Card className="p-6 text-center bg-white border-slate-200">
                    <p className="text-sm text-slate-400">No returns due this day.</p>
                  </Card>
                ) : (
                  <div className="space-y-2 max-h-[520px] overflow-y-auto pr-1">
                    {selectedLoaners
                      .sort((a, b) => {
                        const order = { Overdue: 0, "Due Soon": 1, Safe: 2 };
                        return (order[a.risk_status] ?? 2) - (order[b.risk_status] ?? 2);
                      })
                      .map(l => (
                        <Card key={l.id} className={`p-3 bg-white border ${l.risk_status === "Overdue" ? "border-red-200" : l.risk_status === "Due Soon" ? "border-amber-200" : "border-slate-200"}`}>
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <p className="text-xs font-semibold text-slate-800 truncate">{l.setName}</p>
                              <p className="text-xs text-slate-500 mt-0.5 truncate">{l.accountName}</p>
                              {l.repName && l.repName !== "None" && (
                                <p className="text-xs text-slate-400 truncate">{l.repName}</p>
                              )}
                            </div>
                            <div className="flex flex-col items-end gap-1 shrink-0">
                              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PILL_COLORS[l.risk_status] || PILL_COLORS.Safe}`}>
                                {l.risk_status}
                              </span>
                              <Link to={`${createPageUrl("LoanerDetail")}?id=${l.id}`}
                                className="text-xs text-indigo-600 hover:underline font-medium">
                                View →
                              </Link>
                            </div>
                          </div>
                        </Card>
                      ))}
                  </div>
                )}
              </>
            ) : (
              <Card className="p-6 text-center bg-white border-slate-200">
                <CalendarDays className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-sm text-slate-400">Click a day to see returns due.</p>
              </Card>
            )}

            {/* Upcoming clusters summary */}
            <Card className="p-4 bg-white border-slate-200">
              <h4 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-3">Busiest Days This Month</h4>
              <div className="space-y-2">
                {days
                  .map(d => ({ day: d, count: getLoanersForDay(d).length, overdue: getLoanersForDay(d).filter(l => l.risk_status === "Overdue").length }))
                  .filter(d => d.count > 0)
                  .sort((a, b) => b.count - a.count)
                  .slice(0, 5)
                  .map(({ day, count, overdue }) => (
                    <button key={day.toISOString()} onClick={() => setSelectedDate(day)}
                      className="w-full flex items-center justify-between hover:bg-slate-50 rounded-lg px-2 py-1.5 transition-colors">
                      <span className="text-sm text-slate-700 font-medium">{format(day, "EEE, MMM d")}</span>
                      <div className="flex items-center gap-1.5">
                        {overdue > 0 && <span className="text-xs font-semibold text-red-600 bg-red-50 border border-red-100 px-1.5 py-0.5 rounded-full">{overdue} OD</span>}
                        <span className="text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-1.5 py-0.5 rounded-full">{count} total</span>
                      </div>
                    </button>
                  ))}
                {days.every(d => getLoanersForDay(d).length === 0) && (
                  <p className="text-xs text-slate-400 text-center py-2">No returns due this month.</p>
                )}
              </div>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}