import { useState, useMemo } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, isSameMonth, isSameDay, addMonths, subMonths, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, AlertTriangle, Clock, Package } from "lucide-react";
import { Card } from "@/components/ui/card";

function getEventColor(loaner) {
  if (loaner.isOverdue) return { bg: "bg-red-500", light: "bg-red-50 border-red-200 text-red-800", dot: "bg-red-500" };
  if (loaner.daysUntilDue != null && loaner.daysUntilDue <= 7) return { bg: "bg-amber-500", light: "bg-amber-50 border-amber-200 text-amber-800", dot: "bg-amber-500" };
  return { bg: "bg-blue-500", light: "bg-blue-50 border-blue-200 text-blue-800", dot: "bg-blue-500" };
}

export default function LoanerCalendarTab({ loaners }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  // Group loaners by their expectedReturnDate
  const loanersByDate = useMemo(() => {
    const map = {};
    loaners.forEach(l => {
      if (!l.expectedReturnDate) return;
      const key = l.expectedReturnDate.slice(0, 10);
      if (!map[key]) map[key] = [];
      map[key].push(l);
    });
    return map;
  }, [loaners]);

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const calStart = startOfWeek(monthStart);
  const calEnd = endOfWeek(monthEnd);

  // Build rows of weeks
  const weeks = [];
  let day = calStart;
  while (day <= calEnd) {
    const week = [];
    for (let i = 0; i < 7; i++) {
      week.push(day);
      day = addDays(day, 1);
    }
    weeks.push(week);
  }

  const selectedKey = selectedDay ? format(selectedDay, "yyyy-MM-dd") : null;
  const selectedLoaners = selectedKey ? (loanersByDate[selectedKey] || []) : [];

  const totalEvents = loaners.length;
  const overdueEvents = loaners.filter(l => l.isOverdue).length;
  const dueSoonEvents = loaners.filter(l => !l.isOverdue && l.daysUntilDue != null && l.daysUntilDue <= 7).length;

  return (
    <div className="space-y-4">
      {/* Legend & Summary */}
      <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500">
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-red-500 inline-block" /> Overdue ({overdueEvents})</div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Due Soon ({dueSoonEvents})</div>
        <div className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-blue-500 inline-block" /> On Track ({totalEvents - overdueEvents - dueSoonEvents})</div>
      </div>

      {/* Calendar Card */}
      <Card className="bg-white border-slate-200 overflow-hidden">
        {/* Month Nav */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronLeft className="w-4 h-4 text-slate-600" />
          </button>
          <h2 className="font-semibold text-slate-900">{format(currentMonth, "MMMM yyyy")}</h2>
          <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors">
            <ChevronRight className="w-4 h-4 text-slate-600" />
          </button>
        </div>

        {/* Day Headers */}
        <div className="grid grid-cols-7 border-b border-slate-100">
          {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
            <div key={d} className="py-2 text-center text-xs font-medium text-slate-400">{d}</div>
          ))}
        </div>

        {/* Calendar Grid */}
        <div>
          {weeks.map((week, wi) => (
            <div key={wi} className="grid grid-cols-7 border-b border-slate-50 last:border-0">
              {week.map((day, di) => {
                const key = format(day, "yyyy-MM-dd");
                const dayLoaners = loanersByDate[key] || [];
                const isCurrentMonth = isSameMonth(day, currentMonth);
                const isSelected = selectedDay && isSameDay(day, selectedDay);
                const isToday = isSameDay(day, new Date());

                return (
                  <button
                    key={di}
                    onClick={() => setSelectedDay(isSelected ? null : day)}
                    className={`min-h-[64px] sm:min-h-[80px] p-1.5 text-left transition-colors border-r border-slate-50 last:border-0 ${
                      isSelected ? "bg-slate-100" : "hover:bg-slate-50"
                    } ${!isCurrentMonth ? "opacity-30" : ""}`}
                  >
                    <span className={`text-xs font-medium inline-flex items-center justify-center w-6 h-6 rounded-full ${
                      isToday ? "bg-slate-900 text-white" : "text-slate-600"
                    }`}>
                      {format(day, "d")}
                    </span>
                    <div className="mt-1 space-y-0.5">
                      {dayLoaners.slice(0, 2).map((l, i) => {
                        const color = getEventColor(l);
                        return (
                          <div key={i} className={`text-xs px-1 py-0.5 rounded truncate font-medium border ${color.light} hidden sm:block`}>
                            {l.setName}
                          </div>
                        );
                      })}
                      {/* Mobile: just dots */}
                      <div className="flex gap-0.5 sm:hidden flex-wrap">
                        {dayLoaners.slice(0, 3).map((l, i) => (
                          <span key={i} className={`w-1.5 h-1.5 rounded-full ${getEventColor(l).dot}`} />
                        ))}
                      </div>
                      {dayLoaners.length > 2 && (
                        <div className="text-xs text-slate-400 hidden sm:block">+{dayLoaners.length - 2} more</div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </Card>

      {/* Selected Day Detail */}
      {selectedDay && (
        <Card className="bg-white border-slate-200 p-4">
          <h3 className="font-semibold text-slate-900 mb-3">
            {format(selectedDay, "EEEE, MMMM d, yyyy")}
            <span className="ml-2 text-sm font-normal text-slate-500">
              {selectedLoaners.length === 0 ? "No returns due" : `${selectedLoaners.length} return${selectedLoaners.length !== 1 ? "s" : ""} due`}
            </span>
          </h3>
          {selectedLoaners.length === 0 ? (
            <p className="text-sm text-slate-400 py-4 text-center">No loaners due on this date.</p>
          ) : (
            <div className="space-y-2">
              {selectedLoaners.map((l, i) => {
                const color = getEventColor(l);
                return (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-lg border ${color.light}`}>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm truncate">{l.setName}</p>
                      <p className="text-xs opacity-75 mt-0.5">{l.accountName} • {l.repName || "—"}</p>
                    </div>
                    <div className="shrink-0 text-xs font-semibold flex items-center gap-1">
                      {l.isOverdue ? (
                        <><AlertTriangle className="w-3 h-3" /> Overdue</>
                      ) : l.daysUntilDue != null && l.daysUntilDue <= 7 ? (
                        <><Clock className="w-3 h-3" /> Due Soon</>
                      ) : (
                        <><Package className="w-3 h-3" /> On Track</>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Card>
      )}

      {loaners.length === 0 && (
        <div className="text-center py-12 text-slate-400">
          <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
          <p className="text-sm">No active loaners to display</p>
        </div>
      )}
    </div>
  );
}