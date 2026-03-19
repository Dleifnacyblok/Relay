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

export default function ExportMissingPartsPDF({ open, onClose, parts, userName }) {
  const [filter, setFilter] = useState("all");
  const [isGenerating, setIsGenerating] = useState(false);

  const choices = [
    { value: "all", label: "All Parts" },
    { value: "missing", label: "Missing Only" },
    { value: "found", label: "Found Only" },
  ];

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      try {
        let filtered = [...parts];
        if (filter === "missing") filtered = filtered.filter(p => p.status === "missing");
        else if (filter === "found") filtered = filtered.filter(p => p.status === "found");

        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 14;
        const now = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
        const totalFines = filtered.reduce((sum, p) => sum + (p.fineAmount || 0), 0);

        // Title
        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text("My Missing Parts Report", margin, 20);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(`Rep: ${userName}`, margin, 28);
        doc.text(`Generated: ${now}  |  Total: ${filtered.length} part${filtered.length !== 1 ? "s" : ""}`, margin, 34);
        if (totalFines > 0) {
          doc.setFont("helvetica", "bold");
          doc.setTextColor(220, 38, 38);
          doc.text(`Total Fines: $${totalFines.toLocaleString()}`, margin, 40);
        }

        let y = totalFines > 0 ? 50 : 44;

        for (const p of filtered) {
          if (y > 270) { doc.addPage(); y = 20; }

          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(15, 23, 42);
          doc.text((p.partName || "Unknown Part").substring(0, 55), margin + 3, y);

          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 116, 139);
          if (p.partNumber) doc.text(`Part #: ${p.partNumber}`, margin + 3, y + 4.5);
          const line2Parts = [];
          if (p.loanerSetName) line2Parts.push(`Loaner: ${p.loanerSetName}`);
          if (p.etchId) line2Parts.push(`Etch: ${p.etchId}`);
          if (line2Parts.length) doc.text(line2Parts.join("  |  "), margin + 3, y + 9);
          if (p.missingDate) doc.text(`Date: ${p.missingDate}  |  Qty: ${p.missingQuantity || 1}`, margin + 3, y + 13.5);

          doc.setFont("helvetica", "bold");
          if (p.fineAmount > 0) {
            doc.setTextColor(220, 38, 38);
            doc.text(`$${(p.fineAmount || 0).toLocaleString()}`, pageWidth - margin, y, { align: "right" });
          }
          const statusColor = p.status === "missing" ? [220, 38, 38] : p.status === "found" ? [16, 185, 129] : [59, 130, 246];
          doc.setTextColor(...statusColor);
          doc.text((p.status || "missing").toUpperCase(), pageWidth - margin, y + 4.5, { align: "right" });

          doc.setDrawColor(226, 232, 240);
          doc.setLineWidth(0.2);
          doc.line(margin + 3, y + 17, pageWidth - margin, y + 17);
          y += 22;
        }

        const totalPages = doc.internal.getNumberOfPages();
        for (let i = 1; i <= totalPages; i++) {
          doc.setPage(i);
          doc.setFontSize(8);
          doc.setTextColor(148, 163, 184);
          doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, 290, { align: "center" });
          doc.text("Relay Loaner Manager", margin, 290);
        }

        doc.save(`missing-parts-${new Date().toISOString().slice(0, 10)}.pdf`);
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
          <DialogTitle>Export Missing Parts PDF</DialogTitle>
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