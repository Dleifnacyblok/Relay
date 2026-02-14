const BATCH_SIZE = 50;
const BATCH_DELAY = 200; // 200ms delay between batches
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // Starting delay for retries

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const validateRow = (row, rowIndex) => {
  const errors = [];
  
  if (!row.set_name || String(row.set_name).trim() === '') {
    errors.push('Missing Set Name');
  }
  if (!row.etch_id || String(row.etch_id).trim() === '') {
    errors.push('Missing Etch Id');
  }
  
  return errors;
};

const parseExcelDate = (dateValue) => {
  if (!dateValue) return null;
  
  // If it's already a string in YYYY-MM-DD format, return it
  if (typeof dateValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
    return dateValue;
  }
  
  // If it's a string, try to parse it
  if (typeof dateValue === 'string') {
    const date = new Date(dateValue);
    if (!isNaN(date.getTime())) {
      return date.toISOString().split('T')[0];
    }
  }
  
  // If it's a number (Excel serial date)
  if (typeof dateValue === 'number') {
    // Excel date serial (days since 1900-01-01, with 1900 leap year bug)
    const excelEpoch = new Date(1900, 0, 1);
    const date = new Date(excelEpoch.getTime() + (dateValue - 2) * 24 * 60 * 60 * 1000);
    return date.toISOString().split('T')[0];
  }
  
  return null;
};

const cleanRow = (row) => {
  return {
    set_name: String(row.set_name || '').trim(),
    etch_id: String(row.etch_id || '').trim(),
    primary_rep: String(row.primary_rep || '').trim() || null,
    associate_rep: String(row.associate_rep || '').trim() || null,
    account_name: String(row.account_name || '').trim() || null,
    status: String(row.status || '').trim() || null,
    loaned_date: parseExcelDate(row.loaned_date),
    expected_return_date: parseExcelDate(row.expected_return_date)
  };
};

export default async function bulkImportLoaners(req, res) {
  const { data } = req.body;
  
  if (!Array.isArray(data) || data.length === 0) {
    return res.status(400).json({ error: 'No data provided' });
  }

  const successRows = [];
  const failedRows = [];
  const totalRows = data.length;
  const totalBatches = Math.ceil(totalRows / BATCH_SIZE);

  try {
    for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
      const startIndex = batchIndex * BATCH_SIZE;
      const endIndex = Math.min(startIndex + BATCH_SIZE, totalRows);
      const batchData = data.slice(startIndex, endIndex);
      
      console.log(`Processing batch ${batchIndex + 1}/${totalBatches} (rows ${startIndex + 1}-${endIndex})`);

      // Validate and clean rows in batch
      const validRows = [];
      batchData.forEach((row, idx) => {
        const rowNumber = startIndex + idx + 2; // +2 for header and 0-indexing
        const validationErrors = validateRow(row, rowNumber);
        
        if (validationErrors.length > 0) {
          failedRows.push({
            rowNumber,
            data: row,
            errors: validationErrors
          });
        } else {
          try {
            const cleanedRow = cleanRow(row);
            validRows.push(cleanedRow);
            successRows.push(rowNumber);
          } catch (err) {
            failedRows.push({
              rowNumber,
              data: row,
              errors: [err.message]
            });
          }
        }
      });

      // Insert valid rows
      if (validRows.length > 0) {
        let retries = 0;
        let inserted = false;

        while (retries < MAX_RETRIES && !inserted) {
          try {
            await base44.asServiceRole.entities.Loaners.bulkCreate(validRows);
            inserted = true;
          } catch (error) {
            retries++;
            const isRateLimit = error.message?.includes('rate') || error.message?.includes('quota');
            
            if (isRateLimit && retries < MAX_RETRIES) {
              const delayMs = RETRY_DELAY * Math.pow(2, retries - 1);
              console.log(`Rate limited. Retrying batch ${batchIndex + 1} in ${delayMs}ms...`);
              await delay(delayMs);
            } else {
              // Mark all rows in this batch as failed
              validRows.forEach((_, idx) => {
                const rowNumber = startIndex + idx + 2;
                failedRows.push({
                  rowNumber,
                  data: batchData[idx],
                  errors: [error.message]
                });
              });
              inserted = true; // Stop retrying
            }
          }
        }
      }

      // Delay before next batch
      if (batchIndex < totalBatches - 1) {
        await delay(BATCH_DELAY);
      }
    }

    return res.json({
      success: failedRows.length === 0,
      summary: {
        totalRows,
        successCount: successRows.length,
        failureCount: failedRows.length,
        batches: totalBatches
      },
      failures: failedRows.length > 0 ? failedRows : undefined
    });

  } catch (error) {
    console.error('Bulk import error:', error);
    return res.status(500).json({ 
      error: error.message,
      summary: {
        totalRows,
        successCount: successRows.length,
        failureCount: failedRows.length,
        batches: totalBatches
      },
      failures: failedRows.length > 0 ? failedRows : undefined
    });
  }
}