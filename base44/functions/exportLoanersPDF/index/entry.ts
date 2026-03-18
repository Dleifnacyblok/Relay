import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';
import { jsPDF } from 'npm:jspdf@4.0.0';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const loaners = await base44.asServiceRole.entities.Loaners.list();

    // Group by repName
    const grouped = {};
    for (const l of loaners) {
      const rep = l.repName || 'Unknown';
      if (!grouped[rep]) grouped[rep] = [];
      grouped[rep].push(l);
    }

    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 14;
    const now = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    // Title
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(30, 41, 59);
    doc.text('Loaner Situation Report', margin, 20);

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100, 116, 139);
    doc.text(`Generated: ${now}`, margin, 28);
    doc.text(`Total Loaners: ${loaners.length}`, margin, 34);

    let y = 44;

    const repNames = Object.keys(grouped).sort();

    for (const rep of repNames) {
      const items = grouped[rep];
      const repFines = items.reduce((s, l) => s + (l.fineAmount || 0), 0);

      // Check if we need a new page
      if (y > 265) {
        doc.addPage();
        y = 20;
      }

      // Rep header bar
      doc.setFillColor(238, 242, 255);
      doc.roundedRect(margin, y, pageWidth - margin * 2, 9, 2, 2, 'F');
      doc.setFontSize(10);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(67, 56, 202);
      doc.text(rep, margin + 3, y + 6.5);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(100, 116, 139);
      doc.text(`${items.length} loaner${items.length !== 1 ? 's' : ''}`, pageWidth - margin - 55, y + 6.5);
      if (repFines > 0) {
        doc.setTextColor(180, 83, 9);
        doc.text(`Fines: $${repFines.toLocaleString()}`, pageWidth - margin - 28, y + 6.5, { align: 'right' });
      }

      y += 13;

      for (const l of items) {
        if (y > 270) {
          doc.addPage();
          y = 20;
        }

        const isOverdue = l.isOverdue;
        const statusColor = isOverdue ? [220, 38, 38] : [16, 185, 129];

        // Loaner row
        doc.setFontSize(9);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        const setName = (l.setName || 'Unknown Set').substring(0, 40);
        doc.text(setName, margin + 3, y);

        // Etch ID
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(100, 116, 139);
        doc.text(`#${l.etchId || 'N/A'}`, margin + 3, y + 4.5);

        // Account
        const account = (l.accountName || 'Unknown Account').substring(0, 35);
        doc.text(account, margin + 55, y);

        // Return date
        if (l.expectedReturnDate) {
          doc.text(`Due: ${l.expectedReturnDate}`, margin + 55, y + 4.5);
        }

        // Status / Fine
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(...statusColor);
        if (isOverdue) {
          doc.text(`Overdue ${l.daysOverdue || 0}d`, pageWidth - margin, y, { align: 'right' });
          if (l.fineAmount > 0) {
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(180, 83, 9);
            doc.text(`$${(l.fineAmount || 0).toLocaleString()}`, pageWidth - margin, y + 4.5, { align: 'right' });
          }
        } else {
          doc.text('Active', pageWidth - margin, y, { align: 'right' });
        }

        // Divider
        doc.setDrawColor(226, 232, 240);
        doc.setLineWidth(0.2);
        doc.line(margin + 3, y + 7, pageWidth - margin, y + 7);

        y += 11;
      }

      y += 4; // gap between reps
    }

    // Footer on each page
    const totalPages = doc.internal.getNumberOfPages();
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(148, 163, 184);
      doc.text(`Page ${i} of ${totalPages}`, pageWidth / 2, 290, { align: 'center' });
      doc.text('Relay Loaner Manager', margin, 290);
    }

    const pdfBytes = doc.output('arraybuffer');

    return new Response(pdfBytes, {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename=loaner-report-${new Date().toISOString().slice(0, 10)}.pdf`,
      },
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});