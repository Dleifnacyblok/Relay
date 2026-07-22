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

    const label = statusLabels[request.status] || request.status;

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

    return Response.json({ message: `Notification sent to ${request.requesterName}` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});