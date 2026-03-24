import { useMemo, useState } from "react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

const STATUS_COLORS = {
  overdue: { dot: "bg-red-500", badge: "bg-red-100 text-red-800 border border-red-200", label: "Overdue" },
  due_soon: { dot: "bg-amber-400", badge: "bg-amber-100 text-amber-800 border border-amber-200", label: "Due Soon" },
  safe: { dot: "bg-green-500", badge: "bg-green-100 text-green-800 border border-green-200", label: "On Track" },
};

function getStatus(loaner) {
  if (loaner.isOverdue) return "overdue";
  if (loaner.daysUntilDue <= 7) return "due_soon";
  return "safe";
}

export default function LoanerCalendarTab({ loaners }) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(null);

  // Map loaner return dates to a lookup
  const eventsByDate = useMemo(() => {
    const map = {};
    loaners.forEach(l => {
      if (!l.expectedReturnDate) return;
      const dateStr = typeof l.expectedReturnDate === "string"
        ? l.expectedReturnDate.slice(0, 10)
        : format(new Date(l.expectedReturnDate), "yyyy-MM-dd");
      if (!map[dateStr]) map[dateStr] = [];
      map[dateStr].push(l);
    });
    return map;
  }, [loaners]);

  // Build calendar grid (6 weeks)
  const calendarDays = useMemo(() => {
    const start = startOfWeek(startOfMonth(currentMonth), { weekStartsOn: 0 });
    const end = endOfWeek(endOfMonth(currentMonth), { weekStartsOn: 0 });
    const days = [];
    let day = start;
    while (day <= end) {
      days.push(day);
      day = addDays(day, 1);
    }
    return days;
  }, [currentMonth]);

  const selectedDateStr = selectedDay ? format(selectedDay, "yyyy-MM-dd") : null;
  const selectedLoaners = selectedDateStr ? (eventsByDate[selectedDateStr] || []) : [];

  return (
    <div>
      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-xs text-slate-600">
        {Object.entries(STATUS_COLORS).map(([key, val]) => (
          <div key={key} className="flex items-center gap-1.5">
            <span className={`w-2.5 h-2.5 rounded-full ${val.dot} inline-block`} />
            {val.label}
          </div>
        ))}
      </div>

      {/* Month Navigation */}
      <div className="flex items-center justify-between mb-4">
        <button onClick={() => setCurrentMonth(subMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
          <ChevronLeft className="w-4 h-4 text-slate-600" />
        </button>
        <h3 className="text-base font-semibold text-slate-900">{format(currentMonth, "MMMM yyyy")}</h3>
        <button onClick={() => setCurrentMonth(addMonths(currentMonth, 1))} className="p-2 rounded-lg hover:bg-slate-100 transition-colors">
          <ChevronRight className="w-4 h-4 text-slate-600" />
        </button>
      </div>

      {/* Day Headers */}
      <div className="grid grid-cols-7 mb-1">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map(d => (
          <div key={d} className="text-center text-xs font-semibold text-slate-400 py-1">{d}</div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, idx) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const dayEvents = eventsByDate[dateStr] || [];
          const isCurrentMonth = isSameMonth(day, currentMonth);
          const isToday = isSameDay(day, new Date());
          const isSelected = selectedDay && isSameDay(day, selectedDay);

          // Dominant status color for the day
          const hasOverdue = dayEvents.some(l => l.isOverdue);
          const hasDueSoon = dayEvents.some(l => !l.isOverdue && l.daysUntilDue <= 7);
          const dotColor = hasOverdue ? "bg-red-500" : hasDueSoon ? "bg-amber-400" : dayEvents.length ? "bg-green-500" : null;

          return (
            <button
              key={idx}
              onClick={() => dayEvents.length > 0 ? setSelectedDay(isSelected ? null : day) : null}
              className={`
                relative min-h-[52px] p-1.5 rounded-lg text-sm transition-colors flex flex-col items-center
                ${isCurrentMonth ? "text-slate-800" : "text-slate-300"}
                ${isToday ? "ring-2 ring-blue-400 ring-offset-1" : ""}
                ${isSelected ? "bg-blue-50" : dayEvents.length > 0 ? "hover:bg-slate-50 cursor-pointer" : "cursor-default"}
              `}
            >
              <span className={`text-xs font-medium w-6 h-6 flex items-center justify-center rounded-full
                ${isToday ? "bg-blue-600 text-white" : ""}
              `}>
                {format(day, "d")}
              </span>
              {dotColor && (
                <span className={`w-1.5 h-1.5 rounded-full ${dotColor} mt-0.5`} />
              )}
              {dayEvents.length > 1 && (
                <span className="text-[9px] text-slate-500 leading-none mt-0.5">{dayEvents.length}</span>
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Day Details */}
      {selectedDay && selectedLoaners.length > 0 && (
        <div className="mt-4 border-t border-slate-100 pt-4">
          <p className="text-sm font-semibold text-slate-700 mb-2">
            {format(selectedDay, "MMMM d, yyyy")} — {selectedLoaners.length} loaner{selectedLoaners.length !== 1 ? "s" : ""} due
          </p>
          <div className="space-y-2">
            {selectedLoaners.map(l => {
              const status = getStatus(l);
              const colors = STATUS_COLORS[status];
              return (
                <div key={l.id} className={`flex items-start justify-between px-3 py-2.5 rounded-lg ${colors.badge}`}>
                  <div>
                    <p className="font-medium text-sm">{l.setName}</p>
                    <p className="text-xs opacity-75 mt-0.5">{l.accountName} · {l.repName}</p>
                  </div>
                  <span className="text-xs font-semibold ml-3 shrink-0">{colors.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {loaners.length === 0 && (
        <div className="flex flex-col items-center justify-center py-10 text-slate-400">
          <p className="text-sm font-medium">No active loaners</p>
          <p className="text-xs mt-1">Your loaner return dates will appear here.</p>
        </div>
      )}
    </div>
  );
}