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

const rateOf = (snap) => {
  const total = Number(snap.totalRecords) || 0;
  if (!total) return null;
  return ((total - (Number(snap.totalOverdue) || 0)) / total) * 100;
};

const rateColor = (v) => (v == null ? MUTED : v >= 90 ? GREEN : v >= 75 ? AMBER : RED);

// Latest on-time rate of the most recent week before the current one
const previousWeek = (snapshots = [], currentKey) => {
  const byWeek = new Map();
  snapshots.forEach((s) => {
    const at = new Date(s.importedAt || 0);
    if (isNaN(at)) return;
    const monday = mondayOf(at);
    const key = dayKey(monday);
    const prev = byWeek.get(key);
    if (!prev || at > prev.at) byWeek.set(key, { key, at, monday, rate: rateOf(s) });
  });
  return [...byWeek.values()]
    .filter((w) => w.key < currentKey && w.rate != null)
    .sort((a, b) => b.key.localeCompare(a.key))[0];
};

const fit = (doc, text, maxW) => {
  let s = String(text ?? "");
  if (doc.getTextWidth(s) <= maxW) return s;
  while (s.length > 1 && doc.getTextWidth(s + "…") > maxW) s = s.slice(0, -1);
  return s + "…";
};

const daysOver = (l) => {
  if (l.daysOverdue != null && l.daysOverdue > 0) return Math.round(l.daysOverdue);
  if (l.isOverdue && l.daysUntilDue != null) return Math.abs(Math.round(l.daysUntilDue));
  if (!l.expectedReturnDate) return 0;
  const due = new Date(l.expectedReturnDate);
  if (isNaN(due)) return 0;
  const today = new Date();
  const diff = Math.floor((today - due) / 86400000);
  return diff > 0 ? diff : 0;
};

