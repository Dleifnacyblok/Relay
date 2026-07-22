import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const part = payload.data;

    if (!part) {
      return Response.json({ message: 'No part data, skipping' });
    }

    const partName = part.partName || 'Unknown Part';
    const partNumber = part.partNumber || 'N/A';
    const repName = part.repName || 'Unknown Rep';
    const loanerSetName = part.loanerSetName || 'N/A';
    const missingDate = part.missingDate || 'N/A';
    const quantity = part.missingQuantity || 1;

    // Create an in-app notification for the rep
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