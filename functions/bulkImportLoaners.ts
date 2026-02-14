const { v4: uuidv4 } = require('uuid');

export default async function bulkImportLoaners(req, res) {
  const { data } = req.body;
  
  if (!Array.isArray(data) || data.length === 0) {
    return res.status(400).json({ error: 'No data provided' });
  }

  try {
    const batchId = uuidv4();
    const now = new Date().toISOString();
    
    // Prepare records for upsert
    const recordsToUpsert = data.map(record => {
      // Compute unique key: LOWER(TRIM(etch_id))|LOWER(TRIM(set_name))|LOWER(TRIM(account_name))
      const uniqueKey = [
        (record.etch_id || '').trim().toLowerCase(),
        (record.set_name || '').trim().toLowerCase(),
        (record.account_name || '').trim().toLowerCase()
      ].join('|');
      
      return {
        ...record,
        import_batch_id: batchId,
        imported_at: now,
        unique_key: uniqueKey
      };
    });

    // Bulk upsert using deterministic unique key
    const upsertResult = await base44.asServiceRole.entities.Loaners.bulkUpsert(
      recordsToUpsert,
      'unique_key'
    );

    // Update AppSetting with last import metadata
    const appSetting = await base44.asServiceRole.entities.AppSetting.filter(
      { key: 'import_metadata' }
    );

    if (appSetting.length > 0) {
      // Update existing
      await base44.asServiceRole.entities.AppSetting.update(appSetting[0].id, {
        last_imported_at: now,
        last_import_batch_id: batchId
      });
    } else {
      // Create new
      await base44.asServiceRole.entities.AppSetting.create({
        key: 'import_metadata',
        last_imported_at: now,
        last_import_batch_id: batchId
      });
    }

    return res.json({
      success: true,
      batchId,
      importedAt: now,
      recordCount: recordsToUpsert.length,
      result: upsertResult
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    return res.status(500).json({ error: error.message });
  }
}