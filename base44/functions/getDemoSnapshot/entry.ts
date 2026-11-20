import { createClientFromRequest } from 'npm:@base44/sdk@0.8.54';

// Public, read-only endpoint that returns the latest demo snapshot.
// Served via service role so it works for anonymous demo visitors.
export default async function (req) {
  try {
    const base44 = createClientFromRequest(req);
    const records = await base44.asServiceRole.entities.DemoSnapshot.list('-created_date', 1);
    const snapshot = records[0] || null;
    return Response.json({ snapshot });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}