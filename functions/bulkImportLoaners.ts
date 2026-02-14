export default async function bulkImportLoaners(req, res) {
  const { data } = req.body;
  
  if (!Array.isArray(data) || data.length === 0) {
    return res.status(400).json({ error: 'No data provided' });
  }

  try {
    const batchId = Date.now().toString(36) + Math.random().toString(36).substr(2);
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

    // Fetch existing loaners to check for upserts
    const existingLoaners = await base44.asServiceRole.entities.Loaners.list();
    const existingByKey = {};
    for (const loaner of existingLoaners) {
      if (loaner.unique_key) {
        existingByKey[loaner.unique_key] = loaner;
      }
    }

    // Separate creates and updates
    const creates = [];
    const updates = [];
    
    for (const record of recordsToUpsert) {
      if (existingByKey[record.unique_key]) {
        updates.push({ id: existingByKey[record.unique_key].id, data: record });
      } else {
        creates.push(record);
      }
    }

    // Bulk create
    if (creates.length > 0) {
      await base44.asServiceRole.entities.Loaners.bulkCreate(creates);
    }

    // Bulk update
    if (updates.length > 0) {
      for (const { id, data: updateData } of updates) {
        await base44.asServiceRole.entities.Loaners.update(id, updateData);
      }
    }

    // Update AppSetting with last import metadata
    const appSettingList = await base44.asServiceRole.entities.AppSetting.filter(
      { key: 'import_metadata' }
    );

    if (appSettingList.length > 0) {
      await base44.asServiceRole.entities.AppSetting.update(appSettingList[0].id, {
        last_imported_at: now,
        last_import_batch_id: batchId
      });
    } else {
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
      created: creates.length,
      updated: updates.length
    });
  } catch (error) {
    console.error('Bulk import error:', error);
    return res.status(500).json({ error: error.message });
  }
}