import { useState, useMemo } from "react";
import { jsPDF } from "jspdf";
import { Download, Loader2, Package, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function FilterButton({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium border transition-colors ${
        active
          ? "bg-indigo-600 text-white border-indigo-600"
          : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
      }`}
    >
      {children}
    </button>
  );
}

function LoanersExport({ loaners, onClose }) {
  const [filterType, setFilterType] = useState("all"); // all | rep | account
  const [selectedValue, setSelectedValue] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const reps = useMemo(() => [...new Set(loaners.map(l => l.repName || l.associateSalesRep || l.fieldSalesRep).filter(Boolean))].sort(), [loaners]);
  const accounts = useMemo(() => [...new Set(loaners.map(l => l.accountName).filter(Boolean))].sort(), [loaners]);

  const getFiltered = () => {
    if (filterType === "rep" && selectedValue) return loaners.filter(l => (l.repName || l.associateSalesRep || l.fieldSalesRep) === selectedValue);
    if (filterType === "account" && selectedValue) return loaners.filter(l => l.accountName === selectedValue);
    return loaners;
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      try {
        const filtered = getFiltered();
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 14;
        const now = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
        const subtitle = filterType === "rep" && selectedValue ? `Rep: ${selectedValue}` : filterType === "account" && selectedValue ? `Account: ${selectedValue}` : "All Reps";

        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text("ESC Loaners Report", margin, 20);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(subtitle, margin, 28);
        doc.text(`Generated: ${now}  |  Total: ${filtered.length} loaner${filtered.length !== 1 ? "s" : ""}`, margin, 34);

        let y = 44;
        for (const l of filtered) {
          if (y > 270) { doc.addPage(); y = 20; }
          doc.setFontSize(9);
          doc.setFont("helvetica", "bold");
          doc.setTextColor(15, 23, 42);
          doc.text((l.setName || "Unknown Set").substring(0, 50), margin + 3, y);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 116, 139);
          doc.text(`#${l.etchId || "N/A"}  |  ${l.accountName || ""}`, margin + 3, y + 4.5);
          if (l.repName || l.fieldSalesRep) doc.text(`Rep: ${l.repName || l.fieldSalesRep}`, margin + 3, y + 9);
          if (l.expectedReturnDate) doc.text(`Due: ${l.expectedReturnDate}`, margin + 3, y + 13.5);
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
        doc.save(`esc-loaners-${new Date().toISOString().slice(0, 10)}.pdf`);
        onClose();
      } finally {
        setIsGenerating(false);
      }
    }, 50);
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-slate-700 mb-2">Filter by</p>
        <div className="flex gap-2 flex-wrap">
          <FilterButton active={filterType === "all"} onClick={() => { setFilterType("all"); setSelectedValue(""); }}>All</FilterButton>
          <FilterButton active={filterType === "rep"} onClick={() => { setFilterType("rep"); setSelectedValue(""); }}>By Rep</FilterButton>
          <FilterButton active={filterType === "account"} onClick={() => { setFilterType("account"); setSelectedValue(""); }}>By Account</FilterButton>
        </div>
      </div>

      {filterType === "rep" && (
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Select Rep</p>
          <select
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:border-indigo-400"
            value={selectedValue}
            onChange={e => setSelectedValue(e.target.value)}
          >
            <option value="">— All Reps —</option>
            {reps.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      )}

      {filterType === "account" && (
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Select Account</p>
          <select
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:border-indigo-400"
            value={selectedValue}
            onChange={e => setSelectedValue(e.target.value)}
          >
            <option value="">— All Accounts —</option>
            {accounts.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      )}

      <p className="text-xs text-slate-400">{getFiltered().length} loaner{getFiltered().length !== 1 ? "s" : ""} will be exported</p>

      <Button onClick={handleGenerate} disabled={isGenerating} className="w-full gap-2">
        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        Export Loaners PDF
      </Button>
    </div>
  );
}

