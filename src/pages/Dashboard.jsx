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
          <h1 
            className="font-semibold" 
            style={{
              color: '#000000',
              fontSize: '48px',
              letterSpacing: '-0.04em',
              textShadow: '0 4px 24px rgba(59,130,246,0.20), 0 8px 40px rgba(147,51,234,0.12)',
              fontFamily: 'system-ui, -apple-system, sans-serif'
            }}
          >
            Relay
          </h1>
          <p className="text-xs font-light" style={{color: '#6B7280', letterSpacing: '0.15em', textTransform: 'uppercase', marginTop: '2px'}}>
            Loaner Operations
          </p>
          <p className="text-xs" style={{color: '#9CA3AF', letterSpacing: '0.08em', textTransform: 'uppercase', marginTop: '6px'}}>
            Beta
          </p>
          <p className="text-xs font-light" style={{color: '#888888', opacity: 0.85, marginTop: '6px'}}>
            Last imported • Feb 14, 2026 – 2:18 PM
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