import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);

    // Allow both scheduled (service role) and manual (admin) calls
    let isAdmin = false;
    try {
      const user = await base44.auth.me();
      isAdmin = user?.role === 'admin';
    } catch {
      // Called from automation without user context — proceed as service role
    }

    const loaners = await base44.asServiceRole.entities.Loaners.list();
    const settings = await base44.asServiceRole.entities.NotificationSettings.list();
    const existingNotifications = await base44.asServiceRole.entities.Notification.list();

    // Build a lookup of existing active notification ids to avoid duplicates
    const existingKeys = new Set(
      existingNotifications
        .filter(n => !n.isRead)
        .map(n => `${n.repName}::${n.type}::${n.relatedLoanerId}`)
    );

    const settingsByRep = {};
    settings.forEach(s => { settingsByRep[s.repName?.toLowerCase()] = s; });

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const toCreate = [];

    for (const loaner of loaners) {
      if (loaner.returnStatus === 'sent_back' || loaner.returnStatus === 'received') continue;

      const repName = loaner.repName;
      if (!repName) continue;

      const repSettings = settingsByRep[repName.toLowerCase()] || {
        notifyOverdue: true,
        notifyDueSoon: true,
        notifyFines: true,
        dueSoonThresholdDays: 7,
      };

      const expectedReturn = loaner.expectedReturnDate ? new Date(loaner.expectedReturnDate) : null;
      if (!expectedReturn) continue;

      expectedReturn.setHours(0, 0, 0, 0);
      const diffDays = Math.round((expectedReturn - today) / (1000 * 60 * 60 * 24));
      const isOverdue = diffDays < 0;
      const isDueSoon = !isOverdue && diffDays <= (repSettings.dueSoonThresholdDays ?? 7);

      // Overdue notification
      if (isOverdue && repSettings.notifyOverdue) {
        const key = `${repName}::overdue::${loaner.id}`;
        if (!existingKeys.has(key)) {
          toCreate.push({
            repName,
            type: 'overdue',
            severity: 'critical',
            title: 'Loaner Overdue',
            message: `${loaner.setName} is ${Math.abs(diffDays)} day(s) overdue. ${loaner.fineAmount > 0 ? `Fine: $${loaner.fineAmount}` : ''}`.trim(),
            relatedLoanerId: loaner.id,
            isRead: false,
          });
          existingKeys.add(key);
        }
      }

      // Due Soon notification
      if (isDueSoon && repSettings.notifyDueSoon) {
        const key = `${repName}::due_soon::${loaner.id}`;
        if (!existingKeys.has(key)) {
          toCreate.push({
            repName,
            type: 'due_soon',
            severity: 'warning',
            title: 'Loaner Due Soon',
            message: `${loaner.setName} is due in ${diffDays} day(s) on ${loaner.expectedReturnDate}.`,
            relatedLoanerId: loaner.id,
            isRead: false,
          });
          existingKeys.add(key);
        }
      }

      // Fine notification
      if (repSettings.notifyFines && loaner.fineAmount > 0 && !loaner.feesWaived) {
        const key = `${repName}::fines::${loaner.id}`;
        if (!existingKeys.has(key)) {
          toCreate.push({
            repName,
            type: 'overdue',
            severity: 'critical',
            title: 'Fine Incurred',
            message: `${loaner.setName} has a fine of $${loaner.fineAmount}.`,
            relatedLoanerId: loaner.id,
            isRead: false,
          });
          existingKeys.add(key);
        }
      }
    }

    // Bulk create notifications
    for (const n of toCreate) {
      await base44.asServiceRole.entities.Notification.create(n);
    }

    return Response.json({ created: toCreate.length, message: `Generated ${toCreate.length} new notifications` });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});