import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

async function graphRequest(accessToken, path, options = {}) {
  const res = await fetch(`https://graph.microsoft.com/v1.0${path}`, {
    ...options,
    headers: {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  });
  if (!res.ok) throw new Error(`Graph API error: ${res.status} ${await res.text()}`);
  const text = await res.text();
  return text ? JSON.parse(text) : null;
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { to, subject, body } = await req.json();

    if (!subject || !body) {
      return Response.json({ error: 'Missing subject or body' }, { status: 400 });
    }

    // Get the app user's Outlook connection
    const { accessToken } = await base44.asServiceRole.connectors.getCurrentAppUserConnection("6a0648de4330cb0974dee775");

    const message = {
      subject,
      body: {
        contentType: 'Text',
        content: body,
      },
      toRecipients: to
        ? [{ emailAddress: { address: to } }]
        : [],
    };

    // Send or create a draft (no 'to' = draft)
    if (to) {
      await graphRequest(accessToken, '/me/sendMail', {
        method: 'POST',
        body: JSON.stringify({ message, saveToSentItems: true }),
      });
      return Response.json({ success: true, action: 'sent' });
    } else {
      const draft = await graphRequest(accessToken, '/me/messages', {
        method: 'POST',
        body: JSON.stringify(message),
      });
      return Response.json({ success: true, action: 'draft', draftId: draft?.id });
    }
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});