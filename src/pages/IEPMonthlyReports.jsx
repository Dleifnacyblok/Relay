import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { TrendingUp, FileText, Trash2, ChevronRight, BookmarkPlus } from "lucide-react";
import IEPScorecardReport from "@/components/iep/IEPScorecardReport";

export default function IEPMonthlyReports() {
  const queryClient = useQueryClient();
  const [viewingReport, setViewingReport] = useState(null);
  const [deleting, setDeleting] = useState(null);

  const { data: reports = [], isLoading } = useQuery({
    queryKey: ["iepMonthlyReports"],
    queryFn: () => base44.entities.IEPMonthlyReport.list("-created_date"),
  });

  const handleDelete = async (report) => {
    if (!window.confirm(`Delete "${report.title}"? This cannot be undone.`)) return;
    setDeleting(report.id);
    await base44.entities.IEPMonthlyReport.delete(report.id);
    queryClient.invalidateQueries({ queryKey: ["iepMonthlyReports"] });
    setDeleting(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-100">
              <FileText className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">Monthly IEP Scorecards</h1>
              <p className="text-xs text-slate-400 mt-0.5">{reports.length} saved report{reports.length !== 1 ? "s" : ""}</p>
            </div>
          </div>
          <Link to="/IEPDashboard"
            className="text-sm text-purple-600 hover:text-purple-800 font-medium underline">
            ← Back to Dashboard
          </Link>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-8 h-8 border-4 border-slate-200 border-t-purple-500 rounded-full animate-spin" />
          </div>
        ) : reports.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-12 text-center">
            <BookmarkPlus className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <h2 className="text-lg font-semibold text-slate-600 mb-2">No reports saved yet</h2>
            <p className="text-sm text-slate-400 mb-4">Go to the IEP Dashboard and click "Save Monthly Report" to create your first snapshot.</p>
            <Link to="/IEPDashboard"
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors">
              <TrendingUp className="w-4 h-4" /> Go to Dashboard
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {[...reports].sort((a, b) => {
              const ma = a.reportMonth || "";
              const mb = b.reportMonth || "";
              return mb.localeCompare(ma);
            }).map(report => {
              const score = report.overallScore;
              const scoreColor = score == null ? "text-slate-400" : score >= 90 ? "text-green-600" : score >= 70 ? "text-yellow-600" : "text-red-600";
              const date = report.created_date ? new Date(report.created_date).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : "";

              return (
                <div key={report.id}
                  className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 flex items-center gap-4 hover:shadow-md transition-shadow">
                  <div className="p-2.5 rounded-lg bg-purple-50 shrink-0">
                    <FileText className="w-5 h-5 text-purple-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-slate-800 truncate">{report.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {(report.systems || []).length} systems · Saved {date}
                    </p>
                    {report.notes && <p className="text-xs text-slate-500 mt-0.5 italic truncate">{report.notes}</p>}
                  </div>
                  <div className={`text-2xl font-extrabold ${scoreColor} shrink-0 w-16 text-right`}>
                    {score != null ? score.toFixed(1) : "—"}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => setViewingReport(report)}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 rounded-lg text-xs font-medium transition-colors">
                      View <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDelete(report)}
                      disabled={deleting === report.id}
                      className="p-1.5 text-slate-300 hover:text-red-500 transition-colors disabled:opacity-40">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {viewingReport && (
        <IEPScorecardReport report={viewingReport} onClose={() => setViewingReport(null)} />
      )}
    </div>
  );
}