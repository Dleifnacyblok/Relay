import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { DollarSign, Package, AlertTriangle, Clock, RefreshCw, ChevronRight, User, Bell, Calendar, Download } from "lucide-react";
import { Link } from "react-router-dom";
import { computeLoanerData, formatCurrency } from "@/components/loaners/loanerUtils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import LoanerTable from "@/components/loaners/LoanerTable";
import ProfileSettingsTab from "@/components/myaccount/ProfileSettingsTab";
import NotificationPrefsTab from "@/components/myaccount/NotificationPrefsTab";
import LoanerCalendarTab from "@/components/myaccount/LoanerCalendarTab";
import ExportDataTab from "@/components/myaccount/ExportDataTab";

const TABS = [
  { key: "profile", label: "Profile", icon: User },
  { key: "calendar", label: "Calendar", icon: Calendar },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "export", label: "Export", icon: Download },
];

export default function MyAccount() {
  const [activeTab, setActiveTab] = useState("profile");
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
  });

  const { data: allAssignments = [] } = useQuery({
    queryKey: ["repAccountAssignments"],
    queryFn: () => base44.entities.RepAccountAssignment.list(),
  });

  const managedAccounts = user?.managedAccounts || [];

  const assignedAccountNames = useMemo(() => {
    if (!user?.full_name) return [];
    return allAssignments
      .filter(a => {
        const reps = Array.isArray(a.assignedReps) ? a.assignedReps : (a.assignedRep ? [a.assignedRep] : []);
        return reps.includes(user.full_name);
      })
      .map(a => a.accountName)
      .filter(n => n && !n.startsWith("__rep_placeholder__"));
  }, [allAssignments, user?.full_name]);

  const allUserAccounts = useMemo(() =>
    [...new Set([...managedAccounts, ...assignedAccountNames])],
    [managedAccounts, assignedAccountNames]
  );

  const { data: allLoaners = [], isLoading: loadingLoaners } = useQuery({
    queryKey: ["loaners"],
    queryFn: () => base44.entities.Loaners.list(),
    enabled: !!user?.full_name,
  });

  const loaners = useMemo(() => {
    if (!user?.full_name) return [];
    const name = user.full_name.toLowerCase();
    return allLoaners
      .filter(l =>
        l.returnStatus !== "sent_back" &&
        l.returnStatus !== "received" &&
        (l.repName?.toLowerCase() === name ||
         l.associateSalesRep?.toLowerCase() === name ||
         l.fieldSalesRep?.toLowerCase() === name ||
         allUserAccounts.includes(l.accountName))
      )
      .map(computeLoanerData);
  }, [allLoaners, user?.full_name, allUserAccounts]);

  const { data: missingParts = [], isLoading: loadingParts } = useQuery({
    queryKey: ["missingParts"],
    queryFn: () => base44.entities.MissingPart.list(),
    enabled: !!user?.full_name,
  });

  const myMissingParts = useMemo(() =>
    missingParts.filter(p => p.repName?.toLowerCase() === (user?.full_name || "").toLowerCase()),
    [missingParts, user?.full_name]
  );

  const isLoading = loadingLoaners || loadingParts;

  const totalLoaners = loaners.length;
  const overdueLoaners = loaners.filter(l => l.isOverdue).length;
  const dueSoonLoaners = loaners.filter(l => !l.isOverdue && l.daysUntilDue >= 0 && l.daysUntilDue <= 7).length;
  const totalLoanerFines = loaners.reduce((sum, l) => sum + (l.fineAmount || 0), 0);
  const totalMissingParts = myMissingParts.length;
  const totalMissingPartsFines = myMissingParts.reduce((sum, p) => sum + (p.fineAmount || 0), 0);
  const totalFines = totalLoanerFines + totalMissingPartsFines;

  const uniqueAccounts = [...new Set(loaners.map(l => l.accountName))].filter(Boolean).sort();
  const selectedAccountLoaners = selectedAccount ? loaners.filter(l => l.accountName === selectedAccount) : [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-10 w-64 mb-8" />
          <div className="grid gap-4 md:grid-cols-4 mb-6">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24" />)}
          </div>
          <Skeleton className="h-96" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pb-24">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">

        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">My Account</h1>
            <p className="text-sm text-slate-500 mt-1">{user?.full_name} · {user?.email}</p>
          </div>
          <button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["repAccountAssignments"] });
              queryClient.invalidateQueries({ queryKey: ["loaners"] });
              queryClient.invalidateQueries({ queryKey: ["currentUser"] });
              queryClient.invalidateQueries({ queryKey: ["missingParts"] });
            }}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-600 border border-slate-200 hover:border-blue-300 rounded-full px-3 py-1.5 transition-colors"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>

        {/* Accounts Quick View (profile tab only) */}
        {activeTab === "profile" && uniqueAccounts.length > 0 && (
          <Card className="bg-white border-slate-200 mb-6">
            <div className="px-5 py-3 border-b border-slate-100">
              <p className="text-sm font-semibold text-slate-700">Active Accounts</p>
            </div>
            <div className="divide-y divide-slate-50">
              {uniqueAccounts.map((account, idx) => {
                const accountLoaners = loaners.filter(l => l.accountName === account);
                const accountOverdue = accountLoaners.filter(l => l.isOverdue).length;
                return (
                  <button
                    key={idx}
                    onClick={() => { setSelectedAccount(account); setShowAccountDialog(true); }}
                    className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition-colors text-left"
                  >
                    <div>
                      <p className="font-medium text-sm text-slate-900">{account}</p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {accountLoaners.length} loaner{accountLoaners.length !== 1 ? "s" : ""}
                        {accountOverdue > 0 && <span className="text-red-500 ml-2">• {accountOverdue} overdue</span>}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400" />
                  </button>
                );
              })}
            </div>
          </Card>
        )}

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-5">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === key
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        {activeTab === "profile" && (
          <ProfileSettingsTab
            user={user}
            managedAccounts={managedAccounts}
            assignedAccountNames={assignedAccountNames}
            allAssignments={allAssignments}
          />
        )}
        {activeTab === "calendar" && (
          <LoanerCalendarTab loaners={loaners} />
        )}
        {activeTab === "notifications" && (
          <NotificationPrefsTab user={user} />
        )}
        {activeTab === "export" && (
          <ExportDataTab
            loaners={loaners}
            missingParts={myMissingParts}
            userName={user?.full_name || ""}
          />
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
          {[
            { label: "Total Loaners", value: totalLoaners, icon: Package, variant: "default" },
            { label: "Overdue", value: overdueLoaners, icon: AlertTriangle, variant: "danger" },
            { label: "Due Soon", value: dueSoonLoaners, icon: Clock, variant: "warning" },
            { label: "Missing Parts", value: totalMissingParts, icon: Package, variant: "warning" },
          ].map(({ label, value, icon: Icon, variant }) => (
            <Card key={label} className={`p-4 ${
              variant === "danger" ? "bg-red-50 border-red-200" :
              variant === "warning" ? "bg-amber-50 border-amber-200" :
              "bg-white border-slate-200"
            }`}>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-slate-500">{label}</p>
                  <p className="text-2xl font-bold text-slate-900 mt-0.5">{value}</p>
                </div>
                <Icon className={`w-5 h-5 ${
                  variant === "danger" ? "text-red-400" :
                  variant === "warning" ? "text-amber-400" :
                  "text-slate-400"
                }`} />
              </div>
            </Card>
          ))}
        </div>

        {/* Fines Row */}
        <div className="grid grid-cols-3 gap-3 mt-3 mb-6">
          <Card className="p-4 bg-white border-slate-200">
            <p className="text-xs text-slate-500 mb-1">Loaner Fines</p>
            <p className="text-lg font-bold text-slate-900">{formatCurrency(totalLoanerFines)}</p>
          </Card>
          <Card className="p-4 bg-white border-slate-200">
            <p className="text-xs text-slate-500 mb-1">Parts Fines</p>
            <p className="text-lg font-bold text-slate-900">{formatCurrency(totalMissingPartsFines)}</p>
          </Card>
          <Card className="p-4 bg-gradient-to-br from-red-50 to-red-100 border-red-200">
            <p className="text-xs text-red-700 font-medium mb-1">Total Fines</p>
            <p className="text-lg font-bold text-red-900">{formatCurrency(totalFines)}</p>
          </Card>
        </div>

        {/* Account Detail Dialog */}
        <Dialog open={showAccountDialog} onOpenChange={setShowAccountDialog}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedAccount}</DialogTitle>
              <DialogDescription>{selectedAccountLoaners.length} loaner{selectedAccountLoaners.length !== 1 ? "s" : ""}</DialogDescription>
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