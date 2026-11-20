import { useState } from "react";
import { BarChart3, History } from "lucide-react";
import IEPAnalyticsPanel from "@/components/iep/IEPAnalyticsPanel";
import IEPUsageMix from "@/components/iep/IEPUsageMix";
import IEPHistoryPanel from "@/components/iep/IEPHistoryPanel";

export default function IEPAnalyticsSection({ systems }) {
  const [tab, setTab] = useState("analytics");

  const tabs = [
    { key: "analytics", label: "Analytics", icon: BarChart3 },
    { key: "history", label: "History", icon: History },
  ];

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden mb-8">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-100 flex-wrap">
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-purple-50">
            <BarChart3 className="w-4 h-4 text-purple-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-800">IEP Analytics</h2>
            <p className="text-[11px] text-slate-400">System breakdown, improvement gaps and history</p>
          </div>
        </div>
        <div className="flex rounded-lg border border-slate-200 overflow-hidden text-xs font-medium">
          {tabs.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`flex items-center gap-1.5 px-3 py-1.5 transition-colors ${
                tab === key ? "bg-slate-800 text-white" : "bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-4">
        {tab === "analytics" ? (
          <div className="space-y-6">
            <IEPAnalyticsPanel systems={systems} />
            <IEPUsageMix systems={systems} />
          </div>
        ) : (
          <IEPHistoryPanel />
        )}
      </div>
    </div>
  );
}