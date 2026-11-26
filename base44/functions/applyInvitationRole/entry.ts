import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// Applies the role chosen on a rep invitation to the invited user's own account.
// The caller must be the invited person (their email must match the invitation).
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me().catch((e) => (e.status === 401 ? null : Promise.reject(e)));
    if (!user) return Response.json({ error: 'Unauthorized' }, { status: 401 });

    const { invitationId } = await req.json().catch(() => ({}));
    if (!invitationId) return Response.json({ error: 'invitationId is required' }, { status: 400 });

    const invitation = await base44.asServiceRole.entities.RepInvitation.get(invitationId)
      .catch((e) => (e.status === 404 ? null : Promise.reject(e)));
    if (!invitation) return Response.json({ error: 'Invitation not found' }, { status: 404 });

    const callerEmail = (user.email || '').toLowerCase().trim();
    if (!callerEmail || callerEmail !== (invitation.email || '').toLowerCase().trim()) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const role = ['user', 'manager', 'admin'].includes(invitation.role) ? invitation.role : 'user';
    if (role === 'user') return Response.json({ role, updated: false });

    const users = await base44.asServiceRole.entities.User.filter({ email: callerEmail });
    const target = users[0];
    if (!target) return Response.json({ error: 'User not found' }, { status: 404 });

    await base44.asServiceRole.entities.User.update(target.id, { role });
    return Response.json({ role, updated: true });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}