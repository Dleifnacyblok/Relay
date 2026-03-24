import { useMemo } from "react";
import { Calendar, dateFnsLocalizer } from "react-big-calendar";
import { format, parse, startOfWeek, getDay } from "date-fns";

const localizer = dateFnsLocalizer({
  format,
  parse,
  startOfWeek: () => startOfWeek(new Date(), { weekStartsOn: 0 }),
  getDay,
  locales: {},
});

const EVENT_COLORS = {
  overdue: { bg: "#fef2f2", border: "#ef4444", text: "#991b1b" },
  due_soon: { bg: "#fffbeb", border: "#f59e0b", text: "#92400e" },
  safe: { bg: "#f0fdf4", border: "#22c55e", text: "#166534" },
};

export default function LoanerCalendarTab({ loaners }) {
  const events = useMemo(() =>
    loaners
      .filter(l => l.expectedReturnDate)
      .map(l => {
        const date = new Date(l.expectedReturnDate);
        const colorKey = l.isOverdue ? "overdue" : (l.daysUntilDue <= 7 ? "due_soon" : "safe");
        return {
          id: l.id,
          title: `${l.setName} — ${l.accountName}`,
          start: date,
          end: date,
          allDay: true,
          resource: { loaner: l, colorKey },
        };
      }),
    [loaners]
  );

  const eventStyleGetter = (event) => {
    const colors = EVENT_COLORS[event.resource.colorKey];
    return {
      style: {
        backgroundColor: colors.bg,
        borderLeft: `4px solid ${colors.border}`,
        color: colors.text,
        borderRadius: "6px",
        fontSize: "12px",
        padding: "2px 6px",
        fontWeight: 500,
      },
    };
  };

  const EventComponent = ({ event }) => {
    const { loaner } = event.resource;
    return (
      <div className="truncate text-xs leading-tight">
        <span className="font-semibold">{loaner.setName}</span>
        <span className="opacity-70 ml-1">· {loaner.accountName}</span>
      </div>
    );
  };

  return (
    <div>
      {/* Legend */}
      <div className="flex items-center gap-4 mb-4 text-xs text-slate-600">
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm border-l-4 border-red-500 bg-red-50 inline-block" />
          Overdue
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm border-l-4 border-amber-400 bg-amber-50 inline-block" />
          Due Soon (≤7 days)
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-3 h-3 rounded-sm border-l-4 border-green-500 bg-green-50 inline-block" />
          On Track
        </div>
      </div>

      {loaners.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-slate-400">
          <p className="text-base font-medium">No active loaners</p>
          <p className="text-sm mt-1">Your loaner return dates will appear here.</p>
        </div>
      ) : (
        <div style={{ height: 560 }}>
          <Calendar
            localizer={localizer}
            events={events}
            startAccessor="start"
            endAccessor="end"
            defaultView="month"
            views={["month", "agenda"]}
            eventPropGetter={eventStyleGetter}
            components={{ event: EventComponent }}
            style={{ fontFamily: "inherit" }}
          />
        </div>
      )}
    </div>
  );
}