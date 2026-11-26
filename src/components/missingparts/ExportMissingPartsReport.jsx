import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { jsPDF } from "jspdf";
import { FileDown, Loader2 } from "lucide-react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { getFilename } from "@/lib/pdfUtils";

const INK = [26, 35, 58];
const MUTED = [107, 114, 128];
const PURPLE = [91, 45, 144];
const RED = [185, 38, 58];
const AMBER = [161, 98, 7];
const GREEN = [21, 122, 74];
const LINE = [229, 231, 235];

const mondayOf = (d) => {
  const s = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  s.setDate(s.getDate() - ((s.getDay() + 6) % 7));
  return s;
};
const dayKey = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const md = (d) => d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
const money = (v) => `$${Math.round(Number(v) || 0).toLocaleString("en-US")}`;

// Latest fines total of the most recent week before the current one
const previousWeek = (snapshots = [], currentKey) => {
  const byWeek = new Map();
  snapshots.forEach((s) => {
    const at = new Date(s.importedAt || 0);
    if (isNaN(at)) return;
    const monday = mondayOf(at);
    const key = dayKey(monday);
    const prev = byWeek.get(key);
    if (!prev || at > prev.at) byWeek.set(key, { key, at, monday, fines: Number(s.totalFines) || 0 });
  });
  return [...byWeek.values()]
    .filter((w) => w.key < currentKey)
    .sort((a, b) => b.key.localeCompare(a.key))[0];
};

const fit = (doc, text, maxW) => {
  let s = String(text ?? "");
  if (doc.getTextWidth(s) <= maxW) return s;
  while (s.length > 1 && doc.getTextWidth(s + "…") > maxW) s = s.slice(0, -1);
  return s + "…";
};

const daysOpen = (p) => {
  if (!p.missingDate) return 0;
  const d = new Date(p.missingDate);
  if (isNaN(d)) return 0;
  const diff = Math.floor((Date.now() - d) / 86400000);
  return diff > 0 ? diff : 0;
};

