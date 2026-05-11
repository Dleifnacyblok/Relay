import { jsPDF } from "jspdf";

export function createDoc() {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  return { doc, pageWidth, margin };
}

export function addReportHeader(doc, { pageWidth, margin, title, subtitle, generated, total, totalFines, overdueCount, dueSoonCount, totalCount }) {
  doc.setFontSize(18);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(30, 41, 59);
  doc.text(title, margin, 20);

  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  if (subtitle) doc.text(subtitle, margin, 28);
  doc.text(`Generated: ${generated}  |  Total: ${total}`, margin, subtitle ? 34 : 28);

  let y = subtitle ? 42 : 36;

  // Summary stats row
  const hasStats = overdueCount != null || dueSoonCount != null || totalCount != null || totalFines > 0;
  if (hasStats) {
    // Draw stat boxes
    const stats = [];
    if (totalCount != null) stats.push({ label: "Total", value: String(totalCount), color: [30, 41, 59] });
    if (overdueCount != null) stats.push({ label: "Overdue", value: String(overdueCount), color: [220, 38, 38] });
    if (dueSoonCount != null) stats.push({ label: "Due Soon", value: String(dueSoonCount), color: [180, 83, 9] });
    if (totalFines > 0) stats.push({ label: "Total Fines", value: `$${totalFines.toLocaleString()}`, color: [220, 38, 38] });

    const boxW = (pageWidth - margin * 2 - (stats.length - 1) * 4) / stats.length;
    let bx = margin;
    for (const stat of stats) {
      doc.setFillColor(248, 250, 252);
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.roundedRect(bx, y, boxW, 14, 2, 2, 'FD');

      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(...stat.color);
      doc.text(stat.value, bx + boxW / 2, y + 7, { align: "center" });

      doc.setFontSize(7);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(100, 116, 139);
      doc.text(stat.label, bx + boxW / 2, y + 12, { align: "center" });

      bx += boxW + 4;
    }
    y += 20;
  }

  return y;
}

export function addFooters(doc, label = "Relay Loaner Manager") {
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 14;
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(148, 163, 184);
    doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, 290, { align: "center" });
    doc.text(label, margin, 290);
  }
}

export function drawLoanerRow(doc, { loaner, y, pageWidth, margin }) {
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text((loaner.setName || "Unknown Set").substring(0, 50), margin + 3, y);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  doc.text(`#${loaner.etchId || "N/A"}  |  ${loaner.accountName || ""}`, margin + 3, y + 4.5);
  if (loaner.repName || loaner.fieldSalesRep) {
    doc.text(`Rep: ${loaner.repName || loaner.fieldSalesRep}`, margin + 3, y + 9);
  }
  if (loaner.expectedReturnDate) {
    doc.text(`Due: ${loaner.expectedReturnDate}`, margin + 3, y + 13.5);
  }

  doc.setFont("helvetica", "bold");
  if (loaner.isOverdue) {
    doc.setTextColor(220, 38, 38);
    doc.text(`Overdue ${loaner.daysOverdue || 0}d`, pageWidth - margin, y, { align: "right" });
    if (loaner.fineAmount > 0) {
      doc.setFont("helvetica", "normal");
      doc.setTextColor(180, 83, 9);
      doc.text(`$${(loaner.fineAmount || 0).toLocaleString()}`, pageWidth - margin, y + 4.5, { align: "right" });
    }
  } else {
    doc.setTextColor(16, 185, 129);
    doc.text("Active", pageWidth - margin, y, { align: "right" });
  }

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(margin + 3, y + 17, pageWidth - margin, y + 17);

  return y + 22;
}

export function drawPartRow(doc, { part, y, pageWidth, margin }) {
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(15, 23, 42);
  doc.text((part.partName || "Unknown Part").substring(0, 50), margin + 3, y);

  doc.setFont("helvetica", "normal");
  doc.setTextColor(100, 116, 139);
  if (part.repName) doc.text(`Rep: ${part.repName}`, margin + 3, y + 4.5);

  const partLine = [`Part #: ${part.partNumber || "N/A"}`];
  if ((part.missingQuantity || 1) > 1) partLine.push(`Qty: ${part.missingQuantity}`);
  doc.text(partLine.join("  |  "), margin + 3, y + 9);

  const line3 = [];
  if (part.loanerSetName) line3.push(`Loaner: ${part.loanerSetName}`);
  if (part.etchId) line3.push(`Etch: ${part.etchId}`);
  if (line3.length) doc.text(line3.join("  |  "), margin + 3, y + 13.5);

  doc.setFont("helvetica", "bold");
  if (part.fineAmount > 0) {
    doc.setTextColor(220, 38, 38);
    doc.text(`$${(part.fineAmount || 0).toLocaleString()}`, pageWidth - margin, y, { align: "right" });
  }

  const qty = part.missingQuantity || 1;
  const statusColor = part.status === "missing" ? [220, 38, 38] : part.status === "found" ? [16, 185, 129] : [59, 130, 246];
  doc.setTextColor(...statusColor);
  const statusText = qty > 1 ? `${(part.status || "missing").toUpperCase()} (x${qty})` : (part.status || "missing").toUpperCase();
  doc.text(statusText, pageWidth - margin, y + 4.5, { align: "right" });

  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.line(margin + 3, y + 17, pageWidth - margin, y + 17);

  return y + 22;
}

export function checkPageBreak(doc, y, threshold = 270) {
  if (y > threshold) {
    doc.addPage();
    return 20;
  }
  return y;
}

export function getNow() {
  return new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

export function getFilename(prefix) {
  return `${prefix}-${new Date().toISOString().slice(0, 10)}.pdf`;
}