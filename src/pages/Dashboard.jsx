import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { AlertTriangle, Clock, DollarSign, Package, User } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import StatCard from "@/components/loaners/StatCard";
import LoanerTable from "@/components/loaners/LoanerTable";
import { computeLoanerFields, sortLoanersByRisk, formatCurrency } from "@/components/loaners/loanerUtils";

export default function Dashboard() {
  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
  });

  const { data: loaners = [], isLoading } = useQuery({
    queryKey: ["loaners"],
    queryFn: () => base44.entities.Loaners.list(),
  });

  const userName = user?.full_name || "";

  const computedLoaners = loaners.map(computeLoanerFields);
  const overdueCount = computedLoaners.filter(l => l.risk_status === "Overdue").length;
  const dueSoonCount = computedLoaners.filter(l => l.risk_status === "Due Soon").length;
  const totalFineExposure = computedLoaners.reduce((sum, l) => sum + (l.fine_exposure || 0), 0);
  
  // Show all loaners - no filters
  const myLoaners = sortLoanersByRisk(
    computedLoaners.filter(l => 
      l.primary_rep?.toLowerCase() === userName.toLowerCase() ||
      l.associate_rep?.toLowerCase() === userName.toLowerCase()
    )
  );
  
  const otherLoaners = sortLoanersByRisk(
    computedLoaners.filter(l => 
      l.primary_rep?.toLowerCase() !== userName.toLowerCase() &&
      l.associate_rep?.toLowerCase() !== userName.toLowerCase()
    )
  );
  
  const riskLoaners = [...myLoaners, ...otherLoaners];

  return (
    <div className="min-h-screen" style={{backgroundColor: '#FFFFFF'}}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-8 text-center" style={{backgroundColor: '#FFFFFF'}}>
          <h1 className="text-2xl sm:text-3xl tracking-tight" style={{color: '#000000'}}>
            <span className="font-bold">ESC -</span> <span className="italic font-extrabold" style={{fontSize: '1.1em'}}>Relay</span>
          </h1>
          <p className="text-sm italic mt-0.5" style={{color: '#333333'}}>
            Real time loaner movement and risk tracking
          </p>
        </div>

        {/* Stats Cards */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard
              title="Overdue Sets"
              value={overdueCount}
              icon={AlertTriangle}
              variant={overdueCount > 0 ? "danger" : "default"}
              subtitle="Require immediate attention"
            />
            <StatCard
              title="Due Soon"
              value={dueSoonCount}
              icon={Clock}
              variant={dueSoonCount > 0 ? "warning" : "default"}
              subtitle="Within 3 days"
            />
            <StatCard
              title="Fine Exposure"
              value={formatCurrency(totalFineExposure)}
              icon={DollarSign}
              variant={totalFineExposure > 0 ? "danger" : "default"}
              subtitle="$50/day overdue"
            />
            <StatCard
              title="Total Loaners"
              value={computedLoaners.length}
              icon={Package}
              variant="default"
              subtitle="Active in territory"
            />
          </div>
        )}

        {/* Risk Board */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden" style={{marginBottom: '20px'}}>
          <div className="px-5 py-4" style={{backgroundColor: '#FFFFFF', borderBottom: '1px solid rgba(0,0,0,0.06)'}}>
            <h2 className="text-lg font-semibold" style={{color: '#111111'}}>All Loaners</h2>
            <p className="text-sm" style={{color: '#666666'}}>
              Complete loaner inventory - {computedLoaners.length} total records
            </p>
          </div>
          
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-16 rounded-lg bg-gray-100" />
              ))}
            </div>
          ) : riskLoaners.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-emerald-100 flex items-center justify-center">
                <Package className="w-6 h-6 text-emerald-600" />
              </div>
              <p className="text-black font-medium">All clear!</p>
              <p className="text-sm text-gray-600 mt-1">No overdue or at-risk loaners</p>
            </div>
          ) : (
            <LoanerTable loaners={riskLoaners} />
          )}
        </div>
      </div>
    </div>
  );
}