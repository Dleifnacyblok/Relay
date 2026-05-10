import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const request = payload.data;
    const oldRequest = payload.old_data;

    if (!request || !request.status || request.status === oldRequest?.status) {
      return Response.json({ message: 'No status change, skipping' });
    }

    const statusLabels = {
      approved: 'Approved ✅',
      declined: 'Declined ❌',
      cancelled: 'Cancelled',
      pending: 'Pending',
    };

    const statusMessages = {
      approved: `Good news! Your request for loaner set has been approved. You can coordinate the transfer now.`,
      declined: `Your loaner request has been declined. You may submit a new request or reach out to the current holder.`,
      cancelled: `Your loaner request has been cancelled.`,
    };

    const label = statusLabels[request.status] || request.status;
    const bodyMessage = statusMessages[request.status] || `Your loaner request status changed to: ${request.status}`;

    // Create in-app notification for requester
    await base44.asServiceRole.entities.Notification.create({
      repName: request.requesterName,
      type: 'loaner_request_status',
      title: `Loaner Request ${label}`,
      message: `Your request for a loaner from ${request.currentHolderName} has been ${request.status}.`,
      relatedLoanerRequestId: request.id,
      relatedLoanerId: request.loanerId,
      isRead: false,
      severity: request.status === 'approved' ? 'info' : 'warning',
    });

    // Send email to requester
    const allUsers = await base44.asServiceRole.entities.User.list();
    const requesterUser = allUsers.find(u => u.full_name?.toLowerCase() === request.requesterName?.toLowerCase());

    if (requesterUser?.email) {
      await base44.asServiceRole.integrations.Core.SendEmail({
        to: requesterUser.email,
        subject: `Relay: Your loaner request was ${request.status}`,
        body: `Hi ${request.requesterName},\n\n${bodyMessage}\n\n${request.accountName ? `Account: ${request.accountName}` : ''}\nCurrent Holder: ${request.currentHolderName}\n\nOpen the Relay app to view the details.\n\n— The Relay Team`,
      });
    }

    return Response.json({ message: `Notification sent to ${request.requesterName}` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});