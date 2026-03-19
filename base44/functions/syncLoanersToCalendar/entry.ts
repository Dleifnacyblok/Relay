import { createClientFromRequest } from 'npm:@base44/sdk@0.8.21';

Deno.serve(async (req) => {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { accessToken } = await base44.asServiceRole.connectors.getConnection('googlecalendar');

    // Fetch loaners for this user that are not returned and have a due date
    const loaners = await base44.entities.Loaners.list();
    const upcoming = loaners.filter(l =>
        l.expectedReturnDate &&
        l.returnStatus !== 'received' &&
        (l.fieldSalesRep === user.full_name || l.associateSalesRep === user.full_name || l.repName === user.full_name)
    );

    const created = [];
    const failed = [];

    for (const loaner of upcoming) {
        const date = loaner.expectedReturnDate; // YYYY-MM-DD
        const title = `📦 Loaner Due: ${loaner.setName}`;
        const description = `Account: ${loaner.accountName}\nEtch ID: ${loaner.etchId}\nSet ID: ${loaner.setId || ''}\nRep: ${loaner.repName || ''}`;

        const event = {
            summary: title,
            description,
            start: { date },
            end: { date },
            reminders: {
                useDefault: false,
                overrides: [
                    { method: 'popup', minutes: 1440 }, // 1 day before
                ],
            },
        };

        const res = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary/events', {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${accessToken}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(event),
        });

        if (res.ok) {
            created.push(loaner.setName);
        } else {
            const err = await res.json();
            failed.push({ set: loaner.setName, error: err?.error?.message });
        }
    }

    return Response.json({ created: created.length, failed: failed.length, details: { created, failed } });
});