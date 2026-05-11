import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const loaner = payload.data;
    const oldLoaner = payload.old_data;

    // Only alert when isOverdue flips to true
    if (!loaner?.isOverdue || oldLoaner?.isOverdue === true) {
      return Response.json({ message: 'Not a new overdue transition, skipping' });
    }

    // Get all admin users to notify
    const allUsers = await base44.asServiceRole.entities.User.list();
    const admins = allUsers.filter(u => u.role === 'admin' || u.role === 'manager');

    if (admins.length === 0) {
      return Response.json({ message: 'No admins found to notify' });
    }

    const setName = loaner.setName || 'Unknown Set';
    const repName = loaner.repName || 'Unknown Rep';
    const accountName = loaner.accountName || 'Unknown Account';
    const etchId = loaner.etchId || 'N/A';
    const expectedReturnDate = loaner.expectedReturnDate || 'N/A';
    const daysOverdue = loaner.daysOverdue || 0;
    const fineAmount = loaner.fineAmount ? `$${loaner.fineAmount.toFixed(2)}` : '$0.00';

    const subject = `🚨 Relay Alert: Loaner Now Overdue — ${setName}`;
    const body = `A loaner has just become overdue in the Relay system.

Set Name: ${setName}
Etch ID: ${etchId}
Account: ${accountName}
Rep: ${repName}
Expected Return: ${expectedReturnDate}
Days Overdue: ${daysOverdue}
Current Fine: ${fineAmount}

Log in to Relay to take action.

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
        type: 'overdue',
        title: `Loaner Overdue: ${setName}`,
        message: `${setName} (${etchId}) at ${accountName} is now overdue by ${daysOverdue} day${daysOverdue !== 1 ? 's' : ''}. Fine: ${fineAmount}.`,
        relatedLoanerId: loaner.id,
        isRead: false,
        severity: 'critical',
      });
    }

    return Response.json({ message: `Overdue alert sent to ${admins.length} admin(s)` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});