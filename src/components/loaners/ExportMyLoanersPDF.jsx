import { useState } from "react";
import { jsPDF } from "jspdf";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

export default function ExportMyLoanersPDF({ open, onClose, loaners, userName }) {
  const [filter, setFilter] = useState("all");
  const [isGenerating, setIsGenerating] = useState(false);

  const choices = [
    { value: "all", label: "All Loaners" },
    { value: "overdue", label: "Overdue Only" },
    { value: "due_soon", label: "Due Soon Only" },
  ];

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      try {
        let filtered = [...loaners];
        if (filter === "overdue") filtered = filtered.filter(l => l.isOverdue);
        else if (filter === "due_soon") filtered = filtered.filter(l => !l.isOverdue && l.daysUntilDue >= 0 && l.daysUntilDue <= 7);

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 14;
        const now = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

        // Title
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text("My Loaners Report", margin, 20);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(`Rep: ${userName}`, margin, 28);
        doc.text(`Generated: ${now}  |  Total: ${filtered.length} loaner${filtered.length !== 1 ? "s" : ""}`, margin, 34);

        let y = 44;

        for (const l of filtered) {
          if (y > 270) { doc.addPage(); y = 20; }

          const isOverdue = l.isOverdue;

          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(15, 23, 42);
          doc.text((l.setName || "Unknown Set").substring(0, 50), margin + 3, y);

          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 116, 139);
          doc.text(`#${l.etchId || "N/A"}  |  ${l.accountName || ""}`, margin + 3, y + 4.5);
          if (l.expectedReturnDate) doc.text(`Due: ${l.expectedReturnDate}`, margin + 3, y + 9);

          doc.setFont("helvetica", "bold");
          if (isOverdue) {
            doc.setTextColor(220, 38, 38);
            doc.text(`Overdue ${l.daysOverdue || 0}d`, pageWidth - margin, y, { align: "right" });
            if (l.fineAmount > 0) {
              doc.setFont("helvetica", "normal");
              doc.setTextColor(180, 83, 9);
              doc.text(`$${(l.fineAmount || 0).toLocaleString()}`, pageWidth - margin, y + 4.5, { align: "right" });
            }
          } else {
            doc.setTextColor(16, 185, 129);
            doc.text("Active", pageWidth - margin, y, { align: "right" });
          }

          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.2);
          doc.line(margin + 3, y + 12, pageWidth - margin, y + 12);
          y += 17;
        }

        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, 290, { align: "center" });
          doc.text("Relay Loaner Manager", margin, 290);
        }

        doc.save(`my-loaners-${new Date().toISOString().slice(0, 10)}.pdf`);
        onClose();
      } finally {
        setIsGenerating(false);
      }
    }, 50);
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>Export My Loaners PDF</DialogTitle>
        </DialogHeader>

        <div className="py-2">
          <p className="text-sm font-medium text-slate-700 mb-2">Include</p>
          <div className="flex flex-wrap gap-2">
            {choices.map(c => (
              <button
                key={c.value}
                onClick={() => setFilter(c.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  filter === c.value
                    ? "bg-indigo-600 text-white border-indigo-600"
                    : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleGenerate} disabled={isGenerating} className="gap-2">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Generate PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}