import { useState } from "react";
import { Download, Loader2, FileText, Table } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { createDoc, addFooters, getNow, getFilename } from "@/lib/pdfUtils";
import { formatCurrency } from "@/components/loaners/loanerUtils";
import * as XLSX from "xlsx";

export default function AnalyticsExportDialog({ open, onClose, analyticsData }) {
  const [fmt, setFmt] = useState("pdf");
  const [report, setReport] = useState("fines");
  const [isGenerating, setIsGenerating] = useState(false);

  const {
    monthlyFines = [],
    overdueByRep = [],
    finesByRep = [],
    topOverdueSets = [],
    topOverdueAccounts = [],
    overdueLoaners = [],
    totalLoaners = 0,
    overdueCount = 0,
    totalFines = 0,
    activeMissingParts = 0,
  } = analyticsData || {};

  const handleExport = () => {
    setIsGenerating(true);
    setTimeout(() => {
      try {
        if (fmt === "excel") exportExcel();
        else exportPDF();
        onClose();
      } catch (err) {
        console.error("Export error:", err);
      } finally {
        setIsGenerating(false);
      }
    }, 100);
  };

  // ── EXCEL ──────────────────────────────────────────────────────────────────
  const exportExcel = () => {
    const wb = XLSX.utils.book_new();
    const now = new Date().toISOString().slice(0, 10);

    if (report === "fines" || report === "all") {
      const monthlyRows = monthlyFines.map(m => ({
        Month: m.month,
        "Loaner Fines": m.loanerFines,
        "Part Fines": m.partFines,
        "Total": m.total,
      }));
      if (monthlyRows.length) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(monthlyRows), "Monthly Fines");
      }

      const repRows = finesByRep.map(r => ({
        Representative: r.rep,
        "Total Fines ($)": r.fines,
      }));
      if (repRows.length) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(repRows), "Fines by Rep");
      }
    }

    if (report === "risk" || report === "all") {
      // Overdue loaners list (top of risk section)
      if (overdueLoaners.length) {
        const overdueRows = overdueLoaners.map(l => ({
          "Set Name": l.setName || "",
          "Account": l.accountName || "",
          "Rep": l.repName || "",
          "Loaned Date": l.loanedDate || "",
          "Expected Return": l.expectedReturnDate || "",
          "Days Overdue": l.daysOverdue || 0,
          "Fine ($)": l.fineAmount || 0,
        }));
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(overdueRows), "Overdue Loaners");
      }

      const summaryRows = [{
        "Total Loaners": totalLoaners,
        "Overdue Count": overdueCount,
        "Overdue Rate (%)": totalLoaners > 0 ? Math.round(overdueCount / totalLoaners * 100) : 0,
        "Total Fines ($)": totalFines,
        "Active Missing Parts": activeMissingParts,
      }];
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryRows), "Risk Summary");

      const overdueRepRows = overdueByRep.map(r => ({
        Representative: r.rep,
        "Total Loaners": r.total,
        "Overdue": r.overdue,
        "Fines ($)": r.fines,
      }));
      if (overdueRepRows.length) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(overdueRepRows), "Overdue by Rep");
      }

      const acctRows = topOverdueAccounts.map(a => ({
        Account: a.account,
        "Total Loaners": a.total,
        "Overdue": a.overdue,
        "Due Soon": a.dueSoon,
        "Fines ($)": a.fines,
      }));
      if (acctRows.length) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(acctRows), "Overdue by Account");
      }

      const setRows = topOverdueSets.map((s, i) => ({
        Rank: i + 1,
        "Set Name": s.setName,
        "Total Loaners": s.total,
        "Overdue": s.overdue,
        "Fines ($)": s.fines,
      }));
      if (setRows.length) {
        XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(setRows), "Top Overdue Sets");
      }
    }

    if (!wb.SheetNames.length) {
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet([{ Note: "No data available" }]), "Sheet1");
    }

    XLSX.writeFile(wb, `relay-analytics-${now}.xlsx`);
  };

  // ── PDF ────────────────────────────────────────────────────────────────────
  const exportPDF = () => {
    const { doc, pageWidth, margin } = createDoc();
    const now = getNow();
    let y = 14;

    const heading = (text, size = 13) => {
      if (y > 260) { doc.addPage(); y = 14; }
      doc.setFontSize(size);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(30, 41, 59);
      doc.text(text, margin, y);
      y += size === 13 ? 7 : 5;
    };

    const subheading = (text) => {
      if (y > 265) { doc.addPage(); y = 14; }
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(text, margin, y);
      y += 5;
    };

    const divider = () => {
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(margin, y, pageWidth - margin, y);
      y += 5;
    };

    const tableRow = (cols, widths, bold = false, color = [30, 41, 59]) => {
      if (y > 270) { doc.addPage(); y = 14; }
      doc.setFontSize(8.5);
      doc.setFont("helvetica", bold ? "bold" : "normal");
      doc.setTextColor(...color);
      let x = margin;
      cols.forEach((col, i) => {
        doc.text(String(col ?? "").substring(0, 30), x, y);
        x += widths[i];
      });
      y += 6;
    };

    // ── Title ──
    doc.setFontSize(18);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(67, 56, 202);
    doc.text("Relay Analytics Report", margin, y + 4);
    y += 12;
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${now}`, margin, y);
    y += 10;

    // ── KPI summary box ──
    doc.setFillColor(238, 242, 255);
    doc.roundedRect(margin, y, pageWidth - margin * 2, 18, 2, 2, "F");
    doc.setFontSize(9);
    doc.setFont("helvetica", "bold");
    doc.setTextColor(67, 56, 202);
    const kpis = [
      `Total Loaners: ${totalLoaners}`,
      `Overdue: ${overdueCount}`,
      `Total Fines: ${formatCurrency(totalFines)}`,
      `Missing Parts: ${activeMissingParts}`,
    ];
    kpis.forEach((k, i) => doc.text(k, margin + 3 + i * 45, y + 7));
    y += 24;

    // ── OVERDUE LOANERS (always at top when risk or all) ──
    if (report === "risk" || report === "all") {
      heading("Overdue Loaners");
      divider();
      if (overdueLoaners.length) {
        tableRow(["Set Name", "Account", "Rep", "Days Overdue", "Fine"], [55, 50, 40, 28, 35], true, [100, 116, 139]);
        overdueLoaners.forEach(l => {
          tableRow([
            l.setName || "—",
            (l.accountName || "—").substring(0, 20),
            (l.repName || "—").substring(0, 18),
            l.daysOverdue || 0,
            formatCurrency(l.fineAmount || 0),
          ], [55, 50, 40, 28, 35]);
        });
      } else {
        subheading("No overdue loaners.");
      }
      y += 8;

      heading("Overdue Risk by Representative");
      divider();
      tableRow(["Rep", "Total", "Overdue", "Fines"], [70, 35, 35, 50], true, [100, 116, 139]);
      overdueByRep.forEach(r => tableRow([r.rep, r.total, r.overdue, formatCurrency(r.fines)], [70, 35, 35, 50]));
      if (!overdueByRep.length) subheading("No overdue data available.");
      y += 8;

      heading("Top Overdue Accounts");
      divider();
      tableRow(["Account", "Total", "Overdue", "Due Soon", "Fines"], [55, 25, 30, 30, 45], true, [100, 116, 139]);
      topOverdueAccounts.forEach(a =>
        tableRow([a.account, a.total, a.overdue, a.dueSoon, formatCurrency(a.fines)], [55, 25, 30, 30, 45])
      );
      if (!topOverdueAccounts.length) subheading("No overdue accounts.");
      y += 8;

      heading("Top Overdue Sets");
      divider();
      tableRow(["Set Name", "Total", "Overdue", "Fines"], [75, 25, 30, 55], true, [100, 116, 139]);
      topOverdueSets.forEach(s => tableRow([s.setName, s.total, s.overdue, formatCurrency(s.fines)], [75, 25, 30, 55]));
      if (!topOverdueSets.length) subheading("No overdue sets.");
      y += 8;
    }

    if (report === "fines" || report === "all") {
      heading("Monthly Fines History");
      divider();
      tableRow(["Month", "Loaner Fines", "Part Fines", "Total"], [50, 50, 50, 50], true, [100, 116, 139]);
      monthlyFines.forEach(m => {
        tableRow([m.month, formatCurrency(m.loanerFines), formatCurrency(m.partFines), formatCurrency(m.total)], [50, 50, 50, 50]);
      });
      if (!monthlyFines.length) subheading("No monthly fine data available.");

      if (monthlyFines.length) {
        const gt = monthlyFines.reduce((s, m) => s + (m.total || 0), 0);
        const lt = monthlyFines.reduce((s, m) => s + (m.loanerFines || 0), 0);
        const pt = monthlyFines.reduce((s, m) => s + (m.partFines || 0), 0);
        tableRow(["TOTAL", formatCurrency(lt), formatCurrency(pt), formatCurrency(gt)], [50, 50, 50, 50], true, [180, 83, 9]);
      }
      y += 8;

      heading("Fines by Representative");
      divider();
      tableRow(["Representative", "Total Fines"], [100, 60], true, [100, 116, 139]);
      finesByRep.forEach(r => tableRow([r.rep, formatCurrency(r.fines)], [100, 60]));
      if (!finesByRep.length) subheading("No fines data available.");
    }

    addFooters(doc);
    doc.save(getFilename("relay-analytics"));
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Download className="w-4 h-4" /> Export Analytics Report
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-5 py-2">
          {/* Format */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Format</p>
            <div className="flex gap-2">
              {[
                { value: "pdf", label: "PDF", icon: FileText },
                { value: "excel", label: "Excel", icon: Table },
              ].map(({ value, label, icon: Icon }) => (
                <button key={value} onClick={() => setFmt(value)}
                  className={`flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                    fmt === value ? "bg-indigo-600 text-white border-indigo-600" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-300"
                  }`}>
                  <Icon className="w-4 h-4" /> {label}
                </button>
              ))}
            </div>
          </div>

          {/* Report Type */}
          <div>
            <p className="text-sm font-medium text-slate-700 mb-2">Report Type</p>
            <div className="flex flex-col gap-2">
              {[
                { value: "fines", label: "Monthly Fines & Fine Exposure", desc: "Monthly history + fines by rep" },
                { value: "risk", label: "Risk Analysis", desc: "Overdue loaners list, by rep, account, and set" },
                { value: "all", label: "Full Report", desc: "All sections combined" },
              ].map(c => (
                <button key={c.value} onClick={() => setReport(c.value)}
                  className={`text-left px-3 py-2.5 rounded-lg text-sm border transition-colors ${
                    report === c.value ? "bg-indigo-50 border-indigo-400 text-indigo-800" : "bg-white text-slate-600 border-slate-200 hover:border-indigo-200"
                  }`}>
                  <span className="font-medium">{c.label}</span>
                  <span className="text-xs block text-slate-400">{c.desc}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleExport} disabled={isGenerating} className="gap-2">
            {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Export {fmt.toUpperCase()}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}