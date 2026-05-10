import { createClientFromRequest } from 'npm:@base44/sdk@0.8.25';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (user?.role !== 'admin') {
      return Response.json({ error: 'Forbidden: Admin access required' }, { status: 403 });
    }

    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    // Fetch all records (paginate in batches of 200)
    let allParts = [];
    let skip = 0;
    const limit = 200;
    while (true) {
      const batch = await base44.asServiceRole.entities.MissingPart.list(null, limit, skip);
      if (!batch || batch.length === 0) break;
      allParts = allParts.concat(batch);
      if (batch.length < limit) break;
      skip += limit;
    }

    console.log(`Fetched ${allParts.length} total MissingPart records`);

    // Dedup key: requestNumber + partNumber + etchId (WITHOUT date — the date changes each import month)
    // This catches cases where April import left records and May import added the same parts with new dates
    const makeKey = (p) => [
      (p.requestNumber || '').trim().toLowerCase(),
      (p.partNumber || p.partSetNumber || '').trim().toLowerCase(),
      (p.etchId || '').trim().toLowerCase(),
    ].join('|');

    // Group records by key; keep the oldest (first created) as canonical
    const keyMap = new Map();
    for (const part of allParts) {
      const key = makeKey(part);
      if (!keyMap.has(key)) {
        keyMap.set(key, []);
      }
      keyMap.get(key).push(part);
    }

    // Collect IDs to delete (all duplicates beyond the first)
    const toDelete = [];
    for (const [key, records] of keyMap.entries()) {
      if (records.length > 1) {
        // Sort by created_date ascending so we keep the earliest
        records.sort((a, b) => new Date(a.created_date) - new Date(b.created_date));
        console.log(`Key "${key}" has ${records.length} duplicates — keeping 1, deleting ${records.length - 1}`);
        for (let i = 1; i < records.length; i++) {
          toDelete.push(records[i].id);
        }
      }
    }

    console.log(`Deleting ${toDelete.length} duplicate records...`);

    let deleted = 0;
    const BATCH = 10;
    for (let i = 0; i < toDelete.length; i += BATCH) {
      const batch = toDelete.slice(i, i + BATCH);
      await Promise.all(batch.map(async (id) => {
        try {
          await base44.asServiceRole.entities.MissingPart.delete(id);
          deleted++;
        } catch (e) {
          console.error(`Failed to delete ${id}:`, e.message);
        }
      }));
      await sleep(200);
    }

    return Response.json({
      success: true,
      total_records: allParts.length,
      unique_keys: keyMap.size,
      deleted,
      message: `Cleaned up ${deleted} duplicate records. ${keyMap.size} unique parts remain.`,
    });
  } catch (error) {
    console.error('Error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
});