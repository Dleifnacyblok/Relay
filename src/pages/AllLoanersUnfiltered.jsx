import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Package } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import LoanerTable from "@/components/loaners/LoanerTable";
import { computeLoanerFields } from "@/components/loaners/loanerUtils";

export default function AllLoanersUnfiltered() {
  const { data: loaners = [], isLoading } = useQuery({
    queryKey: ["loaners"],
    queryFn: () => base44.entities.Loaners.list(),
  });

  const computedLoaners = loaners.map(computeLoanerFields);

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-black tracking-tight">
            All Loaners - Unfiltered
          </h1>
          <p className="text-gray-600 mt-1">
            Complete database view without any filters applied
          </p>
        </div>

        {/* Total Count */}
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6 text-center shadow-sm">
          <p className="text-sm text-gray-600 mb-1">Total Row Count</p>
          <p className="text-4xl font-bold text-black">
            {isLoading ? "..." : computedLoaners.length}
          </p>
        </div>

        {/* All Loaners Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-black">All Records</h2>
            <p className="text-sm text-gray-600">
              Every loaner in the database
            </p>
          </div>
          
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-16 rounded-lg bg-gray-100" />
              ))}
            </div>
          ) : computedLoaners.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-black font-medium">No records found</p>
              <p className="text-sm text-gray-600 mt-1">The database is empty</p>
            </div>
          ) : (
            <LoanerTable loaners={computedLoaners} />
          )}
        </div>
      </div>
    </div>
  );
}