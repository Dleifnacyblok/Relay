import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { DollarSign, Package, AlertTriangle, Clock, ChevronRight, Bell } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { formatCurrency } from "@/components/loaners/loanerUtils";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import LoanerTable from "@/components/loaners/LoanerTable";

export default function MyAccount() {
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [showAccountDialog, setShowAccountDialog] = useState(false);

  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
  });

  const { data: loaners = [], isLoading: loadingLoaners } = useQuery({
    queryKey: ["myLoaners", user?.full_name],
    queryFn: () => base44.entities.Loaners.filter({ repName: user?.full_name }),
    enabled: !!user?.full_name,
  });

  const { data: missingParts = [], isLoading: loadingParts } = useQuery({
    queryKey: ["myMissingParts", user?.full_name],
    queryFn: () => base44.entities.MissingPart.filter({ repName: user?.full_name }),
    enabled: !!user?.full_name,
  });

  const isLoading = loadingLoaners || loadingParts;

  // Calculate metrics
  const totalLoaners = loaners.length;
  const overdueLoaners = loaners.filter(l => l.isOverdue).length;
  const dueSoonLoaners = loaners.filter(l => !l.isOverdue && l.daysUntilDue >= 0 && l.daysUntilDue <= 7).length;
  const totalLoanerFines = loaners.reduce((sum, l) => sum + (l.fineAmount || 0), 0);
  
  const totalMissingParts = missingParts.length;
  const totalMissingPartsFines = missingParts.reduce((sum, p) => sum + (p.fineAmount || 0), 0);
  
  const totalFines = totalLoanerFines + totalMissingPartsFines;

  // Get unique accounts
  const uniqueAccounts = [...new Set(loaners.map(l => l.accountName))].filter(Boolean).sort();

  const handleAccountClick = (account) => {
    setSelectedAccount(account);
    setShowAccountDialog(true);
  };

  const selectedAccountLoaners = selectedAccount 
    ? loaners.filter(l => l.accountName === selectedAccount)
    : [];

  const StatCard = ({ title, value, icon: Icon, variant = "default" }) => {
    const variants = {
      default: "bg-white border-slate-200",
      danger: "bg-red-50 border-red-200",
      warning: "bg-amber-50 border-amber-200",
      success: "bg-green-50 border-green-200"
    };

    return (
      <Card className={`p-6 ${variants[variant]}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-600 mb-1">{title}</p>
            <p className="text-2xl font-bold text-slate-900">{value}</p>
          </div>
          <div className={`p-3 rounded-lg ${
            variant === 'danger' ? 'bg-red-100' :
            variant === 'warning' ? 'bg-amber-100' :
            variant === 'success' ? 'bg-green-100' :
            'bg-slate-100'
          }`}>
            <Icon className={`w-6 h-6 ${
              variant === 'danger' ? 'text-red-600' :
              variant === 'warning' ? 'text-amber-600' :
              variant === 'success' ? 'text-green-600' :
              'text-slate-600'
            }`} />
          </div>
        </div>
      </Card>
    );
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-7xl mx-auto">
          <Skeleton className="h-10 w-64 mb-8" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-32" />
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            My Accounts
          </h1>
          <p className="text-slate-500 mt-1">{user?.full_name}</p>
        </div>

        {/* Accounts List */}
        <Card className="p-6 bg-white border-slate-200 mb-8">
          {uniqueAccounts.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-8">No accounts assigned</p>
          ) : (
            <div className="grid gap-3">
              {uniqueAccounts.map((account, idx) => {
                const accountLoaners = loaners.filter(l => l.accountName === account);
                const accountParts = missingParts.filter(p => {
                  const loanerForPart = loaners.find(l => l.accountName === account && (l.setName === p.loanerSetName || l.etchId === p.etchId));
                  return loanerForPart;
                });
                const accountOverdue = accountLoaners.filter(l => l.isOverdue).length;
                const accountLoanerFines = accountLoaners.reduce((sum, l) => sum + (l.fineAmount || 0), 0);
                const accountPartsFines = accountParts.reduce((sum, p) => sum + (p.fineAmount || 0), 0);
                const accountTotalFines = accountLoanerFines + accountPartsFines;
                
                return (
                  <button 
                    key={idx}
                    onClick={() => handleAccountClick(account)}
                    className="w-full p-4 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-medium text-slate-900">{account}</p>
                      <ChevronRight className="w-5 h-5 text-slate-400" />
                    </div>
                    <div className="flex flex-wrap gap-4 text-sm text-slate-600">
                      <div>
                        <span className="font-medium">{accountLoaners.length}</span> loaner{accountLoaners.length !== 1 ? 's' : ''}
                        {accountOverdue > 0 && (
                          <span className="text-red-600 font-medium ml-1">• {accountOverdue} overdue</span>
                        )}
                      </div>
                      {accountParts.length > 0 && (
                        <div>
                          <span className="font-medium">{accountParts.length}</span> missing part{accountParts.length !== 1 ? 's' : ''}
                        </div>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </Card>

        {/* Stats Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard 
            title="Total Loaners" 
            value={totalLoaners}
            icon={Package}
            variant="default"
          />
          <StatCard 
            title="Overdue" 
            value={overdueLoaners}
            icon={AlertTriangle}
            variant="danger"
          />
          <StatCard 
            title="Due Soon (7 days)" 
            value={dueSoonLoaners}
            icon={Clock}
            variant="warning"
          />
          <StatCard 
            title="Missing Parts" 
            value={totalMissingParts}
            icon={Package}
            variant="warning"
          />
        </div>

        {/* Financial Summary */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="p-6 bg-white border-slate-200">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-5 h-5 text-slate-600" />
              <p className="text-sm text-slate-600">Loaner Fines</p>
            </div>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalLoanerFines)}</p>
          </Card>
          <Card className="p-6 bg-white border-slate-200">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-5 h-5 text-slate-600" />
              <p className="text-sm text-slate-600">Missing Parts Fines</p>
            </div>
            <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalMissingPartsFines)}</p>
          </Card>
          <Card className="p-6 bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <div className="flex items-center gap-3 mb-2">
              <DollarSign className="w-5 h-5 text-red-600" />
              <p className="text-sm text-red-900 font-medium">Total Fines</p>
            </div>
            <p className="text-3xl font-bold text-red-900">{formatCurrency(totalFines)}</p>
          </Card>
        </div>

        {/* Account Detail Dialog */}
        <Dialog open={showAccountDialog} onOpenChange={setShowAccountDialog}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedAccount}</DialogTitle>
              <DialogDescription>
                {selectedAccountLoaners.length} loaner{selectedAccountLoaners.length !== 1 ? 's' : ''}
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4">
              <LoanerTable loaners={selectedAccountLoaners} compact />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}