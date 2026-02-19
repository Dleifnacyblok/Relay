import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Package, User, Send, ArrowRightLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import LoanerTable from "@/components/loaners/LoanerTable";
import SendBackDialog from "@/components/sendback/SendBackDialog";
import TransferDialog from "@/components/sendback/TransferDialog";
import { computeLoanerData, sortLoaners, formatCurrency } from "@/components/loaners/loanerUtils";

export default function MyLoaners() {
  const [selectedIds, setSelectedIds] = useState([]);
  const [showSendBack, setShowSendBack] = useState(false);

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

  const isLoading = userLoading || loanersLoading;
  const userName = user?.full_name || "";

  const computedLoaners = loaners.map(computeLoanerData);
  
  const myLoaners = sortLoaners(
    computedLoaners.filter(l => 
      l.repName?.toLowerCase() === userName.toLowerCase() &&
      l.returnStatus !== "sent_back" && l.returnStatus !== "received"
    )
  );

  const selectedLoaners = myLoaners.filter(l => selectedIds.includes(l.id));

  const handleSelectAll = () => {
    if (selectedIds.length === myLoaners.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(myLoaners.map(l => l.id));
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-indigo-100">
              <User className="w-5 h-5 text-indigo-600" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              My Loaners
            </h1>
          </div>
          <p className="text-slate-500 ml-12">
            {userName ? `Showing loaners where you are primary or associate rep` : "Loading..."}
          </p>
        </div>

        {/* Quick Stats */}
        {!isLoading && myLoaners.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-6">
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
        {!isLoading && myLoaners.length > 0 && (
          <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={selectedIds.length === myLoaners.length}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-slate-600">
                {selectedIds.length > 0 
                  ? `${selectedIds.length} selected`
                  : "Select all"
                }
              </span>
            </div>
            <Button
              disabled={selectedIds.length === 0}
              onClick={() => setShowSendBack(true)}
              className="gap-2"
            >
              <Send className="w-4 h-4" />
              Send Back
            </Button>
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
          ) : myLoaners.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                <Package className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-slate-600 font-medium">No loaners assigned to you</p>
              <p className="text-sm text-slate-500 mt-1">
                {userName ? "You're not listed as primary or associate rep on any loaners" : "Please ensure your name matches the rep names in the system"}
              </p>
            </div>
          ) : (
            <LoanerTable 
              loaners={myLoaners}
              selectable
              selectedIds={selectedIds}
              onSelectOne={handleSelectOne}
            />
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
    </div>
  );
}