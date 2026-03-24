import { useState, useRef, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  DollarSign, Package, AlertTriangle, Clock, ChevronRight,
  X, Plus, Pencil, Check, RefreshCw, User, Bell, Calendar, Download,
} from "lucide-react";
import { computeLoanerData, formatCurrency } from "@/components/loaners/loanerUtils";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import LoanerTable from "@/components/loaners/LoanerTable";
import LoanerCalendarTab from "@/components/account/LoanerCalendarTab";
import ExportDataTab from "@/components/account/ExportDataTab";
import NotificationPrefsTab from "@/components/account/NotificationPrefsTab";

const TABS = [
  { key: "profile", label: "Profile", icon: User },
  { key: "calendar", label: "Loaner Calendar", icon: Calendar },
  { key: "notifications", label: "Notifications", icon: Bell },
  { key: "export", label: "Export Data", icon: Download },
];

export default function MyAccount() {
  const [activeTab, setActiveTab] = useState("profile");
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [showAccountDialog, setShowAccountDialog] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [addAccountSearch, setAddAccountSearch] = useState("");
  const addAccountRef = useRef(null);
  const queryClient = useQueryClient();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);

  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
  });

  const { data: allAssignments = [] } = useQuery({
    queryKey: ["repAccountAssignments"],
    queryFn: () => base44.entities.RepAccountAssignment.list(),
  });

  useEffect(() => {
    const handler = (e) => {
      if (addAccountRef.current && !addAccountRef.current.contains(e.target)) {
        setShowAddAccount(false);
        setAddAccountSearch("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

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

  const accountSearchResults = addAccountSearch.trim()
    ? [...new Set(allAssignments.map(a => a.accountName).filter(Boolean))]
        .filter(name =>
          name.toLowerCase().includes(addAccountSearch.toLowerCase()) &&
          !managedAccounts.includes(name)
        )
        .sort()
        .slice(0, 10)
    : [];

  const handleAddAccount = async (accountName) => {
    const updated = [...managedAccounts, accountName];
    await base44.auth.updateMe({ managedAccounts: updated });
    queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    setAddAccountSearch("");
    setShowAddAccount(false);
  };

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === user?.full_name) { setEditingName(false); return; }
    setSavingName(true);
    await base44.auth.updateMe({ full_name: trimmed });
    queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    setSavingName(false);
    setEditingName(false);
  };

  const handleRemoveAccount = async (accountName) => {
    const updated = managedAccounts.filter(a => a !== accountName);
    await base44.auth.updateMe({ managedAccounts: updated });
    queryClient.invalidateQueries({ queryKey: ["currentUser"] });
  };

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

  const { data: allMissingParts = [], isLoading: loadingParts } = useQuery({
    queryKey: ["missingParts"],
    queryFn: () => base44.entities.MissingPart.list(),
    enabled: !!user?.full_name,
  });

  const myMissingParts = useMemo(() =>
    allMissingParts.filter(p => p.repName?.toLowerCase() === (user?.full_name || "").toLowerCase()),
    [allMissingParts, user?.full_name]
  );

  const isLoading = loadingLoaners || loadingParts;

  const overdueLoaners = loaners.filter(l => l.isOverdue).length;
  const dueSoonLoaners = loaners.filter(l => !l.isOverdue && l.daysUntilDue >= 0 && l.daysUntilDue <= 7).length;
  const totalLoanerFines = loaners.reduce((sum, l) => sum + (l.fineAmount || 0), 0);
  const totalMissingPartsFines = myMissingParts.reduce((sum, p) => sum + (p.fineAmount || 0), 0);
  const totalFines = totalLoanerFines + totalMissingPartsFines;

  const uniqueAccounts = [...new Set(loaners.map(l => l.accountName))].filter(Boolean).sort();

  const selectedAccountLoaners = selectedAccount
    ? loaners.filter(l => l.accountName === selectedAccount)
    : [];

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-6">
        <div className="max-w-4xl mx-auto">
          <Skeleton className="h-10 w-64 mb-8" />
          <Skeleton className="h-12 w-full mb-6" />
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
            {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-32" />)}
          </div>
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
            <p className="text-xs text-slate-400 uppercase font-semibold mt-2 mb-0.5">Rep</p>
            {editingName ? (
              <div className="flex items-center gap-2 mt-1">
                <Input
                  autoFocus
                  value={nameInput}
                  onChange={e => setNameInput(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") handleSaveName();
                    if (e.key === "Escape") setEditingName(false);
                  }}
                  className="h-8 text-sm w-48"
                />
                <button onClick={handleSaveName} disabled={savingName} className="text-green-600 hover:text-green-800"><Check size={16} /></button>
                <button onClick={() => setEditingName(false)} className="text-gray-400 hover:text-gray-600"><X size={16} /></button>
              </div>
            ) : (
              <div className="flex items-center gap-2 mt-1">
                <p className="text-base font-medium text-slate-700">{user?.full_name}</p>
                <button
                  onClick={() => { setNameInput(user?.full_name || ""); setEditingName(true); }}
                  className="text-slate-300 hover:text-blue-500 transition-colors"
                >
                  <Pencil size={14} />
                </button>
              </div>
            )}
          </div>
          <button
            onClick={() => {
              queryClient.invalidateQueries({ queryKey: ["repAccountAssignments"] });
              queryClient.invalidateQueries({ queryKey: ["loaners"] });
              queryClient.invalidateQueries({ queryKey: ["currentUser"] });
              queryClient.invalidateQueries({ queryKey: ["missingParts"] });
            }}
            className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-blue-600 border border-slate-200 hover:border-blue-300 rounded-full px-3 py-1.5 transition-colors mt-1"
          >
            <RefreshCw className="w-3 h-3" /> Refresh
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-100 rounded-xl p-1 mb-6 overflow-x-auto">
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setActiveTab(key)}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium whitespace-nowrap transition-all flex-1 justify-center
                ${activeTab === key
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
                }`}
            >
              <Icon className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div>
          {/* PROFILE TAB */}
          {activeTab === "profile" && (
            <div className="space-y-6">
              {/* Stats */}
              <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
                {[
                  { title: "Total Loaners", value: loaners.length, icon: Package, colorCard: "bg-white border-slate-200", colorIcon: "bg-slate-100", colorIc: "text-slate-600" },
                  { title: "Overdue", value: overdueLoaners, icon: AlertTriangle, colorCard: "bg-red-50 border-red-200", colorIcon: "bg-red-100", colorIc: "text-red-600" },
                  { title: "Due Soon (7d)", value: dueSoonLoaners, icon: Clock, colorCard: "bg-amber-50 border-amber-200", colorIcon: "bg-amber-100", colorIc: "text-amber-600" },
                  { title: "Missing Parts", value: myMissingParts.length, icon: Package, colorCard: "bg-amber-50 border-amber-200", colorIcon: "bg-amber-100", colorIc: "text-amber-600" },
                ].map(({ title, value, icon: Icon, colorCard, colorIcon, colorIc }) => (
                  <Card key={title} className={`p-4 ${colorCard}`}>
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-slate-600 mb-1">{title}</p>
                        <p className="text-2xl font-bold text-slate-900">{value}</p>
                      </div>
                      <div className={`p-2.5 rounded-lg ${colorIcon}`}>
                        <Icon className={`w-5 h-5 ${colorIc}`} />
                      </div>
                    </div>
                  </Card>
                ))}
              </div>

              {/* Financial Summary */}
              <div className="grid gap-4 md:grid-cols-3">
                <Card className="p-5 bg-white border-slate-200">
                  <div className="flex items-center gap-3 mb-2">
                    <DollarSign className="w-4 h-4 text-slate-600" />
                    <p className="text-sm text-slate-600">Loaner Fines</p>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalLoanerFines)}</p>
                </Card>
                <Card className="p-5 bg-white border-slate-200">
                  <div className="flex items-center gap-3 mb-2">
                    <DollarSign className="w-4 h-4 text-slate-600" />
                    <p className="text-sm text-slate-600">Missing Parts Fines</p>
                  </div>
                  <p className="text-2xl font-bold text-slate-900">{formatCurrency(totalMissingPartsFines)}</p>
                </Card>
                <Card className="p-5 bg-gradient-to-br from-red-50 to-red-100 border-red-200">
                  <div className="flex items-center gap-3 mb-2">
                    <DollarSign className="w-4 h-4 text-red-600" />
                    <p className="text-sm text-red-900 font-medium">Total Fines</p>
                  </div>
                  <p className="text-3xl font-bold text-red-900">{formatCurrency(totalFines)}</p>
                </Card>
              </div>

              {/* Accounts List */}
              <Card className="p-5 bg-white border-slate-200">
                <p className="text-sm font-semibold text-slate-700 mb-3">Active Accounts</p>
                {uniqueAccounts.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-6">No accounts assigned</p>
                ) : (
                  <div className="grid gap-2">
                    {uniqueAccounts.map((account) => {
                      const accountLoaners = loaners.filter(l => l.accountName === account);
                      const accountOverdue = accountLoaners.filter(l => l.isOverdue).length;
                      return (
                        <button
                          key={account}
                          onClick={() => { setSelectedAccount(account); setShowAccountDialog(true); }}
                          className="w-full p-3.5 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors text-left"
                        >
                          <div className="flex items-center justify-between">
                            <p className="font-medium text-slate-900 text-sm">{account}</p>
                            <div className="flex items-center gap-3">
                              <span className="text-xs text-slate-500">{accountLoaners.length} loaner{accountLoaners.length !== 1 ? "s" : ""}</span>
                              {accountOverdue > 0 && (
                                <span className="text-xs text-red-600 font-medium">{accountOverdue} overdue</span>
                              )}
                              <ChevronRight className="w-4 h-4 text-slate-400" />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </Card>

              {/* Managed Accounts Chips */}
              <Card className="p-5 bg-white border-slate-200">
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-slate-700">My Accounts</p>
                  <div className="relative" ref={addAccountRef}>
                    <button
                      onClick={() => { setShowAddAccount(v => !v); setAddAccountSearch(""); }}
                      className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-400 rounded-full px-3 py-2 transition-colors"
                    >
                      <Plus className="w-3 h-3" /> Add Account
                    </button>
                    {showAddAccount && (
                      <div className="absolute right-0 top-9 z-50 w-72 bg-white border border-slate-200 rounded-xl shadow-lg p-2">
                        <Input
                          autoFocus
                          placeholder="Search accounts..."
                          value={addAccountSearch}
                          onChange={e => setAddAccountSearch(e.target.value)}
                          className="mb-2"
                        />
                        {accountSearchResults.length === 0 && addAccountSearch.trim() && (
                          <p className="text-xs text-slate-400 text-center py-3">No matches found</p>
                        )}
                        {accountSearchResults.length === 0 && !addAccountSearch.trim() && (
                          <p className="text-xs text-slate-400 text-center py-3">Start typing to search</p>
                        )}
                        {accountSearchResults.map(name => (
                          <button
                            key={name}
                            onClick={() => handleAddAccount(name)}
                            className="w-full text-left text-sm px-3 py-2.5 rounded-lg hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition-colors"
                          >
                            {name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                {allUserAccounts.length === 0 ? (
                  <p className="text-xs text-slate-400">No accounts added yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-2">
                    {assignedAccountNames.map(acc => (
                      <span key={acc} className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 text-xs font-medium px-3 py-1 rounded-full">
                        {acc}
                      </span>
                    ))}
                    {managedAccounts.map(acc => (
                      <span key={acc} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium px-3 py-1 rounded-full">
                        {acc}
                        <button onClick={() => handleRemoveAccount(acc)} className="ml-1 text-blue-400 hover:text-red-500 transition-colors">
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          )}

          {/* CALENDAR TAB */}
          {activeTab === "calendar" && (
            <Card className="p-5 bg-white border-slate-200">
              <LoanerCalendarTab loaners={loaners} />
            </Card>
          )}

          {/* NOTIFICATIONS TAB */}
          {activeTab === "notifications" && (
            <NotificationPrefsTab user={user} />
          )}

          {/* EXPORT TAB */}
          {activeTab === "export" && (
            <ExportDataTab
              loaners={loaners}
              missingParts={myMissingParts}
              userName={user?.full_name}
            />
          )}
        </div>

        {/* Account Detail Dialog */}
        <Dialog open={showAccountDialog} onOpenChange={setShowAccountDialog}>
          <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{selectedAccount}</DialogTitle>
              <DialogDescription>
                {selectedAccountLoaners.length} loaner{selectedAccountLoaners.length !== 1 ? "s" : ""}
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