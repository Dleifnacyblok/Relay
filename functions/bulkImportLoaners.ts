const BATCH_SIZE = 50;
const INITIAL_RETRY_DELAY = 1000;
const MAX_RETRIES = 5;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const retryWithBackoff = async (fn, retries = MAX_RETRIES) => {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error) {
      if (i === retries - 1) throw error;
      
      // Check for rate limit or quota errors
      const isRateLimit = error.message?.includes('rate') || error.message?.includes('quota');
      if (!isRateLimit) throw error;
      
      const delayMs = INITIAL_RETRY_DELAY * Math.pow(2, i);
      console.log(`Retry ${i + 1}/${retries} after ${delayMs}ms due to rate limit`);
      await delay(delayMs);
    }
  }
};

export default async function bulkImportLoaners(req, res) {
  const { data } = req.body;
  
  if (!Array.isArray(data) || data.length === 0) {
    return res.status(400).json({ error: 'No data provided' });
  }

  try {
    const batchId = Date.now().toString(36) + Math.random().toString(36).substr(2);
    const now = new Date().toISOString();
    
    // Helper to format date as YYYY-MM-DD
    const formatDateKey = (dateStr) => {
      if (!dateStr) return '';
      try {
        const date = new Date(dateStr);
        return date.toISOString().split('T')[0];
      } catch {
        return '';
      }
    };
    
    // Prepare records for upsert
    const recordsToUpsert = data.map(record => {
      const loanerKey = [
        (record.etch_id || '').trim().toLowerCase(),
        (record.set_name || '').trim().toLowerCase(),
        (record.account_name || '').trim().toLowerCase(),
        formatDateKey(record.loaned_date)
      ].join('|');
      
      return {
        ...record,
        import_batch_id: batchId,
        imported_at: now,
        loaner_key: loanerKey
      };
    });

    // Fetch existing loaners to check for upserts
    const existingLoaners = await retryWithBackoff(() =>
      base44.asServiceRole.entities.Loaners.list()
    );
    
    const existingByKey = {};
    for (const loaner of existingLoaners) {
      if (loaner.loaner_key) {
        existingByKey[loaner.loaner_key] = loaner;
      }
    }

    // Separate creates and updates
    const creates = [];
    const updates = [];
    
    for (const record of recordsToUpsert) {
      if (existingByKey[record.loaner_key]) {
        updates.push({ id: existingByKey[record.loaner_key].id, data: record });
      } else {
        creates.push(record);
      }
    }

    // Process creates in batches with retry
    for (let i = 0; i < creates.length; i += BATCH_SIZE) {
      const batch = creates.slice(i, i + BATCH_SIZE);
      await retryWithBackoff(() =>
        base44.asServiceRole.entities.Loaners.bulkCreate(batch)
      );
      // Add delay between batches
      if (i + BATCH_SIZE < creates.length) {
        await delay(500);
      }
    }

    // Process updates in batches with retry
    for (let i = 0; i < updates.length; i += BATCH_SIZE) {
      const batch = updates.slice(i, i + BATCH_SIZE);
      for (const { id, data: updateData } of batch) {
        await retryWithBackoff(() =>
          base44.asServiceRole.entities.Loaners.update(id, updateData)
        );
      }
      // Add delay between batches
      if (i + BATCH_SIZE < updates.length) {
        await delay(500);
      }
    }

    // Update AppSetting with last import metadata
    const appSettingList = await retryWithBackoff(() =>
      base44.asServiceRole.entities.AppSetting.filter({ key: 'import_metadata' })
    );

    if (appSettingList.length > 0) {
      await retryWithBackoff(() =>
        base44.asServiceRole.entities.AppSetting.update(appSettingList[0].id, {
          last_imported_at: now,
          last_import_batch_id: batchId
        })
      );
    } else {
      await retryWithBackoff(() =>
        base44.asServiceRole.entities.AppSetting.create({
          key: 'import_metadata',
          last_imported_at: now,
          last_import_batch_id: batchId
        })
      );
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
    const isRateLimit = error.message?.includes('rate') || error.message?.includes('quota');
    return res.status(isRateLimit ? 429 : 500).json({ 
      error: error.message,
      retryAfter: isRateLimit ? 30 : undefined
    });
  }
}