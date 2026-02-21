import { format, parseISO } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { ChevronRight } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
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

export default function LoanerTable({ loaners, compact = false, selectable = false, selectedIds = [], onSelectOne }) {
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
      <div className="text-center py-12 text-gray-500">
        <p className="text-sm">No loaners found</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      {/* Mobile Card View */}
      <div className="md:hidden space-y-3">
        {loaners.map((loaner) => (
          <div
            key={loaner.id}
            className="rounded-xl py-4 px-4 transition-all cursor-pointer"
            style={{
              backgroundColor: '#FFFFFF',
              border: selectedIds.includes(loaner.id) ? '1.5px solid #3B82F6' : '1px solid #E5E7EB',
              boxShadow: '0px 2px 8px rgba(0, 0, 0, 0.04)',
            }}
            onClick={() => selectable ? onSelectOne?.(loaner.id) : null}
          >
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-start gap-3 flex-1 min-w-0">
                  {selectable && (
                    <Checkbox
                      checked={selectedIds.includes(loaner.id)}
                      onCheckedChange={(e) => { e.stopPropagation?.(); onSelectOne?.(loaner.id); }}
                      onClick={(e) => e.stopPropagation()}
                      className="mt-1 shrink-0"
                    />
                  )}
                  <div className="min-w-0">
                    <h3 className="font-bold truncate" style={{color: '#000000'}}>{loaner.setName}</h3>
                    <p className="text-xs mt-0.5">
                      <span style={{color: '#777777'}}>Etch ID: </span>
                      <span style={{color: '#222222', letterSpacing: '0.02em'}}>{loaner.etchId || "(missing)"}</span>
                    </p>
                  </div>
                </div>
                <RiskBadge riskStatus={loaner.risk_status} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="text-gray-500">Account:</span>
                  <p className="font-medium text-gray-900 truncate">{loaner.accountName || "—"}</p>
                </div>
                <div>
                  <span className="text-gray-500">Due:</span>
                  <p className="font-medium text-gray-900">{formatDate(loaner.expectedReturnDate)}</p>
                </div>
                <div>
                  <span className="text-gray-500">Rep:</span>
                  <p className="font-medium text-gray-900 truncate">{loaner.repName || "—"}</p>
                </div>
                {loaner.fineAmount > 0 && (
                  <div>
                    <span className="text-gray-500">Fine:</span>
                    <p className={`font-semibold ${loaner.feesWaived ? "text-green-600 line-through" : "text-red-600"}`}>
                      {formatCurrency(loaner.fineAmount)}
                      {loaner.feesWaived && <span className="text-xs ml-1 no-underline">(Waived)</span>}
                    </p>
                  </div>
                )}
              </div>
          </div>
        ))}
      </div>

      {/* Desktop Table View */}
      <div className="hidden md:block">
        <Table>
          <TableHeader>
            <TableRow className="border-gray-200 hover:bg-transparent">
              {selectable && <TableHead className="w-12"></TableHead>}
              <TableHead className="font-semibold text-gray-600">Set</TableHead>
              <TableHead className="font-semibold text-gray-600">Account</TableHead>
              {!compact && <TableHead className="font-semibold text-gray-600">Rep</TableHead>}
              <TableHead className="font-semibold text-gray-600">Expected Return</TableHead>
              <TableHead className="font-semibold text-gray-600">Risk</TableHead>
              <TableHead className="font-semibold text-gray-600 text-right">Fine</TableHead>
              <TableHead className="w-10"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loaners.map((loaner) => (
              <TableRow 
                key={loaner.id} 
                className="border-gray-200 hover:bg-gray-50 transition-colors cursor-pointer"
              >
                {selectable && (
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <Checkbox
                      checked={selectedIds.includes(loaner.id)}
                      onCheckedChange={() => onSelectOne?.(loaner.id)}
                    />
                  </TableCell>
                )}
                <TableCell>
                  <Link 
                      to={createPageUrl("LoanerDetail") + `?id=${loaner.id}`}
                      className="hover:text-black"
                    >
                      <div className="font-bold" style={{color: '#000000'}}>{loaner.setName}</div>
                      <div className="text-xs mt-0.5">
                        <span style={{color: '#777777'}}>Etch ID: </span>
                        <span style={{color: '#222222', letterSpacing: '0.02em'}}>{loaner.etchId || "(missing)"}</span>
                      </div>
                    </Link>
                </TableCell>
                <TableCell className="text-gray-900">{loaner.accountName || "—"}</TableCell>
                {!compact && (
                  <TableCell>
                    <div className="text-gray-900">{loaner.repName || "—"}</div>
                  </TableCell>
                )}
                <TableCell className="text-gray-900">{formatDate(loaner.expectedReturnDate)}</TableCell>
                <TableCell>
                  <RiskBadge riskStatus={loaner.risk_status} />
                </TableCell>
                <TableCell className="text-right">
                  {loaner.fineAmount > 0 ? (
                    <div className="text-right">
                      <span className={`font-semibold ${loaner.feesWaived ? "text-green-600 line-through" : "text-red-600"}`}>
                        {formatCurrency(loaner.fineAmount)}
                      </span>
                      {loaner.feesWaived && (
                        <span className="block text-xs text-green-600 font-medium">Waived</span>
                      )}
                    </div>
                  ) : (
                    <span className="text-gray-400">—</span>
                  )}
                </TableCell>
                <TableCell>
                  <Link 
                    to={createPageUrl("LoanerDetail") + `?id=${loaner.id}`}
                    className="text-gray-400 hover:text-black"
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