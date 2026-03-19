import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
  const base44 = createClientFromRequest(req);

  let allLoaners;
  try {
    allLoaners = await base44.asServiceRole.entities.Loaners.list('-expectedReturnDate', 500);
  } catch(e) {
    console.error('Failed to fetch loaners:', e.message);
    return Response.json({ error: e.message }, { status: 500 });
  }

  const today = new Date();
  const dateStr = today.toLocaleDateString("en-US", {
    weekday: "long", month: "long", day: "numeric", year: "numeric"
  });

  const overdue = allLoaners.filter(l => l.isOverdue);
  const dueSoon = allLoaners.filter(l => {
    if (l.isOverdue) return false;
    if (!l.expectedReturnDate) return false;
    const daysUntil = Math.ceil((new Date(l.expectedReturnDate) - today) / (1000 * 60 * 60 * 24));
    return daysUntil >= 0 && daysUntil <= 7;
  });
  const totalFines = overdue.reduce((sum, l) => sum + (l.fineAmount || 0), 0);

  const byRep = {};
  allLoaners.forEach(l => {
    const rep = l.repName || l.fieldSalesRep || l.associateSalesRep;
    if (!rep || rep === 'None') return;
    if (!byRep[rep]) byRep[rep] = { overdue: [], dueSoon: [], safe: [] };
    if (l.isOverdue) byRep[rep].overdue.push(l);
    else if (dueSoon.includes(l)) byRep[rep].dueSoon.push(l);
    else byRep[rep].safe.push(l);
  });

  const repRows = Object.entries(byRep)
    .sort((a, b) => b[1].overdue.length - a[1].overdue.length)
    .map(([rep, data]) => {
      const repFines = data.overdue.reduce((sum, l) => sum + (l.fineAmount || 0), 0);
      return `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 10px 12px; font-weight: 600; color: #111;">${rep}</td>
          <td style="padding: 10px 12px; text-align: center; color: ${data.overdue.length > 0 ? '#dc2626' : '#6b7280'}; font-weight: ${data.overdue.length > 0 ? '700' : '400'};">
            ${data.overdue.length}
          </td>
          <td style="padding: 10px 12px; text-align: center; color: ${data.dueSoon.length > 0 ? '#d97706' : '#6b7280'};">
            ${data.dueSoon.length}
          </td>
          <td style="padding: 10px 12px; text-align: center; color: #6b7280;">
            ${data.safe.length}
          </td>
          <td style="padding: 10px 12px; text-align: right; font-weight: 700; color: ${repFines > 0 ? '#dc2626' : '#6b7280'};">
            ${repFines > 0 ? '$' + repFines.toLocaleString() : '—'}
          </td>
        </tr>
      `;
    }).join("");

  const overdueDetail = overdue
    .sort((a, b) => (b.fineAmount || 0) - (a.fineAmount || 0))
    .slice(0, 20)
    .map(l => `
      <tr style="border-bottom: 1px solid #fecaca;">
        <td style="padding: 8px 12px; font-size: 13px; color: #111;">${l.setName || "—"}</td>
        <td style="padding: 8px 12px; font-size: 13px; color: #6b7280;">${l.repName || l.fieldSalesRep || "—"}</td>
        <td style="padding: 8px 12px; font-size: 13px; color: #6b7280;">${l.accountName ? l.accountName.substring(0, 25) : "—"}</td>
        <td style="padding: 8px 12px; font-size: 13px; color: #6b7280;">${l.expectedReturnDate ? new Date(l.expectedReturnDate).toLocaleDateString() : "—"}</td>
        <td style="padding: 8px 12px; font-size: 13px; font-weight: 700; color: #dc2626; text-align: right;">
          $${(l.fineAmount || 0).toLocaleString()}
        </td>
      </tr>
    `).join("");

  const htmlBody = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 700px; margin: 0 auto; background: #f9fafb; padding: 24px;">
      <div style="background: #111827; border-radius: 12px; padding: 24px; margin-bottom: 20px; text-align: center;">
        <h1 style="color: white; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.5px;">📡 Relay Daily Report</h1>
        <p style="color: #9ca3af; margin: 6px 0 0; font-size: 14px;">${dateStr}</p>
      </div>
      <div style="display: flex; gap: 12px; margin-bottom: 20px;">
        <div style="flex: 1; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 16px; text-align: center;">
          <div style="font-size: 32px; font-weight: 800; color: #dc2626;">${overdue.length}</div>
          <div style="font-size: 12px; color: #ef4444; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Overdue</div>
        </div>
        <div style="flex: 1; background: #fffbeb; border: 1px solid #fde68a; border-radius: 10px; padding: 16px; text-align: center;">
          <div style="font-size: 32px; font-weight: 800; color: #d97706;">${dueSoon.length}</div>
          <div style="font-size: 12px; color: #f59e0b; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Due Soon</div>
        </div>
        <div style="flex: 1; background: #fef2f2; border: 1px solid #fecaca; border-radius: 10px; padding: 16px; text-align: center;">
          <div style="font-size: 28px; font-weight: 800; color: #dc2626;">$${totalFines >= 1000 ? (totalFines/1000).toFixed(0)+'k' : totalFines.toLocaleString()}</div>
          <div style="font-size: 12px; color: #ef4444; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Total Fines</div>
        </div>
      </div>
      <div style="background: white; border-radius: 10px; border: 1px solid #e5e7eb; overflow: hidden; margin-bottom: 20px;">
        <div style="padding: 16px 16px 12px; border-bottom: 1px solid #e5e7eb;">
          <h2 style="margin: 0; font-size: 16px; font-weight: 700; color: #111;">Rep Summary</h2>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #f9fafb;">
              <th style="padding: 10px 12px; text-align: left; font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Rep</th>
              <th style="padding: 10px 12px; text-align: center; font-size: 12px; color: #dc2626; font-weight: 600; text-transform: uppercase;">Overdue</th>
              <th style="padding: 10px 12px; text-align: center; font-size: 12px; color: #d97706; font-weight: 600; text-transform: uppercase;">Due Soon</th>
              <th style="padding: 10px 12px; text-align: center; font-size: 12px; color: #6b7280; font-weight: 600; text-transform: uppercase;">Safe</th>
              <th style="padding: 10px 12px; text-align: right; font-size: 12px; color: #dc2626; font-weight: 600; text-transform: uppercase;">Fines</th>
            </tr>
          </thead>
          <tbody>${repRows}</tbody>
        </table>
      </div>
      <div style="background: white; border-radius: 10px; border: 1px solid #fecaca; overflow: hidden; margin-bottom: 20px;">
        <div style="padding: 16px 16px 12px; border-bottom: 1px solid #fecaca; background: #fef2f2;">
          <h2 style="margin: 0; font-size: 16px; font-weight: 700; color: #dc2626;">🚨 Top Overdue Sets (by fine amount)</h2>
        </div>
        <table style="width: 100%; border-collapse: collapse;">
          <thead>
            <tr style="background: #fff5f5;">
              <th style="padding: 8px 12px; text-align: left; font-size: 11px; color: #9ca3af; font-weight: 600; text-transform: uppercase;">Set Name</th>
              <th style="padding: 8px 12px; text-align: left; font-size: 11px; color: #9ca3af; font-weight: 600; text-transform: uppercase;">Rep</th>
              <th style="padding: 8px 12px; text-align: left; font-size: 11px; color: #9ca3af; font-weight: 600; text-transform: uppercase;">Account</th>
              <th style="padding: 8px 12px; text-align: left; font-size: 11px; color: #9ca3af; font-weight: 600; text-transform: uppercase;">Due Date</th>
              <th style="padding: 8px 12px; text-align: right; font-size: 11px; color: #9ca3af; font-weight: 600; text-transform: uppercase;">Fine</th>
            </tr>
          </thead>
          <tbody>${overdueDetail}</tbody>
        </table>
      </div>
      <div style="text-align: center; padding: 16px;">
        <a href="https://loaner-track-now.base44.app"
           style="display: inline-block; background: #111827; color: white; padding: 12px 28px; border-radius: 8px; text-decoration: none; font-weight: 600; font-size: 14px;">
          Open Relay →
        </a>
        <p style="color: #9ca3af; font-size: 12px; margin-top: 12px;">
          Relay Loaner Operations · Auto-generated daily at 7:00 AM
        </p>
      </div>
    </div>
  `;

  await base44.asServiceRole.integrations.Core.SendEmail({
    to: "kcanfield@globusmedical.com",
    subject: `📡 Relay Daily Report — ${overdue.length} Overdue · $${totalFines.toLocaleString()} in Fines · ${dateStr}`,
    body: htmlBody,
  });

  return Response.json({
    success: true,
    overdueCount: overdue.length,
    totalFines,
    repsReported: Object.keys(byRep).length
  });
});