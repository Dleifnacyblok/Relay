import { useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { createDoc, addReportHeader, addFooters, drawPartRow, checkPageBreak, getNow, getFilename } from "@/lib/pdfUtils";

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

        const totalFines = filtered.reduce((sum, p) => sum + (p.fineAmount || 0), 0);
        const { doc, pageWidth, margin } = createDoc();
        let y = addReportHeader(doc, {
          pageWidth, margin,
          title: "My Missing Parts Report",
          subtitle: `Rep: ${userName}`,
          generated: getNow(),
          total: `${filtered.length} part${filtered.length !== 1 ? "s" : ""}`,
          totalFines,
        });

        for (const p of filtered) {
          y = checkPageBreak(doc, y);
          y = drawPartRow(doc, { part: p, y, pageWidth, margin });
        }

        addFooters(doc);
        doc.save(getFilename("missing-parts"));
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
              <button key={c.value} onClick={() => setFilter(c.value)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
                  filter === c.value ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                }`}>
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