function MissingPartsExport({ parts, onClose }) {
  const [filterType, setFilterType] = useState("all"); // all | rep | account
  const [selectedValue, setSelectedValue] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const reps = useMemo(() => [...new Set(parts.map(p => p.repName).filter(Boolean))].sort(), [parts]);
  const accounts = useMemo(() => [...new Set(parts.map(p => p.loanerSetName).filter(Boolean))].sort(), [parts]);

  const getFiltered = () => {
    if (filterType === "rep" && selectedValue) return parts.filter(p => p.repName === selectedValue);
    if (filterType === "account" && selectedValue) return parts.filter(p => p.loanerSetName === selectedValue);
    return parts;
  };

  const handleGenerate = () => {
    setIsGenerating(true);
    setTimeout(() => {
      try {
        const filtered = getFiltered();
        const doc = new jsPDF();
        const pageWidth = doc.internal.pageSize.getWidth();
        const margin = 14;
        const now = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
        const totalFines = filtered.reduce((sum, p) => sum + (p.fineAmount || 0), 0);
        const subtitle = filterType === "rep" && selectedValue ? `Rep: ${selectedValue}` : filterType === "account" && selectedValue ? `Loaner Set: ${selectedValue}` : "All Reps";

        doc.setFontSize(18);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(30, 41, 59);
        doc.text("ESC Missing Parts Report", margin, 20);
        doc.setFontSize(9);
        doc.setFont("helvetica", "normal");
        doc.setTextColor(100, 116, 139);
        doc.text(subtitle, margin, 28);
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
          doc.text((p.partName || "Unknown Part").substring(0, 50), margin + 3, y);
          doc.setFont("helvetica", "normal");
          doc.setTextColor(100, 116, 139);
          if (p.repName) doc.text(`Rep: ${p.repName}`, margin + 3, y + 4.5);
          if (p.partNumber) doc.text(`Part #: ${p.partNumber}`, margin + 3, y + 9);
          const line3Parts = [];
          if (p.loanerSetName) line3Parts.push(`Loaner: ${p.loanerSetName}`);
          if (p.etchId) line3Parts.push(`Etch: ${p.etchId}`);
          if (line3Parts.length) doc.text(line3Parts.join("  |  "), margin + 3, y + 13.5);
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
        doc.save(`esc-missing-parts-${new Date().toISOString().slice(0, 10)}.pdf`);
        onClose();
      } finally {
        setIsGenerating(false);
      }
    }, 50);
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm font-medium text-slate-700 mb-2">Filter by</p>
        <div className="flex gap-2 flex-wrap">
          <FilterButton active={filterType === "all"} onClick={() => { setFilterType("all"); setSelectedValue(""); }}>All</FilterButton>
          <FilterButton active={filterType === "rep"} onClick={() => { setFilterType("rep"); setSelectedValue(""); }}>By Rep</FilterButton>
          <FilterButton active={filterType === "account"} onClick={() => { setFilterType("account"); setSelectedValue(""); }}>By Loaner Set</FilterButton>
        </div>
      </div>

      {filterType === "rep" && (
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Select Rep</p>
          <select
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:border-indigo-400"
            value={selectedValue}
            onChange={e => setSelectedValue(e.target.value)}
          >
            <option value="">— All Reps —</option>
            {reps.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      )}

      {filterType === "account" && (
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Select Loaner Set</p>
          <select
            className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:border-indigo-400"
            value={selectedValue}
            onChange={e => setSelectedValue(e.target.value)}
          >
            <option value="">— All Loaner Sets —</option>
            {accounts.map(a => <option key={a} value={a}>{a}</option>)}
          </select>
        </div>
      )}

      <p className="text-xs text-slate-400">{getFiltered().length} part{getFiltered().length !== 1 ? "s" : ""} will be exported</p>

      <Button onClick={handleGenerate} disabled={isGenerating} className="w-full gap-2">
        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
        Export Missing Parts PDF
      </Button>
    </div>
  );
}

export default function ESCExportDialog({ open, onClose, loaners, missingParts }) {
  const [tab, setTab] = useState("loaners");

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle>ESC Export</DialogTitle>
        </DialogHeader>

        {/* Tab Switcher */}
        <div className="flex bg-slate-100 rounded-xl p-1 gap-1">
          <button
            onClick={() => setTab("loaners")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "loaners" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            Loaners
          </button>
          <button
            onClick={() => setTab("parts")}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === "parts" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <AlertTriangle className="w-3.5 h-3.5" />
            Missing Parts
          </button>
        </div>

        <div className="pt-1">
          {tab === "loaners" ? (
            <LoanersExport loaners={loaners} onClose={onClose} />
          ) : (
            <MissingPartsExport parts={missingParts} onClose={onClose} />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}