import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Search as SearchIcon, Filter, X, SlidersHorizontal, Send, ArrowRightLeft } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import LoanerTable from "@/components/loaners/LoanerTable";
import { computeLoanerData, sortLoaners } from "@/components/loaners/loanerUtils";
import SendBackDialog from "@/components/sendback/SendBackDialog";
import TransferDialog from "@/components/sendback/TransferDialog";

export default function Search() {
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [repFilter, setRepFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [selectedIds, setSelectedIds] = useState([]);
  const [showSendBack, setShowSendBack] = useState(false);
  const [showTransfer, setShowTransfer] = useState(false);

  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
  });
  const userName = user?.full_name || "";

  const { data: appSetting } = useQuery({
    queryKey: ["appSetting"],
    queryFn: async () => {
      const result = await base44.entities.AppSetting.filter({ key: 'import_metadata' });
      return result?.[0] || null;
    }
  });

  const { data: loaners = [], isLoading } = useQuery({
    queryKey: ["loaners"],
    queryFn: async () => {
      const result = await base44.entities.Loaners.list();
      return result;
    }
  });

  const computedLoaners = useMemo(() => 
    loaners.map(computeLoanerData), [loaners]
  );

  const uniqueReps = useMemo(() => 
    [...new Set(computedLoaners.map(l => l.repName).filter(Boolean))].sort(),
    [computedLoaners]
  );

  const filteredLoaners = useMemo(() => {
    let results = computedLoaners;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      results = results.filter(l =>
        l.setName?.toLowerCase().includes(query) ||
        l.setId?.toLowerCase().includes(query) ||
        l.repName?.toLowerCase().includes(query) ||
        l.accountName?.toLowerCase().includes(query) ||
        l.etchId?.toLowerCase().includes(query)
      );
    }

    if (riskFilter !== "all") {
      results = results.filter(l => l.risk_status === riskFilter);
    }

    if (repFilter !== "all") {
      results = results.filter(l => l.repName === repFilter);
    }

    return sortLoaners(results);
  }, [computedLoaners, searchQuery, riskFilter, repFilter]);

  const activeFilterCount = [riskFilter, repFilter]
    .filter(f => f !== "all").length;

  const clearFilters = () => {
    setRiskFilter("all");
    setRepFilter("all");
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]);
  };

  const handleSelectAll = () => {
    if (selectedIds.length === filteredLoaners.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredLoaners.map(l => l.id));
    }
  };

  const selectedLoaners = filteredLoaners.filter(l => selectedIds.includes(l.id));

  const FilterControls = () => (
    <div className="space-y-4">
      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 block">Risk Status</label>
        <Select value={riskFilter} onValueChange={setRiskFilter}>
          <SelectTrigger>
            <SelectValue placeholder="All risk levels" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="Overdue">Overdue</SelectItem>
            <SelectItem value="Due Soon">Due Soon</SelectItem>
            <SelectItem value="Safe">Safe</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 block">Rep</label>
        <Select value={repFilter} onValueChange={setRepFilter}>
          <SelectTrigger>
            <SelectValue placeholder="All reps" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {uniqueReps.map(rep => (
              <SelectItem key={rep} value={rep}>{rep}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {activeFilterCount > 0 && (
        <Button variant="outline" className="w-full" onClick={clearFilters}>
          <X className="w-4 h-4 mr-2" />
          Clear Filters
        </Button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen" style={{backgroundColor: '#FFFFFF'}}>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight" style={{color: '#111111'}}>
            Search Loaners
          </h1>
          <p className="mt-1" style={{color: '#666666'}}>
            Find sets by name, ID, rep, or account
          </p>
        </div>

        {/* Search Bar */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            <Input
              placeholder="Search sets, reps, accounts..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10 h-11 bg-white"
            />
          </div>
          
          {/* Mobile Filter Button */}
          <Sheet open={filtersOpen} onOpenChange={setFiltersOpen}>
            <SheetTrigger asChild>
              <Button variant="outline" className="lg:hidden h-11 px-3 relative">
                <SlidersHorizontal className="w-5 h-5" />
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-indigo-600 text-white text-xs rounded-full flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Filters</SheetTitle>
              </SheetHeader>
              <div className="mt-6">
                <FilterControls />
              </div>
            </SheetContent>
          </Sheet>
        </div>

        <div className="flex gap-6">
          {/* Desktop Filters Sidebar */}
          <div className="hidden lg:block w-64 shrink-0">
            <div className="rounded-xl p-5 sticky top-6" style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #EEEEEE',
              boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.06)'
            }}>
              <div className="flex items-center gap-2 mb-4">
                <Filter className="w-4 h-4 text-slate-500" />
                <span className="font-semibold text-slate-900">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="ml-auto text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                    {activeFilterCount} active
                  </span>
                )}
              </div>
              <FilterControls />
            </div>
          </div>

          {/* Results */}
          <div className="flex-1 min-w-0">
            {/* Actions Bar */}
            {!isLoading && filteredLoaners.length > 0 && (
              <div className="bg-white rounded-lg border border-slate-200 p-3 mb-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Checkbox
                    checked={selectedIds.length > 0 && selectedIds.length === filteredLoaners.length}
                    onCheckedChange={handleSelectAll}
                  />
                  <span className="text-sm text-slate-600">
                    {selectedIds.length > 0 ? `${selectedIds.length} selected` : "Select all"}
                  </span>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={selectedIds.length === 0}
                    onClick={() => setShowTransfer(true)}
                    className="gap-1.5"
                  >
                    <ArrowRightLeft className="w-4 h-4" />
                    Transfer
                  </Button>
                  <Button
                    size="sm"
                    disabled={selectedIds.length === 0}
                    onClick={() => setShowSendBack(true)}
                    className="gap-1.5"
                  >
                    <Send className="w-4 h-4" />
                    Send Back
                  </Button>
                </div>
              </div>
            )}

            <div className="rounded-xl overflow-hidden" style={{
              backgroundColor: '#FFFFFF',
              border: '1px solid #EEEEEE',
              boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.06)'
            }}>
              <div className="px-5 py-3 border-b border-slate-200 bg-slate-50/50 flex items-center justify-between">
                <span className="text-sm text-slate-600">
                  {isLoading ? "Loading..." : `${filteredLoaners.length} results`}
                </span>
              </div>

              {isLoading ? (
                <div className="p-6 space-y-4">
                  {[1, 2, 3, 4, 5].map(i => (
                    <Skeleton key={i} className="h-16 rounded-lg" />
                  ))}
                </div>
              ) : (
                <LoanerTable
                  loaners={filteredLoaners}
                  selectable
                  selectedIds={selectedIds}
                  onSelectOne={handleSelectOne}
                />
              )}
            </div>
          </div>
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