export default async function bulkImportLoaners(req, res) {
  const { rows } = req.body;
  
  if (!Array.isArray(rows) || rows.length === 0) {
    return res.status(400).json({ error: 'No rows provided' });
  }

  const results = [];
  let imported = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      await base44.asServiceRole.entities.Loaners.create(row);
      results.push({ ok: true, row });
      imported++;
    } catch (e) {
      results.push({ ok: false, error: e?.message ?? String(e), row });
      failed++;
    }
  }

  return res.json({
    success: failed === 0,
    recordCount: imported,
    failureCount: failed,
    failures: results.filter(r => !r.ok).length > 0 ? results.filter(r => !r.ok) : undefined
  });
}