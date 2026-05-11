import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const part = payload.data;

    if (!part) {
      return Response.json({ message: 'No part data, skipping' });
    }

    // Get all admin users to notify
    const allUsers = await base44.asServiceRole.entities.User.list();
    const admins = allUsers.filter(u => u.role === 'admin' || u.role === 'manager');

    if (admins.length === 0) {
      return Response.json({ message: 'No admins found to notify' });
    }

    const partName = part.partName || 'Unknown Part';
    const partNumber = part.partNumber || 'N/A';
    const repName = part.repName || 'Unknown Rep';
    const loanerSetName = part.loanerSetName || 'N/A';
    const missingDate = part.missingDate || 'N/A';
    const fineAmount = part.fineAmount ? `$${part.fineAmount.toFixed(2)}` : '$0.00';
    const quantity = part.missingQuantity || 1;

    const subject = `⚠️ Relay Alert: Missing Part Flagged — ${partName}`;
    const body = `A missing part has been flagged in the Relay system.

Part Name: ${partName}
Part Number: ${partNumber}
Quantity Missing: ${quantity}
Loaner Set: ${loanerSetName}
Rep: ${repName}
Date Reported: ${missingDate}
Fine Amount: ${fineAmount}

Log in to Relay to view and manage this missing part.

— Relay Automated Alerts`;

    // Send email to all admins
    await Promise.all(admins.map(admin =>
      base44.asServiceRole.integrations.Core.SendEmail({
        to: admin.email,
        subject,
        body,
      })
    ));

    // Also create an in-app notification for the rep
    if (repName && repName !== 'Unknown Rep') {
      await base44.asServiceRole.entities.Notification.create({
        repName,
        type: 'missing_part',
        title: `Missing Part: ${partName}`,
        message: `${partName} (${partNumber}) from ${loanerSetName} has been flagged as missing. Fine: ${fineAmount}.`,
        relatedPartId: part.id,
        isRead: false,
        severity: 'warning',
      });
    }

    return Response.json({ message: `Missing part alert sent to ${admins.length} admin(s)` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});