function buildReport({ parts, snapshots, now }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [105, 221] });
  const L = 7.4;
  const R = 99.5;
  const asOf = now || new Date();

  const rows = parts
    .filter((p) => p.status !== "found" && p.status !== "paid")
    .map((p) => ({
      name: p.partName || p.partNumber || "—",
      set: p.loanerSetName || "—",
      rep: p.repName || "—",
      days: daysOpen(p),
      fine: Number(p.fineAmount) || 0,
    }))
    .sort((a, b) => b.fine - a.fine || b.days - a.days);

  const detail = [...rows].sort((a, b) => b.days - a.days || b.fine - a.fine);

  const total = rows.length;
  const fines = rows.reduce((a, r) => a + r.fine, 0);
  const sets = new Set(rows.map((r) => r.set)).size;
  const oldest = rows.reduce((a, r) => Math.max(a, r.days), 0);
  const under30 = rows.filter((r) => r.days <= 30).length;
  const mid = rows.filter((r) => r.days > 30 && r.days <= 60).length;
  const over60 = rows.filter((r) => r.days > 60).length;

  const monday = mondayOf(asOf);
  const prev = previousWeek(snapshots, dayKey(monday));
  const diff = prev ? fines - prev.fines : null;

  const text = (t, x, y, { size = 8, bold = false, color = INK, align = "left" } = {}) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(String(t), x, y, { align });
  };

  const title = (t, sub) => {
    text("RELAY / MISSING PARTS", L, 10.6, { size: 8, bold: true, color: PURPLE });
    text(t, L, 20.2, { size: 18.5, bold: true });
    text(sub, L, 25, { size: 7.2, color: MUTED });
  };

  // ---------- Page 1 ----------
  title(
    "Missing parts exposure",
    `Week of ${md(monday)}, ${monday.getFullYear()} | Data as of ${asOf.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })}`
  );

  text("CURRENT FINES AT RISK", L, 32.8, { size: 7.2, bold: true, color: MUTED });
  text(money(fines), L, 47.5, { size: 36, bold: true, color: fines > 0 ? RED : INK });
  if (diff != null) {
    const up = diff > 0;
    text(`${up ? "+" : diff < 0 ? "-" : ""}${money(Math.abs(diff))} vs. week of ${md(prev.monday)}`, L, 53.4, {
      size: 8.2,
      bold: true,
      color: up ? RED : GREEN,
    });
  }
  text(`Target: $0 | ${total} parts open`, L, 58.2, { size: 7.4, color: MUTED });

  doc.setFillColor(243, 244, 248);
  doc.rect(L, 63.9, R - L, 15.9, "F");
  [
    ["OPEN PARTS", String(total), INK, 8.7],
    ["SETS AFFECTED", String(sets), INK, 39.3],
    ["OLDEST", `${oldest}d`, oldest > 60 ? RED : INK, 70],
  ].forEach(([label, value, color, x]) => {
    text(label, x, 68.1, { size: 6.6, bold: true, color: MUTED });
    text(value, x, 77.3, { size: 14.5, bold: true, color });
  });

  text("Aging", L, 88, { size: 12, bold: true });
  const barX = 5.8;
  const barW = 92;
  const denom = Math.max(under30 + mid + over60, 1);
  let bx = barX;
  [
    [under30, GREEN],
    [mid, AMBER],
    [over60, RED],
  ].forEach(([count, color]) => {
    const w = (count / denom) * barW;
    if (w > 0) {
      doc.setFillColor(...color);
      doc.rect(bx, 91, w, 2.1, "F");
    }
    bx += w;
  });
  text(`${under30} under 30d`, 8.7, 97.2, { size: 6.6, bold: true, color: GREEN });
  text(`${mid} 30–60d`, barX + (under30 / denom) * barW + 2.5, 97.2, { size: 6.6, bold: true, color: AMBER });
  text(`${over60} 60d+`, barX + ((under30 + mid) / denom) * barW + 4, 97.2, { size: 6.6, bold: true, color: RED });

  text("Top 5 exposures", L, 108.1, { size: 12, bold: true });
  text("Ranked by fine at risk.", L, 111.7, { size: 6.8, color: MUTED });

  const cols = { name: 8.7, days: 54.2, rep: 68.1, fine: 84.3 };
  text("PART", cols.name, 117.9, { size: 6.2, bold: true, color: MUTED });
  text("DAYS", cols.days, 117.9, { size: 6.2, bold: true, color: MUTED });
  text("REP", cols.rep, 117.9, { size: 6.2, bold: true, color: MUTED });
  text("FINE", cols.fine, 117.9, { size: 6.2, bold: true, color: MUTED });
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.line(L, 120, R, 120);

  rows.slice(0, 5).forEach((r, i) => {
    const topY = 120 + i * 8.65;
    const base = topY + 5.6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    text(fit(doc, r.name, 42), cols.name, base, { size: 8.2, bold: true });
    text(String(r.days), cols.days, base, { size: 7.8, bold: true, color: RED });
    text(fit(doc, r.rep, 14), cols.rep, base, { size: 7.4 });
    text(money(r.fine), cols.fine, base, { size: 7.8, bold: true, color: PURPLE });
    doc.line(L, topY + 8.65, R, topY + 8.65);
  });

  text("Days = days since reported missing. Fine = deduction per part.", L, 167.9, { size: 5.8, color: MUTED });

  // ---------- Detail pages ----------
  const pitch = 4.13;
  const perPage = 42;
  const hx = { set: 42, days: 90.5, fine: 98.6 };

  for (let start = 0; start < detail.length; start += perPage) {
    doc.addPage();
    const chunk = detail.slice(start, start + perPage);
    const first = start === 0;
    title(
      first ? "Missing part detail" : "Missing part detail (cont.)",
      `${detail.length} parts open | Oldest first | ${asOf.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`
    );

    doc.setFillColor(...PURPLE);
    doc.rect(L, 30.1, R - L, 4.1, "F");
    text("PART", 8.2, 33.1, { size: 6.2, bold: true, color: [255, 255, 255] });
    text("SET", hx.set, 33.1, { size: 6.2, bold: true, color: [255, 255, 255] });
    text("DAYS", hx.days, 33.1, { size: 6.2, bold: true, color: [255, 255, 255], align: "right" });
    text("FINE", hx.fine, 33.1, { size: 6.2, bold: true, color: [255, 255, 255], align: "right" });

    chunk.forEach((r, i) => {
      const topY = 34.2 + i * pitch;
      const base = topY + pitch * 0.72;
      if (i % 2 === 1) {
        doc.setFillColor(245, 246, 250);
        doc.rect(L, topY, R - L, pitch, "F");
      }
      text(fit(doc, r.name, 32), 8.2, base, { size: 6.8 });
      text(fit(doc, r.set, 40), hx.set, base, { size: 6.6, color: MUTED });
      text(String(r.days), hx.days, base, {
        size: 6.8,
        bold: r.days > 60,
        color: r.days > 60 ? RED : INK,
        align: "right",
      });
      text(money(r.fine), hx.fine, base, { size: 6.8, align: "right" });
    });
  }

  // Footer on every page
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setDrawColor(...LINE);
    doc.setLineWidth(0.2);
    doc.line(5.8, 217.2, 97.8, 217.2);
    text("RELAY  /  INTERNAL TEAM REPORT", 5.8, 220, { size: 6, color: MUTED });
    text(`${p} / ${pages}`, 97.8, 220, { size: 6, color: MUTED, align: "right" });
  }

  return doc;
}

export default function ExportMissingPartsReport({ parts = [] }) {
  const [busy, setBusy] = useState(false);

  const { data: snapshots = [] } = useQuery({
    queryKey: ["missingPartImportSnapshots"],
    queryFn: async () => {
      const res = await base44.entities.MissingPartImportSnapshot.filter({}, { sort: "-importedAt", limit: 24 });
      return res?.items || [];
    },
  });

  const handleExport = () => {
    setBusy(true);
    try {
      const doc = buildReport({ parts, snapshots });
      doc.save(getFilename("Relay_Weekly_Missing_Parts_Report"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={busy || !parts.length}
      className="w-full bg-purple-600 hover:bg-purple-700 h-10"
    >
      {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
      Export Weekly Missing Parts Report
    </Button>
  );
}