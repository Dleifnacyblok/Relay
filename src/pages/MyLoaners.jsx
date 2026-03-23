import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { base44 } from "@/api/base44Client";
import { Package, User, Send, ArrowRightLeft, Download, CalendarPlus, Search, X } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import LoanerTable from "@/components/loaners/LoanerTable";
import SendBackDialog from "@/components/sendback/SendBackDialog";
import TransferDialog from "@/components/sendback/TransferDialog";
import { computeLoanerData, sortLoaners, formatCurrency } from "@/components/loaners/loanerUtils";
import ExportMyLoanersPDF from "@/components/loaners/ExportMyLoanersPDF";

export default function MyLoaners() {
  const [selectedIds, setSelectedIds] = useState([]);
  const [showSendBack, setShowSendBack] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [syncingCalendar, setSyncingCalendar] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const handleSyncCalendar = async () => {
    setSyncingCalendar(true);
    try {
      const res = await base44.functions.invoke('syncLoanersToCalendar', {});
      const { created, failed } = res.data;
      toast({
        title: "Calendar Synced",
        description: `${created} event${created !== 1 ? 's' : ''} added to Google Calendar.${failed > 0 ? ` ${failed} failed.` : ''}`,
      });
    } catch (e) {
      toast({ title: "Sync Failed", description: e.message, variant: "destructive" });
    } finally {
      setSyncingCalendar(false);
    }
  };

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
  });

  const { data: appSetting } = useQuery({
    queryKey: ["appSetting"],
    queryFn: async () => {
      const result = await base44.entities.AppSetting.filter({ key: 'import_metadata' });
      return result?.[0] || null;
    }
  });

  const { data: loaners = [], isLoading: loanersLoading } = useQuery({
    queryKey: ["loaners"],
    queryFn: async () => {
      const result = await base44.entities.Loaners.list();
      return result;
    }
  });

  const { data: missingParts = [] } = useQuery({
    queryKey: ["missingParts"],
    queryFn: () => base44.entities.MissingPart.list(),
  });

  const { data: allAssignments = [] } = useQuery({
    queryKey: ["repAccountAssignments"],
    queryFn: () => base44.entities.RepAccountAssignment.list(),
  });

  const isLoading = userLoading || loanersLoading;
  const userName = user?.full_name || "";

  const computedLoaners = loaners.map(computeLoanerData);
  
  const managedAccounts = user?.managedAccounts || [];

  // Accounts where this user is assigned as a rep in RepAccountAssignment
  const assignedAccountNames = useMemo(() => {
    if (!userName) return [];
    return allAssignments
      .filter(a => {
        const reps = Array.isArray(a.assignedReps) ? a.assignedReps : (a.assignedRep ? [a.assignedRep] : []);
        return reps.includes(userName);
      })
      .map(a => a.accountName)
      .filter(n => n && !n.startsWith("__rep_placeholder__"));
  }, [allAssignments, userName]);

  const allUserAccounts = useMemo(() =>
    [...new Set([...managedAccounts, ...assignedAccountNames])],
    [managedAccounts, assignedAccountNames]
  );

  const myLoaners = useMemo(() => sortLoaners(
    computedLoaners.filter(l => 
      l.returnStatus !== "sent_back" && 
      l.returnStatus !== "received" &&
      (l.repName?.toLowerCase() === userName.toLowerCase() || 
       l.associateSalesRep?.toLowerCase() === userName.toLowerCase() ||
       l.fieldSalesRep?.toLowerCase() === userName.toLowerCase() ||
       allUserAccounts.includes(l.accountName))
    )
  ), [computedLoaners, userName, allUserAccounts]);

  const filteredLoaners = useMemo(() => {
    if (!searchQuery.trim()) return myLoaners;
    const q = searchQuery.toLowerCase();
    return myLoaners.filter(l =>
      l.setName?.toLowerCase().includes(q) ||
      l.accountName?.toLowerCase().includes(q) ||
      l.etchId?.toLowerCase().includes(q) ||
      l.setId?.toLowerCase().includes(q)
    );
  }, [myLoaners, searchQuery]);

  const statusPill = (loaner) => {
    if (loaner.risk_status === "Overdue") return <span className="text-xs font-semibold px-2 py-1 rounded-full bg-red-100 text-red-700 whitespace-nowrap">Overdue</span>;
    if (loaner.risk_status === "Due Soon") return <span className="text-xs font-semibold px-2 py-1 rounded-full bg-yellow-100 text-yellow-700 whitespace-nowrap">Due Soon</span>;
    return <span className="text-xs font-semibold px-2 py-1 rounded-full bg-green-100 text-green-700 whitespace-nowrap">OK</span>;
  };

  const selectedLoaners = filteredLoaners.filter(l => selectedIds.includes(l.id));

  const handleSelectAll = () => {
    if (selectedIds.length === filteredLoaners.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredLoaners.map(l => l.id));
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const overdueCount = myLoaners.filter(l => l.risk_status === "Overdue").length;
  const dueSoonCount = myLoaners.filter(l => l.risk_status === "Due Soon").length;
  const totalLoanerFines = myLoaners.reduce((sum, l) => {
    if (l.feesWaived) return sum;
    return sum + (l.fineAmount || 0);
  }, 0);
  
  const myParts = missingParts.filter(p => 
    p.repName?.toLowerCase() === userName.toLowerCase() && 
    p.status === "missing" &&
    p.returnStatus !== "sent_back" && p.returnStatus !== "received"
  );
  const totalPartFines = myParts.reduce((sum, p) => sum + (p.fineAmount || 0), 0);
  const totalFines = totalLoanerFines + totalPartFines;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Sticky search bar */}
      <div data-tour="loaners-search" className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-7xl mx-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Search loaners..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 h-11 text-base bg-white"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="w-full max-w-7xl mx-auto px-3 sm:px-6 lg:px-8 py-4 sm:py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-100">
                <User className="w-5 h-5 text-indigo-600" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                My Loaners
              </h1>
            </div>
            {!isLoading && myLoaners.length > 0 && (
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={handleSyncCalendar} disabled={syncingCalendar} className="gap-2">
                  <CalendarPlus className="w-4 h-4" />
                  {syncingCalendar ? "Syncing..." : "Sync to Calendar"}
                </Button>
                <Button variant="outline" size="sm" onClick={() => setShowExport(true)} className="gap-2">
                  <Download className="w-4 h-4" />
                  Export PDF
                </Button>
              </div>
            )}
          </div>
          <p className="text-slate-500 ml-12">
            {userName ? `Loaners assigned to you — select any to send back or transfer` : "Loading..."}
          </p>
        </div>

        {/* Quick Stats */}
        {!isLoading && myLoaners.length > 0 && (
          <div data-tour="loaners-stats" className="flex flex-wrap gap-3 mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-sm">
              <span className="text-slate-500">Total:</span>
              <span className="font-semibold text-slate-900">{myLoaners.length}</span>
            </div>
            {overdueCount > 0 && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-full text-sm">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="font-semibold text-red-700">{overdueCount} Overdue</span>
              </div>
            )}
            {dueSoonCount > 0 && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-50 border border-amber-200 rounded-full text-sm">
                <span className="w-2 h-2 rounded-full bg-amber-500" />
                <span className="font-semibold text-amber-700">{dueSoonCount} Due Soon</span>
              </div>
            )}
            {totalLoanerFines > 0 && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-full text-sm">
                <span className="text-slate-500">Loaner Fines:</span>
                <span className="font-bold text-red-700">{formatCurrency(totalLoanerFines)}</span>
              </div>
            )}
          </div>
        )}

        {/* Actions Bar */}
        {!isLoading && filteredLoaners.length > 0 && (
          <div data-tour="loaners-actions" className="bg-white rounded-lg border border-slate-200 p-4 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={selectedIds.length > 0 && selectedIds.length === filteredLoaners.length}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-slate-600">
                {selectedIds.length > 0 
                  ? `${selectedIds.length} selected`
                  : "Select all"
                }
              </span>
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                disabled={selectedIds.length === 0}
                onClick={() => setShowTransfer(true)}
                className="gap-2"
              >
                <ArrowRightLeft className="w-4 h-4" />
                Transfer
              </Button>
              <Button
                disabled={selectedIds.length === 0}
                onClick={() => setShowSendBack(true)}
                className="gap-2"
              >
                <Send className="w-4 h-4" />
                Send Back
              </Button>
            </div>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-14 rounded-lg" />
              ))}
            </div>
          ) : filteredLoaners.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                <Package className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-slate-600 font-medium">{myLoaners.length === 0 ? "No loaners assigned to you" : "No results for your search"}</p>
              <p className="text-sm text-slate-500 mt-1">
                {myLoaners.length === 0 && (userName ? "You're not listed as primary or associate rep on any loaners" : "Please ensure your name matches the rep names in the system")}
              </p>
            </div>
          ) : (
            <>
              {/* Mobile rows */}
              <div className="lg:hidden divide-y divide-slate-100">
                {filteredLoaners.map(loaner => (
                  <div
                    key={loaner.id}
                    className="flex items-center justify-between px-4 py-4 min-h-14 hover:bg-slate-50 active:bg-slate-100 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1 pr-3">
                      <Checkbox
                        checked={selectedIds.includes(loaner.id)}
                        onCheckedChange={() => handleSelectOne(loaner.id)}
                      />
                      <Link
                        to={createPageUrl("LoanerDetail") + `?id=${loaner.id}`}
                        className="min-w-0 flex-1"
                      >
                        <p className="font-semibold text-slate-900 truncate">{loaner.setName}</p>
                        <p className="text-sm text-slate-500 truncate">{loaner.accountName}</p>
                      </Link>
                    </div>
                    <Link to={createPageUrl("LoanerDetail") + `?id=${loaner.id}`}>
                      {statusPill(loaner)}
                    </Link>
                  </div>
                ))}
              </div>
              {/* Desktop table */}
              <div className="hidden lg:block">
                <LoanerTable 
                  loaners={filteredLoaners}
                  selectable
                  selectedIds={selectedIds}
                  onSelectOne={handleSelectOne}
                />
              </div>
            </>
          )}
        </div>
      </div>


      <SendBackDialog
        open={showSendBack}
        onOpenChange={setShowSendBack}
        selectedLoaners={selectedLoaners}
        selectedParts={[]}
        userName={userName}
        onSuccess={() => setSelectedIds([])}
      />

      <ExportMyLoanersPDF
        open={showExport}
        onClose={() => setShowExport(false)}
        loaners={myLoaners}
        userName={userName}
      />

      <TransferDialog
        open={showTransfer}
        onOpenChange={setShowTransfer}
        selectedLoaners={selectedLoaners}
        userName={userName}
        onSuccess={() => setSelectedIds([])}
      />
    </div>
  );
}