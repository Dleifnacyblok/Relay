import { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQueryClient } from "@tanstack/react-query";
import { BookmarkPlus, Loader2, CheckCircle } from "lucide-react";

export default function SaveReportDialog({ systems, avgEffPct, onClose }) {
  const queryClient = useQueryClient();
  const now = new Date();
  const defaultMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const defaultTitle = now.toLocaleString("en-US", { month: "long", year: "numeric" });

  const [title, setTitle] = useState(defaultTitle);
  const [reportMonth, setReportMonth] = useState(defaultMonth);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    if (!title.trim()) return;
    setSaving(true);
    await base44.entities.IEPMonthlyReport.create({
      title: title.trim(),
      reportMonth,
      overallScore: avgEffPct,
      systems: systems,
      notes: notes.trim() || undefined,
    });
    queryClient.invalidateQueries({ queryKey: ["iepMonthlyReports"] });
    setSaving(false);
    setSaved(true);
    setTimeout(onClose, 1200);
  };

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6" onClick={e => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-slate-800 mb-1">Save Monthly Scorecard</h2>
        <p className="text-xs text-slate-400 mb-5">Saves a snapshot of current system data as a monthly report.</p>

        {saved ? (
          <div className="flex flex-col items-center justify-center py-6 gap-2 text-green-600">
            <CheckCircle className="w-10 h-10" />
            <p className="font-semibold">Report saved!</p>
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Report Title</label>
                <input
                  value={title}
                  onChange={e => setTitle(e.target.value)}
                  placeholder="e.g. March 2025"
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Report Month</label>
                <input
                  type="month"
                  value={reportMonth}
                  onChange={e => setReportMonth(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                  rows={2}
                  placeholder="Any notes about this period..."
                  className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-purple-300 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button onClick={onClose}
                className="flex-1 px-4 py-2 border border-slate-200 rounded-lg text-sm text-slate-600 hover:bg-slate-50 transition-colors">
                Cancel
              </button>
              <button onClick={handleSave} disabled={saving || !title.trim()}
                className="flex-1 px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:opacity-40 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><BookmarkPlus className="w-4 h-4" /> Save Report</>}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}