import { useState, useMemo } from "react";
import { Download, Loader2, Package, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { createDoc, addReportHeader, addFooters, drawLoanerRow, drawPartRow, checkPageBreak, getNow, getFilename } from "@/lib/pdfUtils";

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
  const [filterType, setFilterType] = useState("all");
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
        const { doc, pageWidth, margin } = createDoc();
        const subtitle = filterType === "rep" && selectedValue ? `Rep: ${selectedValue}` : filterType === "account" && selectedValue ? `Account: ${selectedValue}` : "All Reps";

        let y = addReportHeader(doc, {
          pageWidth, margin,
          title: "ESC Loaners Report",
          subtitle,
          generated: getNow(),
          total: `${filtered.length} loaner${filtered.length !== 1 ? "s" : ""}`,
        });

        for (const loaner of filtered) {
          y = checkPageBreak(doc, y);
          y = drawLoanerRow(doc, { loaner, y, pageWidth, margin });
        }

        addFooters(doc);
        doc.save(getFilename("esc-loaners"));
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
          <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:border-indigo-400"
            value={selectedValue} onChange={e => setSelectedValue(e.target.value)}>
            <option value="">— All Reps —</option>
            {reps.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      )}

      {filterType === "account" && (
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Select Account</p>
          <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:border-indigo-400"
            value={selectedValue} onChange={e => setSelectedValue(e.target.value)}>
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
  const [filterType, setFilterType] = useState("all");
  const [selectedValue, setSelectedValue] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);

  const reps = useMemo(() => [...new Set(parts.map(p => p.repName).filter(Boolean))].sort(), [parts]);
  const loanerSets = useMemo(() => [...new Set(parts.map(p => p.loanerSetName).filter(Boolean))].sort(), [parts]);

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
        const { doc, pageWidth, margin } = createDoc();
        const subtitle = filterType === "rep" && selectedValue ? `Rep: ${selectedValue}` : filterType === "account" && selectedValue ? `Loaner Set: ${selectedValue}` : "All Reps";
        const totalFines = filtered.reduce((sum, p) => sum + (p.fineAmount || 0), 0);

        let y = addReportHeader(doc, {
          pageWidth, margin,
          title: "ESC Missing Parts Report",
          subtitle,
          generated: getNow(),
          total: `${filtered.length} part${filtered.length !== 1 ? "s" : ""}`,
          totalFines,
        });

        for (const part of filtered) {
          y = checkPageBreak(doc, y);
          y = drawPartRow(doc, { part, y, pageWidth, margin });
        }

        addFooters(doc);
        doc.save(getFilename("esc-missing-parts"));
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
          <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:border-indigo-400"
            value={selectedValue} onChange={e => setSelectedValue(e.target.value)}>
            <option value="">— All Reps —</option>
            {reps.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
      )}

      {filterType === "account" && (
        <div>
          <p className="text-sm font-medium text-slate-700 mb-2">Select Loaner Set</p>
          <select className="w-full border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 bg-white focus:outline-none focus:border-indigo-400"
            value={selectedValue} onChange={e => setSelectedValue(e.target.value)}>
            <option value="">— All Loaner Sets —</option>
            {loanerSets.map(a => <option key={a} value={a}>{a}</option>)}
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