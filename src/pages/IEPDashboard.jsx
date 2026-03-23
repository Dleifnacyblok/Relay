import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Package, AlertTriangle, TrendingUp, Users } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import LoanerTable from "@/components/loaners/LoanerTable";
import { computeLoanerData, formatCurrency } from "@/components/loaners/loanerUtils";
import { isIEPLoaner } from "@/lib/iepUtils";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";

const StatCard = ({ icon: Icon, label, value, color }) => (
  <div className={`bg-white rounded-xl border border-gray-200 p-4 shadow-sm ${color}`}>
    <div className="flex items-start gap-3">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs text-gray-600 font-medium">{label}</p>
        <p className="text-2xl font-bold text-black mt-1">{value}</p>
      </div>
    </div>
  </div>
);

export default function IEPDashboard() {
  const { data: loaners = [], isLoading } = useQuery({
    queryKey: ["loaners"],
    queryFn: () => base44.entities.Loaners.list(),
  });

  const computedLoaners = loaners.map(computeLoanerData);
  
  // Filter for IEP loaners only (active)
  const iepLoaners = computedLoaners.filter(l => 
    isIEPLoaner(l) && 
    l.returnStatus !== "sent_back" && 
    l.returnStatus !== "received"
  );

  // Calculate metrics
  const iepOverdueCount = iepLoaners.filter(l => l.risk_status === "Overdue").length;
  const iepDueSoonCount = iepLoaners.filter(l => l.risk_status === "Due Soon").length;
  const iepTotalFines = iepLoaners.reduce((sum, l) => sum + (l.fineAmount || 0), 0);

  // Rep distribution
  const repDistribution = {};
  iepLoaners.forEach(l => {
    const rep = l.repName || "Unassigned";
    repDistribution[rep] = (repDistribution[rep] || 0) + 1;
  });
  const repData = Object.entries(repDistribution)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Account distribution
  const accountDistribution = {};
  iepLoaners.forEach(l => {
    const account = l.accountName || "Unassigned";
    accountDistribution[account] = (accountDistribution[account] || 0) + 1;
  });
  const accountData = Object.entries(accountDistribution)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  // Most consistent users (reps with most IEP loaner instances)
  const topReps = repData.slice(0, 5);

  const COLORS = ["#3B82F6", "#8B5CF6", "#EC4899", "#F59E0B", "#10B981"];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-black tracking-tight mb-2">
            IEP Loaners Dashboard
          </h1>
          <p className="text-gray-600">
            Tracked IEP loaner inventory and usage patterns
          </p>
        </div>

        {isLoading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <StatCard 
              icon={Package}
              label="Total IEP Loaners"
              value={iepLoaners.length}
              color="bg-blue-50"
            />
            <StatCard 
              icon={AlertTriangle}
              label="IEP Overdue"
              value={iepOverdueCount}
              color={iepOverdueCount > 0 ? "bg-red-50" : "bg-gray-50"}
            />
            <StatCard 
              icon={TrendingUp}
              label="Due Soon"
              value={iepDueSoonCount}
              color={iepDueSoonCount > 0 ? "bg-amber-50" : "bg-gray-50"}
            />
            <StatCard 
              icon={AlertTriangle}
              label="Total Fines"
              value={formatCurrency(iepTotalFines)}
              color={iepTotalFines > 0 ? "bg-red-50" : "bg-gray-50"}
            />
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {/* Rep Distribution Chart */}
          {!isLoading && repData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-black mb-4">IEP Loaners by Rep</h2>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={repData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip 
                    contentStyle={{ backgroundColor: "#fff", border: "1px solid #e5e7eb" }}
                    cursor={{ fill: "rgba(59, 130, 246, 0.1)" }}
                  />
                  <Bar dataKey="count" fill="#3B82F6" radius={[8, 8, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Account Distribution Chart */}
          {!isLoading && accountData.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-black mb-4">IEP Loaners by Account</h2>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={accountData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, count }) => `${name}: ${count}`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="count"
                  >
                    {accountData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>

        {/* Top Reps Using IEP Loaners */}
        {!isLoading && topReps.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm mb-8">
            <h2 className="text-lg font-semibold text-black mb-4 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-600" />
              Most Consistent IEP Users
            </h2>
            <div className="space-y-3">
              {topReps.map((rep, idx) => (
                <div key={rep.name} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-sm font-semibold text-blue-600">
                      {idx + 1}
                    </div>
                    <span className="font-medium text-black">{rep.name}</span>
                  </div>
                  <span className="text-sm font-semibold text-gray-600">{rep.count} loaner{rep.count !== 1 ? 's' : ''}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* IEP Loaners Table */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-lg font-semibold text-black">All IEP Loaners</h2>
            <p className="text-sm text-gray-600 mt-1">
              Detailed view of tracked IEP loaner inventory
            </p>
          </div>
          
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4, 5].map(i => (
                <Skeleton key={i} className="h-16 rounded-lg bg-gray-100" />
              ))}
            </div>
          ) : iepLoaners.length === 0 ? (
            <div className="p-12 text-center">
              <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-black font-medium">No IEP loaners found</p>
              <p className="text-sm text-gray-600 mt-1">No tracked IEP loaners in the system</p>
            </div>
          ) : (
            <LoanerTable loaners={iepLoaners} />
          )}
        </div>

      </div>
    </div>
  );
}