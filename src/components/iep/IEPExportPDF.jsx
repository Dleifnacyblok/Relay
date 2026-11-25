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

const int = (v) => {
  const n = typeof v === "number" ? v : parseFloat(v);
  return isNaN(n) ? "—" : String(Math.round(n));
};

const INK = [15, 23, 42];
const MUTED = [100, 116, 139];
const VIOLET = [91, 33, 182];
const BLUE = [37, 99, 235];

const effColor = (eff) => {
  if (eff == null) return [100, 116, 139];
  if (eff >= 100) return [21, 128, 61];
  if (eff >= 70) return [180, 83, 9];
  return [190, 18, 60];
};

const effTint = (eff) => {
  if (eff == null) return [248, 250, 252];
  if (eff >= 100) return [240, 253, 244];
  if (eff >= 70) return [255, 251, 235];
  return [254, 242, 242];
};

const fit = (doc, text, maxW) => {
  const s = String(text ?? "");
  if (doc.getTextWidth(s) <= maxW) return s;
  let out = s;
  while (out.length > 1 && doc.getTextWidth(out + "…") > maxW) out = out.slice(0, -1);
  return out + "…";
};

function buildReport({ systems, avgEffPct, avgEffPctProj, lastImport, territory }) {
  // Phone-shaped page (105 x 200 mm) so the report fills a phone screen
  // without zooming when it is opened from a message.
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: [105, 200] });
  const PW = doc.internal.pageSize.getWidth();
  const PH = doc.internal.pageSize.getHeight();
  const m = 7;
  const contentW = PW - m * 2;

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

  const sectionHeader = (title, top) => {
    doc.setFillColor(245, 243, 255);
    doc.roundedRect(m, top, contentW, 9.5, 2, 2, "F");
    doc.setFillColor(139, 92, 246);
    doc.roundedRect(m, top, 2.2, 9.5, 1.1, 1.1, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(...VIOLET);
    doc.text(title, m + 6, top + 6.4);
    return top + 12;
  };

  const hairline = (top) => {
    doc.setDrawColor(241, 245, 249);
    doc.setLineWidth(0.2);
    doc.line(m, top, PW - m, top);
  };

  // ---- Header band ----
  doc.setFillColor(...VIOLET);
  doc.rect(0, 0, PW, 40, "F");
  doc.setFillColor(139, 92, 246);
  doc.rect(0, 40, PW, 2.2, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.setTextColor(196, 181, 253);
  doc.text("RELAY  ·  IEP EFFICIENCY", m, 12);

  doc.setFontSize(17);
  doc.setTextColor(255, 255, 255);
  doc.text("Efficiency Report", m, 23);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.8);
  doc.setTextColor(221, 214, 254);
  doc.text(`${rows.length} systems tracked`, m, 30.5);
  const stamp = lastImport
    ? `Data as of ${lastImport.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })}`
    : `Generated ${getNow()}`;
  doc.text(fit(doc, stamp, contentW), m, 36);

  // ---- Score tiles ----
  const tileY = 46;
  const tileH = 25;
  const tileW = (contentW - 4) / 2;
  [
    {
      x: m,
      label: "CURRENT SCORE",
      value: overall != null ? `${overall.toFixed(1)}%` : "—",
      sub: "all systems",
      fill: effColor(overall),
    },
    {
      x: m + tileW + 4,
      label: "PROJECTED",
      value: avgEffPctProj != null ? `${avgEffPctProj.toFixed(1)}%` : "—",
      sub: "end of period",
      fill: BLUE,
    },
  ].forEach((t) => {
    doc.setFillColor(...t.fill);
    doc.roundedRect(t.x, tileY, tileW, tileH, 3, 3, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.2);
    doc.setTextColor(255, 255, 255);
    doc.text(t.label, t.x + tileW / 2, tileY + 7.5, { align: "center" });
    doc.setFontSize(18);
    doc.text(t.value, t.x + tileW / 2, tileY + 17.5, { align: "center" });
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.2);
    doc.text(t.sub, t.x + tileW / 2, tileY + 22.5, { align: "center" });
  });

  // ---- Stat strip ----
  const statY = tileY + tileH + 5;
  const statGap = 2.5;
  const statW = (contentW - statGap * 3) / 4;
  const statH = 14;
  [
    { label: "EXPECTED", value: n1(totalUsage) },
    { label: "DONE", value: n1(totalProc) },
    { label: "100%+", value: int(above), suffix: "sys" },
    { label: "UNDER 70%", value: int(below), suffix: "sys" },
  ].forEach((s, i) => {
    const x = m + i * (statW + statGap);
    doc.setFillColor(241, 245, 249);
    doc.roundedRect(x, statY, statW, statH, 2, 2, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.6);
    doc.setTextColor(...MUTED);
    doc.text(s.label, x + 2.5, statY + 4.8);
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(...INK);
    const vw = doc.getTextWidth(s.value);
    doc.text(s.value, x + 2.5, statY + 11.2);
    if (s.suffix) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.6);
      doc.setTextColor(...MUTED);
      doc.text(s.suffix, x + 2.5 + vw + 1, statY + 11.2);
    }
  });

  // ---- Color legend ----
  const legendY = statY + statH + 4.5;
  [
    { c: effColor(100), t: "on target" },
    { c: effColor(80), t: "70-99%" },
    { c: effColor(50), t: "under 70%" },
  ].forEach((l, i) => {
    const x = m + i * (contentW / 3);
    doc.setFillColor(...l.c);
    doc.roundedRect(x, legendY - 2.2, 2.4, 2.4, 0.6, 0.6, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.4);
    doc.setTextColor(...MUTED);
    doc.text(l.t, x + 4, legendY);
  });

  let y = legendY + 4;

  if (territory && territory.total) {
    doc.setFillColor(239, 246, 255);
    doc.roundedRect(m, y, contentW, 9, 2, 2, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6.8);
    doc.setTextColor(29, 78, 216);
    doc.text(
      fit(
        doc,
        `${territory.total} sets in territory  ·  ${territory.overdue} overdue  ·  ${territory.dueSoon} due soon`,
        contentW - 8
      ),
      m + 4,
      y + 6
    );
    y += 13;
  }

  // ---- Where to Improve ----
  y = sectionHeader("Where to Improve", y);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  doc.setTextColor(...MUTED);
  doc.text("Ranked by points each system can add at 100%.", m + 1, y);
  y += 6;

  if (!opportunities.length) {
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text("Every system is at or above its expected usage.", m + 1, y + 2);
    y += 10;
  } else {
    opportunities.slice(0, 5).forEach((r, i) => {
      if (y + 11 > PH - 9) {
        doc.addPage();
        y = 16;
      }
      const col = effColor(r.eff);

      doc.setFillColor(...col);
      doc.circle(m + 3.2, y + 4, 3.2, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text(String(i + 1), m + 3.2, y + 5.6, { align: "center" });

      doc.setFontSize(9.5);
      doc.setTextColor(...INK);
      doc.text(fit(doc, r.name, contentW - 9 - 22), m + 8.5, y + 5.5);

      doc.setFontSize(8.5);
      doc.setTextColor(...col);
      doc.text(`+${r.pts.toFixed(1)} pts`, PW - m, y + 5.5, { align: "right" });

      doc.setFont("helvetica", "normal");
      doc.setFontSize(6.8);
      doc.setTextColor(...MUTED);
      doc.text(
        fit(
          doc,
          `${n1(r.gap)} procedures below expected  ·  ${r.eff != null ? `${r.eff.toFixed(1)}%` : "—"} now`,
          contentW - 9
        ),
        m + 8.5,
        y + 9.6
      );

      hairline(y + 11);
      y += 11.5;
    });
    y += 2;
  }

  // ---- System cards ----
  if (y + 30 > PH - 14) {
    doc.addPage();
    y = 16;
  }
  y = sectionHeader("Set Usage & Efficiency", y);

  const cardH = 27;
  const tableRows = [...rows].sort((a, b) => (b.usage || 0) - (a.usage || 0));

  tableRows.forEach((r) => {
    if (y + cardH > PH - 13) {
      doc.addPage();
      y = 16;
      y = sectionHeader("Set Usage & Efficiency (cont.)", y);
    }

    const col = effColor(r.eff);
    doc.setFillColor(...effTint(r.eff));
    doc.roundedRect(m, y, contentW, cardH, 2.5, 2.5, "F");
    doc.setFillColor(...col);
    doc.roundedRect(m, y, 2.4, cardH, 1.2, 1.2, "F");

    // name + efficiency badge
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(...INK);
    doc.text(fit(doc, r.name, contentW - 7 - 25), m + 6, y + 7);

    const badgeW = 20;
    const badgeH = 7.5;
    const badgeX = PW - m - 2.5 - badgeW;
    const badgeY = y + 2.8;
    doc.setFillColor(...col);
    doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 1.8, 1.8, "F");
    doc.setFontSize(8.5);
    doc.setTextColor(255, 255, 255);
    doc.text(
      r.eff != null ? `${r.eff.toFixed(1)}%` : "—",
      badgeX + badgeW / 2,
      badgeY + 5.3,
      { align: "center" }
    );

    // efficiency bar
    const barX = m + 6;
    const barW = contentW - 6 - 3.5;
    const barY = y + 11.5;
    const barH = 2.2;
    doc.setFillColor(255, 255, 255);
    doc.roundedRect(barX, barY, barW, barH, 1.1, 1.1, "F");
    const pct = r.eff == null ? 0 : Math.max(0, Math.min(1, r.eff / 100));
    if (pct > 0) {
      doc.setFillColor(...col);
      doc.roundedRect(barX, barY, Math.max(1.6, barW * pct), barH, 1.1, 1.1, "F");
    }

    // stat columns
    const cols = [
      ["SETS", r.sets != null ? int(r.sets) : "—"],
      ["EXPECTED", n1(r.usage)],
      ["DONE", n1(r.proc)],
      ["PROJ", r.effProj != null ? `${r.effProj.toFixed(1)}%` : "—"],
    ];
    const colW = (contentW - 9.5) / 4;
    cols.forEach(([label, value], i) => {
      const x = m + 6 + i * colW;
      doc.setFont("helvetica", "normal");
      doc.setFontSize(5.8);
      doc.setTextColor(...MUTED);
      doc.text(label, x, y + 17.6);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.2);
      doc.setTextColor(...INK);
      doc.text(value, x, y + 23.2);
    });

    y += cardH + 2.5;
  });

  // ---- Footers ----
  const pages = doc.internal.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFillColor(...VIOLET);
    doc.rect(0, PH - 9, PW, 9, "F");
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.8);
    doc.setTextColor(221, 214, 254);
    doc.text("Relay  ·  IEP Efficiency Report", m, PH - 3.4);
    doc.text(`${p} / ${pages}`, PW - m, PH - 3.4, { align: "right" });
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