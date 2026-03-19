import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { createDoc, addFooters, getNow, getFilename } from "@/lib/pdfUtils";

export default function ExportPDFDialog({ open, onClose, loaners }) {
  const [filter, setFilter] = useState("all");
  const [groupBy, setGroupBy] = useState("rep");
  const [isGenerating, setIsGenerating] = useState(false);

  const options = [
    { label: "Include", key: "filter", value: filter, setter: setFilter,
      choices: [{ value: "all", label: "All Loaners" }, { value: "overdue", label: "Overdue Only" }, { value: "due_soon", label: "Due Soon Only" }] },
    { label: "Group By", key: "groupBy", value: groupBy, setter: setGroupBy,
      choices: [{ value: "rep", label: "Representative" }, { value: "account", label: "Account" }] },
  ];

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      try {
        let filtered = [...loaners];
        if (filter === "overdue") filtered = filtered.filter(l => l.isOverdue);
        else if (filter === "due_soon") filtered = filtered.filter(l => !l.isOverdue && l.daysUntilDue >= 0 && l.daysUntilDue <= 7);

        const grouped = {};
        filtered.forEach(l => {
          const key = groupBy === "rep" ? (l.repName || "Unknown") : (l.accountName || "Unknown");
          if (!grouped[key]) grouped[key] = [];
          grouped[key].push(l);
        });

        const { doc, pageWidth, margin } = createDoc();
        const now = getNow();

        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text("Loaner Situation Report", margin, 20);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(`Generated: ${now}`, margin, 28);
        doc.text(`Total: ${filtered.length} loaner${filtered.length !== 1 ? "s" : ""}  |  Grouped by: ${groupBy === "rep" ? "Representative" : "Account"}`, margin, 34);

        let y = 44;

        for (const groupKey of Object.keys(grouped).sort()) {
          const items = grouped[groupKey];
          const groupFines = items.reduce((s, l) => s + (l.fineAmount || 0), 0);

          if (y > 260) { doc.addPage(); y = 20; }

          doc.setFillColor(238, 242, 255);
          doc.roundedRect(margin, y, pageWidth - margin * 2, 9, 2, 2, "F");
          doc.setFontSize(10);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(67, 56, 202);
          doc.text(groupKey.substring(0, 45), margin + 3, y + 6.5);
          doc.setFontSize(9);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 116, 139);
          doc.text(`${items.length} loaner${items.length !== 1 ? "s" : ""}`, pageWidth - margin - (groupFines > 0 ? 52 : 5), y + 6.5, { align: "right" });
          if (groupFines > 0) {
            doc.setTextColor(180, 83, 9);
            doc.text(`$${groupFines.toLocaleString()}`, pageWidth - margin - 2, y + 6.5, { align: "right" });
          }
          y += 13;

          for (const l of items) {
            if (y > 270) { doc.addPage(); y = 20; }
            doc.setFontSize(9);
            doc.setFont("helvetica", "bold");
            doc.setTextColor(15, 23, 42);
            doc.text((l.setName || "Unknown Set").substring(0, 38), margin + 3, y);
            doc.setFont("helvetica", "normal");
            doc.setTextColor(100, 116, 139);
            doc.text(`#${l.etchId || "N/A"}`, margin + 3, y + 4.5);
            const secondCol = groupBy === "rep" ? (l.accountName || "") : (l.repName || "");
            doc.text(secondCol.substring(0, 32), margin + 60, y);
            if (l.expectedReturnDate) doc.text(`Due: ${l.expectedReturnDate}`, margin + 60, y + 4.5);
            doc.setFont("helvetica", "bold");
            if (l.isOverdue) {
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
            doc.line(margin + 3, y + 7, pageWidth - margin, y + 7);
            y += 11;
          }
          y += 4;
        }

        addFooters(doc);
        doc.save(getFilename("loaner-report"));
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
          <DialogTitle>Export PDF Report</DialogTitle>
        </DialogHeader>
        <div className="space-y-5 py-2">
          {options.map(opt => (
            <div key={opt.key}>
              <p className="text-sm font-medium text-slate-700 mb-2">{opt.label}</p>
              <div className="flex flex-wrap gap-2">
                {opt.choices.map(c => (
                  <button key={c.value} onClick={() => opt.setter(c.value)}
                    className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                      opt.value === c.value ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                    }`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </div>
          ))}
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