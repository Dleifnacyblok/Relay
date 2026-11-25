import { useState } from "react";
import { jsPDF } from "jspdf";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFilename, getNow } from "@/lib/pdfUtils";

const effOf = (s) => s.effPct ?? s.effPctProj ?? null;

const n1 = (v) => {
  const n = typeof v === "number" ? v : parseFloat(v);
  return isNaN(n) ? "—" : n.toFixed(1);
};

const effColor = (eff) => {
  if (eff == null) return [148, 163, 184];
  if (eff >= 100) return [21, 128, 61];
  if (eff >= 70) return [180, 83, 9];
  return [220, 38, 38];
};

const fit = (doc, text, maxW) => {
  const s = String(text ?? "");
  if (doc.getTextWidth(s) <= maxW) return s;
  let out = s;
  while (out.length > 1 && doc.getTextWidth(out + "…") > maxW) out = out.slice(0, -1);
  return out + "…";
};

const sectionTitle = (doc, title, x, y) => {
  doc.setFont("helvetica", "bold");
  doc.setFontSize(11);
  doc.setTextColor(30, 41, 59);
  doc.text(title, x, y);
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.3);
  doc.line(x, y + 2, doc.internal.pageSize.getWidth() - x, y + 2);
  return y + 8;
};

function buildReport({ systems, avgEffPct, avgEffPctProj, lastImport, territory }) {
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const m = 12;

  const rows = systems.map((s) => ({
    name: s.systemName || "—",
    sets: s.sysCnt ?? null,
    cons: s.consExpUsage ?? null,
    loaner: s.loanerExpUsage ?? null,
    usage: s.totalExpUsage ?? 0,
    proc: s.procCmpl ?? 0,
    eff: effOf(s),
    effProj: s.effPctProj ?? null,
  }));

  const totalUsage = rows.reduce((a, r) => a + (r.usage || 0), 0);
  const totalProc = rows.reduce((a, r) => a + (r.proc || 0), 0);
  const overall = avgEffPct ?? (totalUsage > 0 ? (totalProc / totalUsage) * 100 : null);
  const above = rows.filter((r) => r.eff != null && r.eff >= 100).length;
  const below = rows.filter((r) => r.eff != null && r.eff < 70).length;

  const opportunities = rows
    .map((r) => ({
      ...r,
      gap: r.usage - r.proc,
      pts: totalUsage > 0 ? (Math.max(0, r.usage - r.proc) / totalUsage) * 100 : 0,
    }))
    .filter((r) => r.pts > 0.001)
    .sort((a, b) => b.pts - a.pts);

  // ---- Header ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(18);
  doc.setTextColor(30, 41, 59);
  doc.text("IEP Efficiency Report", m, 16);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(100, 116, 139);
  const stamp = lastImport
    ? `  ·  Data as of ${lastImport.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}`
    : "";
  doc.text(`Generated ${getNow()}${stamp}  ·  ${rows.length} systems tracked`, m, 22.5);

  // ---- Stat boxes ----
  const stats = [
    { label: "CURRENT IEP SCORE", value: overall != null ? `${overall.toFixed(1)}%` : "—", color: [124, 58, 237] },
    { label: "PROJECTED SCORE", value: avgEffPctProj != null ? `${avgEffPctProj.toFixed(1)}%` : "—", color: [59, 130, 246] },
    { label: "TOTAL EXPECTED USAGE", value: n1(totalUsage), color: [30, 41, 59] },
    { label: "PROCEDURES COMPLETED", value: n1(totalProc), color: [30, 41, 59] },
    { label: "ABOVE TARGET / BELOW 70%", value: `${above} / ${below}`, color: [30, 41, 59] },
  ];
  let y = 28;
  const boxGap = 4;
  const boxW = (W - m * 2 - boxGap * (stats.length - 1)) / stats.length;
  let bx = m;
  stats.forEach((s) => {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(bx, y, boxW, 16, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(14);
    doc.setTextColor(...s.color);
    doc.text(s.value, bx + boxW / 2, y + 7.5, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(s.label, bx + boxW / 2, y + 12.5, { align: "center" });
    bx += boxW + boxGap;
  });
  y += 23;

  if (territory && territory.total) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `IEP-tracked sets in territory: ${territory.total} active  ·  ${territory.overdue} overdue  ·  ${territory.dueSoon} due within 7 days`,
      m,
      y
    );
    y += 7;
  }

  // ---- Where to Improve ----
  y = sectionTitle(doc, "Where to Improve", m, y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text("Systems ranked by the points they could add to the overall score by reaching 100% efficiency.", m, y);
  y += 6;

  if (!opportunities.length) {
    doc.setFontSize(8.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Every system is at or above its expected usage. No gaps to close.", m, y);
    y += 9;
  } else {
    opportunities.slice(0, 8).forEach((r, i) => {
      const rowY = y + i * 6.5;
      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text(`${i + 1}`, m, rowY);

      doc.setTextColor(15, 23, 42);
      doc.text(fit(doc, r.name, 92), m + 6, rowY);

      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(`${n1(r.gap)} procedures below expected`, m + 104, rowY);

      doc.setFont("helvetica", "bold");
      doc.setTextColor(124, 58, 237);
      doc.text(`+${r.pts.toFixed(2)} pts`, m + 178, rowY);

      doc.setTextColor(...effColor(r.eff));
      doc.text(r.eff != null ? `${r.eff.toFixed(1)}%` : "—", W - m, rowY, { align: "right" });
    });
    y += Math.min(opportunities.length, 8) * 6.5 + 5;
  }

  // ---- System table ----
  if (y > H - 45) {
    doc.addPage();
    y = 20;
  }
  y = sectionTitle(doc, "Set Usage & Efficiency by System", m, y);

  const cols = [
    { key: "name", label: "SYSTEM", x: m + 2, align: "left", w: 78 },
    { key: "sets", label: "SETS", x: 112, align: "right" },
    { key: "cons", label: "CONS USAGE", x: 144, align: "right" },
    { key: "loaner", label: "LOANER USAGE", x: 178, align: "right" },
    { key: "usage", label: "TOTAL USAGE", x: 212, align: "right" },
    { key: "proc", label: "PROCS DONE", x: 244, align: "right" },
    { key: "eff", label: "EFF %", x: 266, align: "right" },
    { key: "effProj", label: "PROJ %", x: W - m, align: "right" },
  ];

  const drawHead = (top) => {
    doc.setFillColor(248, 250, 252);
    doc.rect(m, top, W - m * 2, 6.5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    cols.forEach((c) => doc.text(c.label, c.x, top + 4.3, { align: c.align }));
    return top + 6.5;
  };

  y = drawHead(y);

  const tableRows = [...rows].sort((a, b) => (b.usage || 0) - (a.usage || 0));
  tableRows.forEach((r, i) => {
    if (y > H - 20) {
      doc.addPage();
      y = 20;
      y = drawHead(y);
    }
    if (i % 2 === 1) {
      doc.setFillColor(252, 252, 253);
      doc.rect(m, y, W - m * 2, 5.6, "F");
    }
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(15, 23, 42);
    doc.text(fit(doc, r.name, 78), m + 2, y + 3.9);

    doc.setFont("helvetica", "normal");
    doc.setTextColor(71, 85, 105);
    doc.text(n1(r.sets), 112, y + 3.9, { align: "right" });
    doc.text(n1(r.cons), 144, y + 3.9, { align: "right" });
    doc.text(n1(r.loaner), 178, y + 3.9, { align: "right" });
    doc.text(n1(r.usage), 212, y + 3.9, { align: "right" });
    doc.text(n1(r.proc), 244, y + 3.9, { align: "right" });

    doc.setFont("helvetica", "bold");
    doc.setTextColor(...effColor(r.eff));
    doc.text(r.eff != null ? `${r.eff.toFixed(1)}%` : "—", 266, y + 3.9, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setTextColor(...effColor(r.effProj));
    doc.text(r.effProj != null ? `${r.effProj.toFixed(1)}%` : "—", W - m, y + 3.9, { align: "right" });

    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.2);
    doc.line(m, y + 5.6, W - m, y + 5.6);
    y += 5.6;
  });

  // ---- Footers ----
  const pages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text("Relay  ·  IEP Efficiency Report", m, H - 7);
    doc.text(`Page ${p} of ${pages}`, W / 2, H - 7, { align: "center" });
  }

  return doc;
}

export default function IEPExportPDF({ systems, avgEffPct, avgEffPctProj, lastImport, territory }) {
  const [busy, setBusy] = useState(false);

  const handleExport = () => {
    setBusy(true);
    try {
      const doc = buildReport({ systems, avgEffPct, avgEffPctProj, lastImport, territory });
      doc.save(getFilename("IEP-Efficiency-Report"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={busy || !systems.length}
      className="bg-purple-600 hover:bg-purple-700 h-10"
    >
      {busy ? (
        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
      ) : (
        <FileDown className="w-4 h-4 mr-2" />
      )}
      Export PDF
    </Button>
  );
}