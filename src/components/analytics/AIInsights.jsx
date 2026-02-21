import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sparkles, TrendingUp, AlertTriangle, Lightbulb, RefreshCw, ChevronDown, ChevronUp } from "lucide-react";

const Section = ({ icon: Icon, title, color, items }) => {
  const [expanded, setExpanded] = useState(true);
  return (
    <div className={`rounded-xl border ${color.border} ${color.bg} overflow-hidden`}>
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3"
      >
        <div className="flex items-center gap-2">
          <Icon className={`w-4 h-4 ${color.icon}`} />
          <span className={`text-sm font-semibold ${color.title}`}>{title}</span>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>
      {expanded && (
        <ul className="px-4 pb-4 space-y-2">
          {items.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-slate-700">
              <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${color.dot}`} />
              {item}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

export default function AIInsights({ analyticsData }) {
  const [insights, setInsights] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const generateInsights = async () => {
    setLoading(true);
    setError(null);
    setInsights(null);

    const prompt = `You are an expert operations analyst for a medical device loaner management company.
Analyze the following loaner operations data and provide actionable AI-driven insights.

DATA SUMMARY:
- Total active loaners: ${analyticsData.totalLoaners}
- Overdue loaners: ${analyticsData.overdueCount} (${analyticsData.overdueRate}% overdue rate)
- Loaners due soon (next 7 days): ${analyticsData.dueSoonCount}
- Total fine exposure: $${analyticsData.totalFines}
- Active missing parts: ${analyticsData.activeMissingParts}

TOP OVERDUE REPS (name: overdue/total loaners):
${analyticsData.overdueByRep.slice(0, 6).map(r => `  - ${r.rep}: ${r.overdue}/${r.total} overdue`).join('\n')}

LOAN DURATION DISTRIBUTION:
${analyticsData.durationData.map(d => `  - ${d.range}: ${d.count} loaners`).join('\n')}

MOST COMMON MISSING PARTS:
${analyticsData.topMissingParts.slice(0, 5).map(p => `  - ${p.name}: ${p.count} missing`).join('\n')}

TOP REPS BY FINE EXPOSURE:
${analyticsData.finesByRep.slice(0, 5).map(r => `  - ${r.rep}: $${r.fines}`).join('\n')}

Based on this data, provide exactly:
1. predictions: 3-4 specific predictions about future overdue trends (next 30-60 days) based on the current patterns
2. riskFactors: 3-4 key factors contributing to loaner delays or parts going missing
3. recommendations: 4-5 concrete, specific, actionable process improvements or preventative measures

Be specific, reference actual data points (rep names, numbers, percentages) where relevant. Keep each bullet point concise (1-2 sentences max).`;

    const result = await base44.integrations.Core.InvokeLLM({
      prompt,
      response_json_schema: {
        type: "object",
        properties: {
          predictions: { type: "array", items: { type: "string" } },
          riskFactors: { type: "array", items: { type: "string" } },
          recommendations: { type: "array", items: { type: "string" } },
        },
        required: ["predictions", "riskFactors", "recommendations"],
      },
    });

    setInsights(result);
    setLoading(false);
  };

  return (
    <Card className="p-5 bg-white border-slate-200 md:col-span-2">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-violet-100 to-indigo-100">
            <Sparkles className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-700">AI Insights</h2>
            <p className="text-xs text-slate-400">Predictions, risk factors & recommendations</p>
          </div>
        </div>
        <Button
          size="sm"
          onClick={generateInsights}
          disabled={loading}
          className="bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-xs"
        >
          {loading ? (
            <><RefreshCw className="w-3 h-3 animate-spin" /> Analyzing...</>
          ) : insights ? (
            <><RefreshCw className="w-3 h-3" /> Refresh</>
          ) : (
            <><Sparkles className="w-3 h-3" /> Generate Insights</>
          )}
        </Button>
      </div>

      {!insights && !loading && !error && (
        <div className="flex flex-col items-center justify-center py-10 text-center">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 flex items-center justify-center mb-3">
            <Sparkles className="w-6 h-6 text-violet-400" />
          </div>
          <p className="text-sm font-medium text-slate-600 mb-1">AI-Powered Analysis</p>
          <p className="text-xs text-slate-400 max-w-xs">Click "Generate Insights" to get AI predictions, risk factor analysis, and tailored improvement suggestions based on your current data.</p>
        </div>
      )}

      {loading && (
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="rounded-xl border border-slate-100 p-4 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-full" />
              <Skeleton className="h-3 w-4/5" />
              <Skeleton className="h-3 w-3/4" />
            </div>
          ))}
        </div>
      )}

      {error && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-4 text-sm text-red-700">{error}</div>
      )}

      {insights && !loading && (
        <div className="space-y-3">
          <Section
            icon={TrendingUp}
            title="Predicted Overdue Trends"
            color={{ border: "border-blue-200", bg: "bg-blue-50", icon: "text-blue-600", title: "text-blue-800", dot: "bg-blue-500" }}
            items={insights.predictions}
          />
          <Section
            icon={AlertTriangle}
            title="Key Risk Factors"
            color={{ border: "border-red-200", bg: "bg-red-50", icon: "text-red-600", title: "text-red-800", dot: "bg-red-500" }}
            items={insights.riskFactors}
          />
          <Section
            icon={Lightbulb}
            title="Recommended Process Improvements"
            color={{ border: "border-emerald-200", bg: "bg-emerald-50", icon: "text-emerald-600", title: "text-emerald-800", dot: "bg-emerald-500" }}
            items={insights.recommendations}
          />
          <p className="text-xs text-slate-400 text-right pt-1">AI analysis based on current snapshot · Refresh for updated insights</p>
        </div>
      )}
    </Card>
  );
}