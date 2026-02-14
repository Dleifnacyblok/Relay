import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Search as SearchIcon, Filter, X, SlidersHorizontal } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import { computeLoanerFields, sortLoanersByRisk } from "@/components/loaners/loanerUtils";

export default function Search() {
  const [searchQuery, setSearchQuery] = useState("");
  const [riskFilter, setRiskFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [primaryRepFilter, setPrimaryRepFilter] = useState("all");
  const [associateRepFilter, setAssociateRepFilter] = useState("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const { data: appSetting } = useQuery({
    queryKey: ["appSetting"],
    queryFn: async () => {
      const result = await base44.entities.AppSetting.filter({ key: 'import_metadata' });
      return result?.[0] || null;
    }
  });

  const { data: loaners = [], isLoading } = useQuery({
    queryKey: ["loaners", appSetting?.last_import_batch_id],
    queryFn: async () => {
      if (!appSetting?.last_import_batch_id) return [];
      const result = await base44.entities.Loaners.filter({ 
        import_batch_id: appSetting.last_import_batch_id 
      });
      return result;
    },
    enabled: !!appSetting?.last_import_batch_id
  });

  const computedLoaners = useMemo(() => 
    loaners.map(computeLoanerFields), [loaners]
  );

  // Get unique values for filter dropdowns
  const uniqueStatuses = useMemo(() => 
    [...new Set(computedLoaners.map(l => l.status).filter(Boolean))].sort(),
    [computedLoaners]
  );
  
  const uniquePrimaryReps = useMemo(() => 
    [...new Set(computedLoaners.map(l => l.primary_rep).filter(Boolean))].sort(),
    [computedLoaners]
  );
  
  const uniqueAssociateReps = useMemo(() => 
    [...new Set(computedLoaners.map(l => l.associate_rep).filter(Boolean))].sort(),
    [computedLoaners]
  );

  // Apply filters
  const filteredLoaners = useMemo(() => {
    let results = computedLoaners;

    // Text search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      results = results.filter(l =>
        l.set_name?.toLowerCase().includes(query) ||
        l.set_id?.toLowerCase().includes(query) ||
        l.primary_rep?.toLowerCase().includes(query) ||
        l.associate_rep?.toLowerCase().includes(query) ||
        l.account_name?.toLowerCase().includes(query)
      );
    }

    // Risk filter
    if (riskFilter !== "all") {
      results = results.filter(l => l.risk_status === riskFilter);
    }

    // Status filter
    if (statusFilter !== "all") {
      results = results.filter(l => l.status === statusFilter);
    }

    // Primary rep filter
    if (primaryRepFilter !== "all") {
      results = results.filter(l => l.primary_rep === primaryRepFilter);
    }

    // Associate rep filter
    if (associateRepFilter !== "all") {
      results = results.filter(l => l.associate_rep === associateRepFilter);
    }

    // Sort: expected_return_date earliest first, then risk_status
    return results.sort((a, b) => {
      const dateA = a.expected_return_date ? new Date(a.expected_return_date) : new Date('9999-12-31');
      const dateB = b.expected_return_date ? new Date(b.expected_return_date) : new Date('9999-12-31');
      const dateDiff = dateA - dateB;
      if (dateDiff !== 0) return dateDiff;
      
      const riskOrder = { "Overdue": 0, "Due Soon": 1, "Safe": 2 };
      return riskOrder[a.risk_status] - riskOrder[b.risk_status];
    });
  }, [computedLoaners, searchQuery, riskFilter, statusFilter, primaryRepFilter, associateRepFilter]);

  const activeFilterCount = [riskFilter, statusFilter, primaryRepFilter, associateRepFilter]
    .filter(f => f !== "all").length;

  const clearFilters = () => {
    setRiskFilter("all");
    setStatusFilter("all");
    setPrimaryRepFilter("all");
    setAssociateRepFilter("all");
  };

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
        <label className="text-sm font-medium text-slate-700 mb-1.5 block">Status</label>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger>
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {uniqueStatuses.map(status => (
              <SelectItem key={status} value={status}>{status}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 block">Primary Rep</label>
        <Select value={primaryRepFilter} onValueChange={setPrimaryRepFilter}>
          <SelectTrigger>
            <SelectValue placeholder="All reps" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {uniquePrimaryReps.map(rep => (
              <SelectItem key={rep} value={rep}>{rep}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <label className="text-sm font-medium text-slate-700 mb-1.5 block">Associate Rep</label>
        <Select value={associateRepFilter} onValueChange={setAssociateRepFilter}>
          <SelectTrigger>
            <SelectValue placeholder="All associates" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            {uniqueAssociateReps.map(rep => (
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
                <LoanerTable loaners={filteredLoaners} />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}