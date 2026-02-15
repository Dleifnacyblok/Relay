import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { AlertCircle, Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { formatCurrency } from "@/components/loaners/loanerUtils";
import { format, parseISO } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";

export default function MyMissingParts() {
  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
  });

  const { data: missingParts = [], isLoading: partsLoading } = useQuery({
    queryKey: ["missingParts"],
    queryFn: () => base44.entities.MissingPart.list(),
  });

  const isLoading = userLoading || partsLoading;
  const userName = user?.full_name || "";

  const myParts = missingParts.filter(p => 
    p.repName?.toLowerCase() === userName.toLowerCase()
  );

  const activeParts = myParts.filter(p => p.status === "missing");
  const totalFines = activeParts.reduce((sum, p) => sum + (p.fineAmount || 0), 0);

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      return format(parseISO(dateStr), "MMM d, yyyy");
    } catch {
      return dateStr;
    }
  };

  const statusColors = {
    missing: "bg-red-100 text-red-800 border-red-200",
    found: "bg-green-100 text-green-800 border-green-200",
    paid: "bg-blue-100 text-blue-800 border-blue-200"
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-orange-100">
              <AlertCircle className="w-5 h-5 text-orange-600" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              My Missing Parts
            </h1>
          </div>
          <p className="text-slate-500 ml-12">
            {userName ? `Missing parts assigned to you` : "Loading..."}
          </p>
        </div>

        {/* Quick Stats */}
        {!isLoading && myParts.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-sm">
              <span className="text-slate-500">Total:</span>
              <span className="font-semibold text-slate-900">{myParts.length}</span>
            </div>
            {activeParts.length > 0 && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-full text-sm">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="font-semibold text-red-700">{activeParts.length} Missing</span>
              </div>
            )}
            {totalFines > 0 && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-full text-sm">
                <span className="text-slate-500">Total Fines:</span>
                <span className="font-bold text-red-700">{formatCurrency(totalFines)}</span>
              </div>
            )}
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : myParts.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                <Package className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-slate-600 font-medium">No missing parts</p>
              <p className="text-sm text-slate-500 mt-1">
                You have no missing parts recorded in the system
              </p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-4 p-4">
                {myParts.map((part) => (
                  <div
                    key={part.id}
                    className="rounded-xl py-5 px-4"
                    style={{
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #F8F8F8',
                      boxShadow: '0px 4px 16px rgba(0, 0, 0, 0.04)',
                    }}
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900">{part.partName}</h3>
                        {part.partNumber && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            Part #: {part.partNumber}
                          </p>
                        )}
                      </div>
                      <Badge className={statusColors[part.status] || statusColors.missing}>
                        {part.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {part.loanerSetName && (
                        <div>
                          <span className="text-gray-500">Loaner:</span>
                          <p className="font-medium text-gray-900 truncate">{part.loanerSetName}</p>
                        </div>
                      )}
                      {part.etchId && (
                        <div>
                          <span className="text-gray-500">Etch ID:</span>
                          <p className="font-medium text-gray-900">{part.etchId}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-500">Date:</span>
                        <p className="font-medium text-gray-900">{formatDate(part.missingDate)}</p>
                      </div>
                      {part.fineAmount > 0 && (
                        <div>
                          <span className="text-gray-500">Fine:</span>
                          <p className="font-semibold text-red-600">{formatCurrency(part.fineAmount)}</p>
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
                      <TableHead className="font-semibold text-gray-600">Part Name</TableHead>
                      <TableHead className="font-semibold text-gray-600">Part Number</TableHead>
                      <TableHead className="font-semibold text-gray-600">Loaner</TableHead>
                      <TableHead className="font-semibold text-gray-600">Etch ID</TableHead>
                      <TableHead className="font-semibold text-gray-600">Date Missing</TableHead>
                      <TableHead className="font-semibold text-gray-600">Status</TableHead>
                      <TableHead className="font-semibold text-gray-600 text-right">Fine</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {myParts.map((part) => (
                      <TableRow 
                        key={part.id} 
                        className="border-gray-200 hover:bg-gray-50 transition-colors"
                      >
                        <TableCell className="font-medium text-gray-900">{part.partName}</TableCell>
                        <TableCell className="text-gray-600">{part.partNumber || "—"}</TableCell>
                        <TableCell className="text-gray-900">{part.loanerSetName || "—"}</TableCell>
                        <TableCell className="text-gray-600">{part.etchId || "—"}</TableCell>
                        <TableCell className="text-gray-900">{formatDate(part.missingDate)}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[part.status] || statusColors.missing}>
                            {part.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {part.fineAmount > 0 ? (
                            <span className="font-semibold text-red-600">
                              {formatCurrency(part.fineAmount)}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}