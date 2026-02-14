import { format, parseISO } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ChevronRight } from "lucide-react";
import RiskBadge from "./RiskBadge";
import { formatCurrency } from "./loanerUtils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function LoanerTable({ loaners, compact = false }) {
  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      return format(parseISO(dateStr), "MMM d, yyyy");
    } catch {
      return dateStr;
    }
  };

  if (loaners.length === 0) {
    return (
      <div className="text-center py-12 text-slate-500">
        <p className="text-sm">No loaners found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {loaners.map((loaner) => (
          <Link
            key={loaner.id}
            to={createPageUrl("LoanerDetail") + `?id=${loaner.id}`}
            className="block bg-white border border-slate-200 rounded-xl p-4 hover:shadow-md transition-shadow"
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-slate-900 truncate">{loaner.set_name}</h3>
                <p className="text-xs text-slate-500">{loaner.set_id}</p>
              </div>
              <RiskBadge riskStatus={loaner.risk_status} />
            </div>
            <div className="grid grid-cols-2 gap-2 text-sm">
              <div>
                <span className="text-slate-500">Account:</span>
                <p className="font-medium text-slate-800 truncate">{loaner.account_name || "—"}</p>
              </div>
              <div>
                <span className="text-slate-500">Due:</span>
                <p className="font-medium text-slate-800">{formatDate(loaner.expected_return_date)}</p>
              </div>
              <div>
                <span className="text-slate-500">Rep:</span>
                <p className="font-medium text-slate-800 truncate">{loaner.primary_rep || "—"}</p>
              </div>
              {loaner.fine_exposure > 0 && (
                <div>
                  <span className="text-slate-500">Fine:</span>
                  <p className="font-semibold text-red-600">{formatCurrency(loaner.fine_exposure)}</p>
                </div>
              )}
            </div>
          </Link>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="bg-slate-50/80">
              <TableHead className="font-semibold">Set</TableHead>
              <TableHead className="font-semibold">Account</TableHead>
              {!compact && <TableHead className="font-semibold">Reps</TableHead>}
              <TableHead className="font-semibold">Status</TableHead>
              <TableHead className="font-semibold">Expected Return</TableHead>
              <TableHead className="font-semibold">Risk</TableHead>
              <TableHead className="font-semibold text-right">Fine</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loaners.map((loaner) => (
              <TableRow 
                key={loaner.id} 
                className="hover:bg-slate-50/50 transition-colors cursor-pointer"
              >
                <TableCell>
                  <Link 
                    to={createPageUrl("LoanerDetail") + `?id=${loaner.id}`}
                    className="hover:text-indigo-600"
                  >
                    <div className="font-medium text-slate-900">{loaner.set_name}</div>
                    <div className="text-xs text-slate-500">{loaner.set_id}</div>
                  </Link>
                </TableCell>
                <TableCell className="text-slate-700">{loaner.account_name || "—"}</TableCell>
                {!compact && (
                  <TableCell>
                    <div className="text-slate-700">{loaner.primary_rep || "—"}</div>
                    {loaner.associate_rep && (
                      <div className="text-xs text-slate-500">{loaner.associate_rep_display}</div>
                    )}
                  </TableCell>
                )}
                <TableCell>
                  <span className="px-2 py-1 bg-slate-100 text-slate-700 rounded text-xs font-medium">
                    {loaner.status || "—"}
                  </span>
                </TableCell>
                <TableCell className="text-slate-700">{formatDate(loaner.expected_return_date)}</TableCell>
                <TableCell>
                  <RiskBadge riskStatus={loaner.risk_status} />
                </TableCell>
                <TableCell className="text-right">
                  {loaner.fine_exposure > 0 ? (
                    <span className="font-semibold text-red-600">
                      {formatCurrency(loaner.fine_exposure)}
                    </span>
                  ) : (
                    <span className="text-slate-400">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Link 
                    to={createPageUrl("LoanerDetail") + `?id=${loaner.id}`}
                    className="text-slate-400 hover:text-indigo-600"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}