function buildReport({ loaners, snapshots, now }) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [105, 221] });
  const L = 7.4;
  const R = 99.5;
  const asOf = now || new Date();

  const active = loaners.filter((l) => l.returnStatus !== "received");
  const rows = active
    .map((l) => ({
      name: l.setName || "—",
      account: l.accountName || "—",
      rep: l.repName || l.associateSalesRep || l.fieldSalesRep || "—",
      days: daysOver(l),
      fine: Number(l.fineAmount) || 0,
      overdue: !!l.isOverdue || daysOver(l) > 0,
      dueSoon: !l.isOverdue && l.daysUntilDue != null && l.daysUntilDue >= 0 && l.daysUntilDue <= 7,
    }))
    .sort((a, b) => b.days - a.days || b.fine - a.fine);

  const total = rows.length;
  const overdue = rows.filter((r) => r.overdue).length;
  const dueSoon = rows.filter((r) => r.dueSoon).length;
  const onTrack = Math.max(total - overdue - dueSoon, 0);
  const fines = rows.reduce((a, r) => a + r.fine, 0);
  const onTime = total > 0 ? ((total - overdue) / total) * 100 : null;

  const monday = mondayOf(asOf);
  const prev = previousWeek(snapshots, dayKey(monday));
  const diff = prev && onTime != null ? onTime - prev.rate : null;

  const text = (t, x, y, { size = 8, bold = false, color = INK, align = "left" } = {}) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(size);
    doc.setTextColor(...color);
    doc.text(String(t), x, y, { align });
  };

  const title = (t, sub) => {
    text("RELAY / LOANERS", L, 10.6, { size: 8, bold: true, color: PURPLE });
    text(t, L, 20.2, { size: 18.5, bold: true });
    text(sub, L, 25, { size: 7.2, color: MUTED });
  };

  // ---------- Page 1 ----------
  title(
    "Loaner exposure",
    `Week of ${md(monday)}, ${monday.getFullYear()} | Data as of ${asOf.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })}`
  );

  text("CURRENT ON-TIME RATE", L, 32.8, { size: 7.2, bold: true, color: MUTED });
  text(onTime != null ? `${onTime.toFixed(1)}%` : "—", L, 47.5, {
    size: 40,
    bold: true,
    color: rateColor(onTime),
  });
  if (diff != null) {
    text(
      `${diff >= 0 ? "+" : ""}${diff.toFixed(1)} percentage points vs. week of ${md(prev.monday)}`,
      L,
      53.4,
      { size: 8.2, bold: true, color: diff >= 0 ? GREEN : RED }
    );
  }
  text(`Target: 100% | ${total} loaners in territory`, L, 58.2, { size: 7.4, color: MUTED });

  doc.setFillColor(243, 244, 248);
  doc.rect(L, 63.9, R - L, 15.9, "F");
  [
    ["ACTIVE LOANERS", String(total), INK, 8.7],
    ["OVERDUE", String(overdue), overdue > 0 ? RED : INK, 39.3],
    ["FINES AT RISK", money(fines), fines > 0 ? RED : INK, 66],
  ].forEach(([label, value, color, x]) => {
    text(label, x, 68.1, { size: 6.6, bold: true, color: MUTED });
    text(value, x, 77.3, { size: 14.5, bold: true, color });
  });

  text("Portfolio health", L, 88, { size: 12, bold: true });
  const barX = 5.8;
  const barW = 92;
  const denom = Math.max(onTrack + dueSoon + overdue, 1);
  let bx = barX;
  [
    [onTrack, GREEN],
    [dueSoon, AMBER],
    [overdue, RED],
  ].forEach(([count, color]) => {
    const w = (count / denom) * barW;
    if (w > 0) {
      doc.setFillColor(...color);
      doc.rect(bx, 91, w, 2.1, "F");
    }
    bx += w;
  });
  text(`${onTrack} on track`, 8.7, 97.2, { size: 6.6, bold: true, color: GREEN });
  text(`${dueSoon} due in 7 days`, barX + (onTrack / denom) * barW + 2.5, 97.2, {
    size: 6.6,
    bold: true,
    color: AMBER,
  });
  text(`${overdue} overdue`, barX + ((onTrack + dueSoon) / denom) * barW + 4, 97.2, {
    size: 6.6,
    bold: true,
    color: RED,
  });

  text("Top 5 exposures", L, 108.1, { size: 12, bold: true });
  text("Ranked by fine at risk at $50/day.", L, 111.7, { size: 6.8, color: MUTED });

  const top = [...rows].sort((a, b) => b.fine - a.fine).slice(0, 5);
  const cols = { name: 8.7, days: 54.2, rep: 68.1, fine: 84.3 };
  text("LOANER", cols.name, 117.9, { size: 6.2, bold: true, color: MUTED });
  text("DAYS", cols.days, 117.9, { size: 6.2, bold: true, color: MUTED });
  text("REP", cols.rep, 117.9, { size: 6.2, bold: true, color: MUTED });
  text("FINE", cols.fine, 117.9, { size: 6.2, bold: true, color: MUTED });
  doc.setDrawColor(...LINE);
  doc.setLineWidth(0.2);
  doc.line(L, 120, R, 120);

  top.forEach((r, i) => {
    const topY = 120 + i * 8.65;
    const base = topY + 5.6;
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.2);
    text(fit(doc, r.name, 42), cols.name, base, { size: 8.2, bold: true });
    text(r.days > 0 ? String(r.days) : "—", cols.days, base, { size: 7.8, bold: true, color: RED });
    text(fit(doc, r.rep, 14), cols.rep, base, { size: 7.4 });
    text(money(r.fine), cols.fine, base, { size: 7.8, bold: true, color: PURPLE });
    doc.line(L, topY + 8.65, R, topY + 8.65);
  });

  text("Days = days past expected return. Fine = $50 per day overdue.", L, 167.9, { size: 5.8, color: MUTED });

  // ---------- Detail pages ----------
  const pitch = 4.13;
  const perPage = 42;
  const hx = { acct: 44, days: 90.5, fine: 98.6 };

  for (let start = 0; start < rows.length; start += perPage) {
    doc.addPage();
    const chunk = rows.slice(start, start + perPage);
    const first = start === 0;
    title(
      first ? "Loaner detail" : "Loaner detail (cont.)",
      `${rows.length} loaners | Most overdue first | ${asOf.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })}`
    );

    doc.setFillColor(...PURPLE);
    doc.rect(L, 30.1, R - L, 4.1, "F");
    text("LOANER", 8.2, 33.1, { size: 6.2, bold: true, color: [255, 255, 255] });
    text("ACCT", hx.acct, 33.1, { size: 6.2, bold: true, color: [255, 255, 255] });
    text("DAYS", hx.days, 33.1, { size: 6.2, bold: true, color: [255, 255, 255], align: "right" });
    text("FINE", hx.fine, 33.1, { size: 6.2, bold: true, color: [255, 255, 255], align: "right" });

    chunk.forEach((r, i) => {
      const topY = 34.2 + i * pitch;
      const base = topY + pitch * 0.72;
      if (i % 2 === 1) {
        doc.setFillColor(245, 246, 250);
        doc.rect(L, topY, R - L, pitch, "F");
      }
      text(fit(doc, r.name, 33), 8.2, base, { size: 6.8 });
      text(fit(doc, r.account, 42), hx.acct, base, { size: 6.6, color: MUTED });
      text(r.days > 0 ? String(r.days) : "—", hx.days, base, {
        size: 6.8,
        bold: r.days > 0,
        color: r.days > 0 ? RED : INK,
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

export default function ExportLoanersPDF({ loaners = [] }) {
  const [busy, setBusy] = useState(false);

  const { data: snapshots = [] } = useQuery({
    queryKey: ["loanerImportSnapshots"],
    queryFn: async () => {
      const res = await base44.entities.LoanerImportSnapshot.filter({}, { sort: "-importedAt", limit: 24 });
      return res?.items || [];
    },
  });

  const handleExport = () => {
    setBusy(true);
    try {
      const doc = buildReport({ loaners, snapshots });
      doc.save(getFilename("Relay_Weekly_Loaner_Report"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Button
      onClick={handleExport}
      disabled={busy || !loaners.length}
      className="w-full bg-purple-600 hover:bg-purple-700 h-10"
    >
      {busy ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <FileDown className="w-4 h-4 mr-2" />}
      Export Weekly Loaner Report
    </Button>
  );
}