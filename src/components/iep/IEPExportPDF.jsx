import { useState } from "react";
import { jsPDF } from "jspdf";
import { FileDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getFilename } from "@/lib/pdfUtils";

const INK = [26, 35, 58];
const MUTED = [107, 114, 128];
const PURPLE = [91, 45, 144];
const RED = [185, 38, 58];
const AMBER = [161, 98, 7];
const GREEN = [21, 122, 74];
const LINE = [229, 231, 235];

const effOf = (s) => s.effPct ?? s.effPctProj ?? null;
const effColor = (e) => (e == null ? MUTED : e >= 100 ? GREEN : e >= 70 ? AMBER : RED);
const num = (v, d = 1) => (typeof v === "number" && !isNaN(v) ? v.toFixed(d) : "0.0");
const clean = (v) => {
  const n = Number(v) || 0;
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
};
const fmtInt = (v) => (Number(v) || 0).toLocaleString("en-US", { maximumFractionDigits: 1 });

const mondayOf = (d) => {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  return s;
};
const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const md = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });

const snapScore = (s) => {
  if (s.overallEffPct != null) return s.overallEffPct;
  const recs = s.records || [];
  const usage = recs.reduce((a, r) => a + (r.totalExpUsage || 0), 0);
  const proc = recs.reduce((a, r) => a + (r.procCmpl || 0), 0);
  return usage > 0 ? (proc / usage) * 100 : null;
};

// Latest score of the most recent week before the current one
const previousWeek = (snapshots = [], currentKey) => {
  const byWeek = new Map();
  snapshots.forEach((s) => {
    const at = new Date(s.importedAt || 0);
    if (isNaN(at)) return;
    const monday = mondayOf(at);
    const key = dayKey(monday);
    const prev = byWeek.get(key);
    if (!prev || at > prev.at) byWeek.set(key, { key, at, monday, score: snapScore(s) });
  });
  return [...byWeek.values()]
    .filter((w) => w.key < currentKey && w.score != null)
    .sort((a, b) => b.key.localeCompare(a.key))[0];
};

const fit = (doc, text, maxW) => {
  let s = String(text ?? "");
  if (doc.getTextWidth(s) <= maxW) return s;
  while (s.length > 1 && doc.getTextWidth(s + "…") > maxW) s = s.slice(0, -1);
  return s + "…";
};

