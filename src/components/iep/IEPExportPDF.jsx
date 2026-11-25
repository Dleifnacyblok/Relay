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

function buildReport({ systems, avgEffPct, avgEffPctProj, lastImport, territory }) {
  // Portrait, single column — built to be read on a phone screen
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const m = 14;
  const contentW = W - m * 2;

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

  const sectionTitle = (title, top) => {
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text(title, m, top);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.line(m, top + 2, W - m, top + 2);
    return top + 9;
  };

  const hairline = (top) => {
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.2);
    doc.line(m, top, W - m, top);
  };

  // ---- Header ----
  doc.setFont("helvetica", "bold");
  doc.setFontSize(17);
  doc.setTextColor(30, 41, 59);
  doc.text("IEP Efficiency Report", m, 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(100, 116, 139);
  const stamp = lastImport
    ? ` · Data as of ${lastImport.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}`
    : "";
  doc.text(`Generated ${getNow()}${stamp}`, m, 26);
  doc.text(`${rows.length} systems tracked`, m, 31);

  // ---- Score blocks ----
  const scoreY = 37;
  const scoreH = 30;
  const scoreGap = 5;
  const scoreW = (contentW - scoreGap) / 2;
  [
    {
      x: m,
      label: "CURRENT IEP SCORE",
      value: overall != null ? `${overall.toFixed(1)}%` : "—",
      sub: "all systems",
      color: [124, 58, 237],
    },
    {
      x: m + scoreW + scoreGap,
      label: "PROJECTED SCORE",
      value: avgEffPctProj != null ? `${avgEffPctProj.toFixed(1)}%` : "—",
      sub: "end of period",
      color: [59, 130, 246],
    },
  ].forEach((b) => {
    doc.setFillColor(248, 250, 252);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(b.x, scoreY, scoreW, scoreH, 3, 3, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7);
    doc.setTextColor(100, 116, 139);
    doc.text(b.label, b.x + scoreW / 2, scoreY + 8, { align: "center" });
    doc.setFontSize(24);
    doc.setTextColor(...b.color);
    doc.text(b.value, b.x + scoreW / 2, scoreY + 20, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.text(b.sub, b.x + scoreW / 2, scoreY + 26, { align: "center" });
  });

  // ---- Compact stats ----
  let y = scoreY + scoreH + 8;
  const smallStats = [
    { label: "TOTAL EXPECTED USAGE", value: n1(totalUsage) },
    { label: "PROCEDURES COMPLETED", value: n1(totalProc) },
    { label: "ABOVE TARGET (≥100%)", value: `${above} systems` },
    { label: "BELOW 70%", value: `${below} systems` },
  ];
  const statGap = 4;
  const statW = (contentW - statGap) / 2;
  const statH = 15;
  smallStats.forEach((s, i) => {
    const col = i % 2;
    const row = Math.floor(i / 2);
    const x = m + col * (statW + statGap);
    const top = y + row * (statH + statGap);
    doc.setFillColor(255, 255, 255);
    doc.setDrawColor(226, 232, 240);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, top, statW, statH, 2, 2, "FD");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(100, 116, 139);
    doc.text(s.label, x + 4, top + 5.5);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(12);
    doc.setTextColor(30, 41, 59);
    doc.text(s.value, x + 4, top + 11.8);
  });
  y += statH * 2 + statGap + 9;

  if (territory && territory.total) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(
      `IEP-tracked sets in territory: ${territory.total} active · ${territory.overdue} overdue · ${territory.dueSoon} due within 7 days`,
      m,
      y
    );
    y += 8;
  }

  // ---- Where to Improve ----
  y = sectionTitle("Where to Improve", y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184);
  doc.text("Ranked by points each system could add by reaching 100%.", m, y);
  y += 7;

  if (!opportunities.length) {
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text("Every system is at or above its expected usage.", m, y + 3);
    y += 12;
  } else {
    opportunities.slice(0, 6).forEach((r, i) => {
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.5);
      doc.setTextColor(15, 23, 42);
      doc.text(`${i + 1}. ${fit(doc, r.name, contentW - 28)}`, m, y + 4.5);

      doc.setFontSize(9.5);
      doc.setTextColor(...effColor(r.eff));
      doc.text(r.eff != null ? `${r.eff.toFixed(1)}%` : "—", W - m, y + 4.5, { align: "right" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(
        `${n1(r.gap)} procedures below expected  ·  +${r.pts.toFixed(2)} pts potential`,
        m,
        y + 9.8
      );

      hairline(y + 12);
      y += 14;
    });
    y += 4;
  }

  // ---- Systems, one card per system ----
  if (y > H - 40) {
    doc.addPage();
    y = 20;
  }
  y = sectionTitle("Set Usage & Efficiency", y);

  const tableRows = [...rows].sort((a, b) => (b.usage || 0) - (a.usage || 0));
  tableRows.forEach((r) => {
    if (y > H - 26) {
      doc.addPage();
      y = 20;
      y = sectionTitle("Set Usage & Efficiency (cont.)", y);
    }

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(15, 23, 42);
    doc.text(fit(doc, r.name, contentW - 26), m, y + 4.5);

    doc.setTextColor(...effColor(r.eff));
    doc.text(r.eff != null ? `${r.eff.toFixed(1)}%` : "—", W - m, y + 4.5, { align: "right" });

    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    const detail = [
      `${n1(r.sets)} sets`,
      `Cons ${n1(r.cons)}`,
      `Loaner ${n1(r.loaner)}`,
      `Total ${n1(r.usage)}`,
      `Done ${n1(r.proc)}`,
      `Proj ${r.effProj != null ? `${r.effProj.toFixed(1)}%` : "—"}`,
    ].join("  ·  ");
    doc.text(fit(doc, detail, contentW), m, y + 9.8);

    hairline(y + 12);
    y += 14;
  });

  // ---- Footers ----
  const pages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(148, 163, 184);
    doc.text("Relay · IEP Efficiency Report", m, H - 10);
    doc.text(`Page ${p} of ${pages}`, W - m, H - 10, { align: "right" });
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