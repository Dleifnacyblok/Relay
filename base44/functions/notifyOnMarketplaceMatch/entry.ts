import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const payload = await req.json();

    const item = payload.data;
    if (!item || !item.partNumber || item.status !== 'available') {
      return Response.json({ message: 'No action needed' });
    }

    // Find active LookForItem requests matching this part number
    const allLookForItems = await base44.asServiceRole.entities.LookForItem.filter({ status: 'active' });
    const matches = allLookForItems.filter(lfi =>
      lfi.partNumber && item.partNumber &&
      lfi.partNumber.trim().toLowerCase() === item.partNumber.trim().toLowerCase()
    );

    if (matches.length === 0) {
      return Response.json({ message: 'No matching look-for requests' });
    }

    // Get all users to match rep names to emails
    const allUsers = await base44.asServiceRole.entities.User.list();

    let notified = 0;
    for (const lfi of matches) {
      // Skip if the lister is the one looking (same repName)
      if (lfi.repName && item.repName && lfi.repName.toLowerCase() === item.repName.toLowerCase()) continue;

      // Create in-app notification
      await base44.asServiceRole.entities.Notification.create({
        repName: lfi.repName,
        type: 'marketplace_match',
        title: '🛒 Marketplace Match Found!',
        message: `${item.partName || item.partNumber} (Part #${item.partNumber}) is now available on the Marketplace.`,
        relatedMarketplaceItemId: item.id,
        isRead: false,
        severity: 'info',
      });

      // Send email if we can find the user's email
      const user = allUsers.find(u => u.full_name?.toLowerCase() === lfi.repName?.toLowerCase());
      if (user?.email) {
        await base44.asServiceRole.integrations.Core.SendEmail({
          to: user.email,
          subject: `Relay: Item you're looking for is available — ${item.partName || item.partNumber}`,
          body: `Hi ${lfi.repName},\n\nGreat news! A part you were looking for is now available on the Relay Marketplace:\n\nPart: ${item.partName || 'N/A'}\nPart #: ${item.partNumber}\n${item.repName ? `Listed by: ${item.repName}` : ''}\n\nOpen the Relay app to view the listing and reach out.\n\n— The Relay Team`,
        });
      }

      notified++;
    }

    return Response.json({ message: `Notified ${notified} rep(s)` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});