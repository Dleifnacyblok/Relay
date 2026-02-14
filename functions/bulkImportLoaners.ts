const BATCH_SIZE = 50;
const BATCH_DELAY = 200;

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const parseDate = (dateValue) => {
  if (!dateValue) return null;
  
  // If it's a number (Excel serial date)
  if (typeof dateValue === 'number') {
    try {
      const excelEpoch = new Date(1900, 0, 1);
      const date = new Date(excelEpoch.getTime() + (dateValue - 2) * 24 * 60 * 60 * 1000);
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const year = date.getFullYear();
      return `${month}/${day}/${year}`;
    } catch {
      return String(dateValue);
    }
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
    // If parsing fails, return as-is text
    return dateValue;
  }
  
  return String(dateValue);
};

const stringifyRow = (row) => {
  const stringifiedRow = {};
  const idFields = ["Set ID", "Loaner Id", "Etch Id", "Consignment Id"];
  
  for (const [key, value] of Object.entries(row)) {
    if (value === null || value === undefined) {
      stringifiedRow[key] = '';
    } else if (idFields.includes(key)) {
      const strValue = String(value);
      stringifiedRow[key] = strValue.includes('.') ? strValue.split('.')[0] : strValue;
    } else {
      stringifiedRow[key] = String(value);
    }
  }
  
  return stringifiedRow;
};

const transformRow = (row) => {
  return {
    rep: (row["Current Field Sales Name"] || '').trim() || null,
    associate_rep: (row["Associate Sales Rep Name"] || '').trim() || null,
    set_name: (row["Set Name"] || '').trim(),
    etch_id: (row["Etch Id"] || '').trim() || null,
    account: (row["Account Name"] || '').trim(),
    due_date: parseDate(row["Expected Return Date"]) || null
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

      const validRows = [];
      batchData.forEach((row, idx) => {
        const rowNumber = startIndex + idx + 2;
        
        // Convert to strings
        const stringifiedRow = stringifyRow(row);
        
        // Check if both required fields are empty
        const setName = (stringifiedRow["Set Name"] || '').trim();
        const accountName = (stringifiedRow["Account Name"] || '').trim();
        
        if (!setName && !accountName) {
          failedRows.push({
            rowNumber,
            data: row,
            error: 'Missing both Set Name and Account Name'
          });
        } else {
          try {
            const transformedRow = transformRow(stringifiedRow);
            validRows.push(transformedRow);
            successRows.push(rowNumber);
          } catch (err) {
            failedRows.push({
              rowNumber,
              data: row,
              error: err.message
            });
          }
        }
      });

      // Insert valid rows
      if (validRows.length > 0) {
        try {
          await base44.asServiceRole.entities.Loaners.bulkCreate(validRows);
        } catch (error) {
          validRows.forEach((_, idx) => {
            const rowNumber = startIndex + idx + 2;
            failedRows.push({
              rowNumber,
              data: batchData[idx],
              error: error.message
            });
          });
        }
      }

      // Delay before next batch
      if (batchIndex < totalBatches - 1) {
        await delay(BATCH_DELAY);
      }
    }

    return res.json({
      success: failedRows.length === 0,
      recordCount: successRows.length,
      failureCount: failedRows.length,
      failures: failedRows.length > 0 ? failedRows : undefined
    });

  } catch (error) {
    console.error('Bulk import error:', error);
    return res.status(500).json({ 
      error: error.message,
      recordCount: successRows.length,
      failureCount: failedRows.length
    });
  }
}