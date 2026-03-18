import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { computeLoanerData } from "@/components/loaners/loanerUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { MapPin, Search, Package, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
import { useState, useMemo } from "react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const MANUFACTURER_COLORS = {
  Globus: "bg-blue-100 text-blue-700 border-blue-200",
  Nuvasive: "bg-purple-100 text-purple-700 border-purple-200",
};

const StatusBadge = ({ status }) => {
  if (status === "overdue") return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-700 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">
      <AlertTriangle className="w-3 h-3" /> Overdue
    </span>
  );
  if (status === "due_soon") return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
      <Clock className="w-3 h-3" /> Due Soon
    </span>
  );
  if (status === "out") return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-full">
      <Package className="w-3 h-3" /> Out on Loan
    </span>
  );
  if (status === "returned") return (
    <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-2 py-0.5 rounded-full">
      <CheckCircle2 className="w-3 h-3" /> Returned
    </span>
  );
  return (
    <span className="text-xs font-medium text-slate-400 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-full">
      No Activity
    </span>
  );
};

export default function TerritoryInventory() {
  const [search, setSearch] = useState("");
  const [filterMfr, setFilterMfr] = useState("All");

  const { data: consignedSets = [], isLoading: loadingSets } = useQuery({
    queryKey: ["consignedSets"],
    queryFn: () => base44.entities.ConsignedSet.list(),
  });

  const { data: rawLoaners = [], isLoading: loadingLoaners } = useQuery({
    queryKey: ["loaners"],
    queryFn: () => base44.entities.Loaners.list(),
  });

  const isLoading = loadingSets || loadingLoaners;

  // Build a lookup: etchId (tag#) → loaner record
  const loanerByTag = useMemo(() => {
    const map = {};
    rawLoaners.forEach(l => {
      if (l.etchId) map[l.etchId.trim()] = computeLoanerData(l);
    });
    return map;
  }, [rawLoaners]);

  // Enrich each consigned set with matched loaners
  const enrichedSets = useMemo(() => {
    return consignedSets.map(cs => {
      const tags = cs.tagNumbers || [];
      const matchedLoaners = tags
        .map((tag, idx) => {
          const loaner = loanerByTag[tag.trim()];
          return { tag, homeAccount: (cs.homeAccounts || [])[idx] || "", loaner };
        });

      const activeCount = matchedLoaners.filter(m => m.loaner && m.loaner.returnStatus !== "sent_back" && m.loaner.returnStatus !== "received").length;
      const overdueCount = matchedLoaners.filter(m => m.loaner && m.loaner.risk_status === "Overdue").length;
      const dueSoonCount = matchedLoaners.filter(m => m.loaner && m.loaner.risk_status === "Due Soon").length;

      return { ...cs, matchedLoaners, activeCount, overdueCount, dueSoonCount };
    });
  }, [consignedSets, loanerByTag]);

  const filtered = useMemo(() => {
    return enrichedSets.filter(cs => {
      const matchesMfr = filterMfr === "All" || cs.manufacturer === filterMfr;
      const matchesSearch = !search ||
        cs.setName.toLowerCase().includes(search.toLowerCase()) ||
        (cs.setId || "").includes(search) ||
        (cs.tagNumbers || []).some(t => t.includes(search));
      return matchesMfr && matchesSearch;
    });
  }, [enrichedSets, search, filterMfr]);

  // Summary KPIs
  const totalTags = enrichedSets.reduce((s, cs) => s + (cs.tagNumbers || []).length, 0);
  const totalActive = enrichedSets.reduce((s, cs) => s + cs.activeCount, 0);
  const totalOverdue = enrichedSets.reduce((s, cs) => s + cs.overdueCount, 0);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="max-w-5xl mx-auto space-y-4">
          <Skeleton className="h-10 w-64" />
          <div className="grid grid-cols-3 gap-4">{[...Array(3)].map((_, i) => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
          {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-24">
      <div className="max-w-5xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-1">
          <div className="p-2 rounded-lg bg-blue-100">
            <MapPin className="w-5 h-5 text-blue-600" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">Territory Inventory</h1>
        </div>
        <p className="text-slate-500 ml-12 mb-6">Consigned sets tracked in territory — cross-referenced with active loaners</p>

        {/* KPIs */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Card className="p-4 bg-white border-slate-200">
            <p className="text-xs text-slate-500 mb-1">Tracked Tags</p>
            <p className="text-2xl font-bold text-slate-900">{totalTags}</p>
            <p className="text-xs text-slate-400">{enrichedSets.length} sets</p>
          </Card>
          <Card className="p-4 bg-blue-50 border-blue-200">
            <p className="text-xs text-slate-500 mb-1">Currently Out</p>
            <p className="text-2xl font-bold text-blue-700">{totalActive}</p>
            <p className="text-xs text-slate-400">active loaners</p>
          </Card>
          <Card className="p-4 bg-red-50 border-red-200">
            <p className="text-xs text-slate-500 mb-1">Overdue Tags</p>
            <p className="text-2xl font-bold text-red-700">{totalOverdue}</p>
            <p className="text-xs text-slate-400">need attention</p>
          </Card>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <Input
              placeholder="Search by set name, set ID, or tag #…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <div className="flex gap-1">
            {["All", "Globus", "Nuvasive"].map(m => (
              <button key={m} onClick={() => setFilterMfr(m)}
                className={`px-3 py-1.5 text-sm rounded-lg font-medium transition-colors ${filterMfr === m ? "bg-slate-800 text-white" : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"}`}>
                {m}
              </button>
            ))}
          </div>
        </div>

        {/* Sets List */}
        <div className="space-y-4">
          {filtered.length === 0 && (
            <p className="text-center text-slate-400 py-16">No sets match your search.</p>
          )}
          {filtered.map(cs => (
            <Card key={cs.id} className="bg-white border-slate-200 overflow-hidden">
              <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-slate-900">{cs.setName}</h3>
                      {cs.setId && <span className="text-xs text-slate-400 font-mono">{cs.setId}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${MANUFACTURER_COLORS[cs.manufacturer] || "bg-slate-100 text-slate-600"}`}>
                        {cs.manufacturer || "Unknown"}
                      </span>
                      <span className="text-xs text-slate-400">{(cs.tagNumbers || []).length} tags tracked</span>
                      {cs.notes && <span className="text-xs text-slate-400 italic">{cs.notes}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-xs">
                  {cs.overdueCount > 0 && (
                    <span className="font-semibold text-red-600 bg-red-50 border border-red-100 px-2 py-1 rounded-lg">{cs.overdueCount} overdue</span>
                  )}
                  {cs.dueSoonCount > 0 && (
                    <span className="font-semibold text-amber-600 bg-amber-50 border border-amber-100 px-2 py-1 rounded-lg">{cs.dueSoonCount} due soon</span>
                  )}
                  {cs.activeCount > 0 && (
                    <span className="font-semibold text-blue-600 bg-blue-50 border border-blue-100 px-2 py-1 rounded-lg">{cs.activeCount} out</span>
                  )}
                </div>
              </div>

              {/* Tag rows */}
              {cs.matchedLoaners.length > 0 && (
                <div className="divide-y divide-slate-50">
                  {cs.matchedLoaners.map(({ tag, homeAccount, loaner }, idx) => {
                    const isActive = loaner && loaner.returnStatus !== "sent_back" && loaner.returnStatus !== "received";
                    const status = !loaner ? "no_activity"
                      : (loaner.returnStatus === "sent_back" || loaner.returnStatus === "received") ? "returned"
                      : loaner.risk_status === "Overdue" ? "overdue"
                      : loaner.risk_status === "Due Soon" ? "due_soon"
                      : "out";

                    return (
                      <div key={idx} className={`flex flex-wrap items-center justify-between px-4 py-2.5 gap-2 ${status === "overdue" ? "bg-red-50/50" : status === "due_soon" ? "bg-amber-50/30" : ""}`}>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm text-slate-700 font-medium">{tag}</span>
                          {homeAccount && (
                            <span className="text-xs text-slate-400 flex items-center gap-1">
                              <MapPin className="w-3 h-3" /> {homeAccount}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          {loaner && isActive && (
                            <span className="text-xs text-slate-500">
                              @ <span className="font-medium text-slate-700">{loaner.accountName}</span>
                              {loaner.repName && <span className="ml-1 text-slate-400">· {loaner.repName}</span>}
                            </span>
                          )}
                          <StatusBadge status={status} />
                          {loaner && (
                            <Link to={`${createPageUrl("LoanerDetail")}?id=${loaner.id}`}
                              className="text-xs text-blue-600 hover:underline font-medium">
                              View →
                            </Link>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}