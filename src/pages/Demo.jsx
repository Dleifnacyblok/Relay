import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { computeLoanerData, sortLoaners } from "@/components/loaners/loanerUtils";
import { LayoutDashboard, Package, AlertCircle, BarChart2, RefreshCw } from "lucide-react";
import DemoOverview from "@/components/demo/DemoOverview";
import DemoLoaners from "@/components/demo/DemoLoaners";
import DemoMissingParts from "@/components/demo/DemoMissingParts";
import DemoAnalytics from "@/components/demo/DemoAnalytics";

const LOGO = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/698fe9d012ce3a450807fc7e/9d5cf87f9_IMG_3258.jpg";

const TABS = [
  { key: "overview", label: "Overview", icon: LayoutDashboard },
  { key: "loaners", label: "Loaners", icon: Package },
  { key: "parts", label: "Missing Parts", icon: AlertCircle },
  { key: "analytics", label: "Analytics", icon: BarChart2 },
];

export default function Demo() {
  const [tab, setTab] = useState("overview");

  const { data: snapshot, isLoading, error } = useQuery({
    queryKey: ["demoSnapshot"],
    queryFn: async () => {
      try {
        const res = await base44.functions.invoke("getDemoSnapshot", {});
        if (res?.data?.snapshot) return res.data.snapshot;
      } catch (e) {
        // fall through to direct read
      }
      const records = await base44.entities.DemoSnapshot.list("-created_date", 1);
      return records[0] || null;
    },
    staleTime: 5 * 60 * 1000,
  });

  const loaners = useMemo(
    () => sortLoaners((snapshot?.loaners || []).map(computeLoanerData)),
    [snapshot]
  );
  const missingParts = snapshot?.missingParts || [];

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="bg-black text-white text-center text-[11px] py-1.5 px-3 tracking-wide">
        DEMO PREVIEW · READ-ONLY SNAPSHOT
        {snapshot?.capturedAt ? ` · captured ${new Date(snapshot.capturedAt).toLocaleDateString()}` : ""}
      </div>

      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-white border border-slate-200 flex items-center justify-center overflow-hidden shadow-sm">
            <img src={LOGO} alt="Relay" className="object-contain w-full h-full" />
          </div>
          <div>
            <h1 className="text-lg font-semibold text-slate-900 leading-tight" style={{ letterSpacing: "-0.03em" }}>Relay</h1>
            <p className="text-[10px] text-slate-400 uppercase tracking-[0.15em]">Loaner Operations · Demo</p>
          </div>
        </div>
        <div className="max-w-6xl mx-auto px-2">
          <nav className="flex gap-1 overflow-x-auto">
            {TABS.map((t) => {
              const Icon = t.icon;
              const active = tab === t.key;
              return (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 whitespace-nowrap transition-colors ${
                    active ? "border-black text-slate-900" : "border-transparent text-slate-500 hover:text-slate-800"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {t.label}
                </button>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-24 text-slate-500">
            <RefreshCw className="w-6 h-6 animate-spin mb-3" />
            <p className="text-sm">Loading demo…</p>
          </div>
        ) : error || !snapshot ? (
          <div className="text-center py-24">
            <p className="text-slate-600 font-medium">Demo is being prepared</p>
            <p className="text-sm text-slate-400 mt-1">No snapshot is available yet.</p>
          </div>
        ) : (
          <>
            {tab === "overview" && <DemoOverview loaners={loaners} missingParts={missingParts} />}
            {tab === "loaners" && <DemoLoaners loaners={loaners} />}
            {tab === "parts" && <DemoMissingParts parts={missingParts} />}
            {tab === "analytics" && <DemoAnalytics loaners={loaners} missingParts={missingParts} />}
          </>
        )}
      </main>
    </div>
  );
}