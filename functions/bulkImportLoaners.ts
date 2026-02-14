const BATCH_SIZE = 50;
const BATCH_DELAY = 200; // 200ms delay between batches
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // Starting delay for retries

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const validateRow = (row, rowIndex) => {
  const errors = [];
  
  if (!row["Set Name"] || String(row["Set Name"]).trim() === '') {
    errors.push('Missing Set Name');
  }
  if (!row["Loaner Id"] || String(row["Loaner Id"]).trim() === '') {
    errors.push('Missing Loaner Id');
  }
  if (!row["Account Name"] || String(row["Account Name"]).trim() === '') {
    errors.push('Missing Account Name');
  }
  if (!row["Loaned Date"] || String(row["Loaned Date"]).trim() === '') {
    errors.push('Missing Loaned Date');
  }
  
  return errors;
};

const parseDate = (dateValue) => {
  if (!dateValue) return null;
  
  // If it's a number (Excel serial date)
  if (typeof dateValue === 'number') {
    const excelEpoch = new Date(1900, 0, 1);
    const date = new Date(excelEpoch.getTime() + (dateValue - 2) * 24 * 60 * 60 * 1000);
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const year = date.getFullYear();
    return `${month}/${day}/${year}`;
  }
  
  // If it's a string, try to parse and reformat
  if (typeof dateValue === 'string') {
    const date = new Date(dateValue);
    if (!isNaN(date.getTime())) {
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    }
  }
  
  return null;
};

const transformRow = (row) => {
  const status = String(row["Status"] || '').trim();
  
  return {
    set_name: String(row["Set Name"] || '').trim(),
    loaner_id: String(row["Loaner Id"] || '').trim(),
    etch_id: String(row["Etch Id"] || '').trim() || null,
    account_name: String(row["Account Name"] || '').trim(),
    associate_rep: String(row["Associate Sales Rep Name"] || '').trim() || null,
    field_rep: String(row["Current Field Sales Name"] || '').trim() || null,
    status: status === "Pending Return" ? "loaned" : status || null,
    loaned_date: parseDate(row["Loaned Date"]),
    expected_return_date: parseDate(row["Expected Return Date"]) || null
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
            const transformedRow = transformRow(row);
            validRows.push(transformedRow);
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