function buildReport({ systems, avgEffPct, lastImport, snapshots }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [105, 221] });
  const PW = 105;
  const PH = 221;
  const L = 7.4;
  const R = 99.5;
  const asOf = lastImport ? new Date(lastImport) : new Date();

  const rows = systems.map((s) => ({
    name: s.systemName || "—",
    sets: s.sysCnt ?? 0,
    usage: s.totalExpUsage ?? 0,
    proc: s.procCmpl ?? 0,
    eff: effOf(s),
  }));
  const totalUsage = rows.reduce((a, r) => a + r.usage, 0);
  const totalProc = rows.reduce((a, r) => a + r.proc, 0);
  const overall = avgEffPct ?? (totalUsage > 0 ? (totalProc / totalUsage) * 100 : null);
  const below = rows.filter((r) => r.eff != null && r.eff < 70).length;
  const mid = rows.filter((r) => r.eff != null && r.eff >= 70 && r.eff < 100).length;
  const above = rows.filter((r) => r.eff != null && r.eff >= 100).length;

  const monday = mondayOf(asOf);
  const prev = previousWeek(snapshots, dayKey(monday));
  const diff = prev && overall != null ? overall - prev.score : null;

  const text = (t, x, y, { size = 8, bold = false, color = INK, align = "left" } = {}) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(String(t), x, y, { align });
  };

  const footer = (n) => {
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(5.8, 217.2, 97.8, 217.2);
    text("RELAY  /  INTERNAL TEAM REPORT", 5.8, 220, { size: 6, color: MUTED });
    text(`${n} / 2`, 97.8, 220, { size: 6, color: MUTED, align: "right" });
  };

  const title = (t, sub) => {
    text("RELAY / IEP", L, 10.6, { size: 8, bold: true, color: PURPLE });
    text(t, L, 20.2, { size: 18.5, bold: true });
    text(sub, L, 25, { size: 7.2, color: MUTED });
  };

  // ---------- Page 1 ----------
  title(
    "Weekly efficiency",
    `Week of ${md(monday)}, ${monday.getFullYear()} | Data as of ${asOf.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })}`
  );

  text("CURRENT IEP SCORE", L, 32.8, { size: 7.2, bold: true, color: MUTED });
  text(overall != null ? `${overall.toFixed(1)}%` : "—", L, 47.5, {
    size: 40,
    bold: true,
    color: effColor(overall),
  });
  if (diff != null) {
    text(
      `${diff >= 0 ? "+" : ""}${diff.toFixed(1)} percentage points vs. week of ${md(prev.monday)}`,
      L,
      53.4,
      { size: 8.2, bold: true, color: diff >= 0 ? GREEN : RED }
    );
  }
  text(`Target: 100% | ${rows.length} systems tracked`, L, 58.2, { size: 7.4, color: MUTED });

  doc.setFillColor(243, 244, 248);
  doc.rect(L, 63.9, R - L, 15.9, "F");
  const stat = [
    ["EXPECTED", fmtInt(totalUsage), INK, 8.7],
    ["COMPLETED", fmtInt(totalProc), INK, 39.3],
    [
      "ABOVE EXPECTED",
      `${totalProc - totalUsage >= 0 ? "+" : ""}${fmtInt(totalProc - totalUsage)}`,
      totalProc - totalUsage >= 0 ? GREEN : RED,
      70,
    ],
  ];
  stat.forEach(([label, value, color, x]) => {
    text(label, x, 68.1, { size: 6.6, bold: true, color: MUTED });
    text(value, x, 77.3, { size: 14.5, bold: true, color });
  });

  text("System performance", L, 88, { size: 12, bold: true });
  const barX = 5.8;
  const barW = 92;
  const total = Math.max(below + mid + above, 1);
  const segs = [
    [below, RED],
    [mid, AMBER],
    [above, GREEN],
  ];
  let bx = barX;
  segs.forEach(([count, color]) => {
    const w = (count / total) * barW;
    if (w > 0) {
      doc.setFillColor(...color);
      doc.rect(bx, 91, w, 2.1, "F");
    }
    bx += w;
  });
  text(`${below} below 70%`, 8.7, 97.2, { size: 6.6, bold: true, color: RED });
  text(`${mid} at 70–99%`, barX + (below / total) * barW + 2.5, 97.2, { size: 6.6, bold: true, color: AMBER });
  text(`${above} at 100%+`, barX + ((below + mid) / total) * barW + 4, 97.2, { size: 6.6, bold: true, color: GREEN });

  text("Top 5 opportunities", L, 108.1, { size: 12, bold: true });
  text("Ranked by potential IEP points gained at 100%.", L, 111.7, { size: 6.8, color: MUTED });

  const opps = rows
    .map((r) => ({ ...r, gap: r.usage - r.proc, pts: totalUsage > 0 ? ((r.usage - r.proc) / totalUsage) * 100 : 0 }))
    .filter((r) => r.pts > 0.001)
    .sort((a, b) => b.pts - a.pts)
    .slice(0, 5);

  const cols = { sys: 8.7, iep: 54.2, gap: 69.1, pts: 84.3 };
  text("SYSTEM", cols.sys, 117.9, { size: 6.2, bold: true, color: MUTED });
  text("IEP", cols.iep, 117.9, { size: 6.2, bold: true, color: MUTED });
  text("GAP", cols.gap, 117.9, { size: 6.2, bold: true, color: MUTED });
  text("PTS", cols.pts, 117.9, { size: 6.2, bold: true, color: MUTED });
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.line(L, 120, R, 120);

  opps.forEach((r, i) => {
    const top = 120 + i * 8.65;
    const base = top + 5.6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    text(fit(doc, r.name, 42), cols.sys, base, { size: 8.2, bold: true });
    text(r.eff != null ? `${r.eff.toFixed(1)}%` : "—", cols.iep, base, { size: 7.8, bold: true, color: effColor(r.eff) });
    text(clean(r.gap), cols.gap, base, { size: 7.8 });
    text(`+${r.pts.toFixed(1)}`, cols.pts, base, { size: 7.8, bold: true, color: PURPLE });
    doc.line(L, top + 8.65, R, top + 8.65);
  });

  text("Gap = procedures below expected. Pts = potential IEP percentage-point gain.", L, 167.9, {
    size: 5.8,
    color: MUTED,
  });
  footer(1);

  // ---------- Page 2 ----------
  doc.addPage();
  title(
    "Set usage & efficiency",
    `${rows.length} systems | Lowest efficiency first | ${asOf.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`
  );

  doc.setFillColor(...PURPLE);
  doc.rect(L, 30.1, R - L, 4.1, "F");
  const hx = { sets: 62.3, exp: 71.8, done: 85.7, iep: 98.6 };
  text("SYSTEM", 8.2, 33.1, { size: 6.2, bold: true, color: [255, 255, 255] });
  text("SETS", hx.sets, 33.1, { size: 6.2, bold: true, color: [255, 255, 255], align: "right" });
  text("EXP.", hx.exp, 33.1, { size: 6.2, bold: true, color: [255, 255, 255], align: "right" });
  text("DONE", hx.done, 33.1, { size: 6.2, bold: true, color: [255, 255, 255], align: "right" });
  text("IEP", hx.iep, 33.1, { size: 6.2, bold: true, color: [255, 255, 255], align: "right" });

  const sorted = [...rows].sort((a, b) => (a.eff ?? 1e9) - (b.eff ?? 1e9));
  const pitch = Math.min(4.13, 162 / Math.max(sorted.length, 1));
  sorted.forEach((r, i) => {
    const top = 34.2 + i * pitch;
    const base = top + pitch * 0.72;
    if (i % 2 === 1) {
      doc.setFillColor(245, 246, 250);
      doc.rect(L, top, R - L, pitch, "F");
    }
    text(fit(doc, r.name, 50), 8.2, base, { size: 6.8 });
    text(String(Math.round(r.sets)), hx.sets, base, { size: 6.8, align: "right" });
    text(num(r.usage), hx.exp, base, { size: 6.8, align: "right" });
    text(num(r.proc), hx.done, base, { size: 6.8, align: "right" });
    text(r.eff != null ? `${r.eff.toFixed(1)}%` : "—", hx.iep, base, {
      size: 6.8,
      bold: true,
      color: effColor(r.eff),
      align: "right",
    });
  });

  text("EXP. = expected procedures. Some system names shortened for readability.", L, 34.2 + sorted.length * pitch + 5, {
    size: 5.8,
    color: MUTED,
  });
  footer(2);

  return doc;
}

export default function IEPExportPDF({ systems, avgEffPct, lastImport, snapshots }) {
  const [busy, setBusy] = useState(false);

  const handleExport = () => {
    setBusy(true);
    try {
      const doc = buildReport({ systems, avgEffPct, lastImport, snapshots });
      doc.save(getFilename("Relay_Weekly_IEP_Report"));
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
      {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
      Export PDF
    </Button>
  );
}