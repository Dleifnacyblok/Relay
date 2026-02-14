import * as XLSX from 'xlsx';

interface LoanerRecord {
  bucket: 'DUE_SOON' | 'OVERDUE' | 'ALL_PENDING';
  area?: string;
  setId?: string;
  setName?: string;
  currentFieldSalesName?: string;
  associateSalesRepName?: string;
  accountName?: string;
  etchId?: string;
  loanerId?: string;
  consignmentId?: string;
  status?: string;
  loanedDate?: string;
  expectedReturnDate?: string;
  daysOverdue?: number | null;
  reportDate: string;
  upsertKey: string;
}

const normalizeHeader = (header: string): string => {
  return header
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '_');
};

const parseDate = (value: any): string | null => {
  if (!value) return null;

  const str = String(value).trim();

  // Excel date number
  if (/^\d+(\.\d+)?$/.test(str)) {
    const n = Number(str);
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const dt = new Date(excelEpoch.getTime() + n * 24 * 60 * 60 * 1000);
    if (!isNaN(dt.getTime())) {
      return dt.toISOString().split('T')[0];
    }
  }

  // ISO date
  if (/^\d{4}-\d{2}-\d{2}/.test(str)) {
    return str.slice(0, 10);
  }

  // MM/DD/YYYY or M/D/YYYY
  const mdy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (mdy) {
    const mm = mdy[1].padStart(2, '0');
    const dd = mdy[2].padStart(2, '0');
    const yyyy = mdy[3];
    return `${yyyy}-${mm}-${dd}`;
  }

  // Try Date.parse
  const dt = new Date(str);
  if (!isNaN(dt.getTime())) {
    return dt.toISOString().split('T')[0];
  }

  return str; // Return as-is if unparseable
};

const mapFieldName = (normalizedHeader: string): string => {
  const mapping: Record<string, string> = {
    'area': 'area',
    'set_id': 'setId',
    'set_name': 'setName',
    'current_field_sales_name': 'currentFieldSalesName',
    'associate_sales_rep_name': 'associateSalesRepName',
    'account_name': 'accountName',
    'etch_id': 'etchId',
    'loaner_id': 'loanerId',
    'consignment_id': 'consignmentId',
    'status': 'status',
    'loaned_date': 'loanedDate',
    'expected_return_date': 'expectedReturnDate',
    'days_overdue': 'daysOverdue',
  };

  return mapping[normalizedHeader] || normalizedHeader;
};

const processSheet = (
  sheetData: any[],
  bucket: 'DUE_SOON' | 'OVERDUE' | 'ALL_PENDING',
  reportDate: string
): LoanerRecord[] => {
  if (!Array.isArray(sheetData) || sheetData.length === 0) {
    return [];
  }

  const records: LoanerRecord[] = [];

  for (const row of sheetData) {
    const record: LoanerRecord = {
      bucket,
      reportDate,
      upsertKey: '',
    };

    // Normalize headers and map fields
    for (const [key, value] of Object.entries(row)) {
      const normalizedKey = normalizeHeader(key);
      const mappedKey = mapFieldName(normalizedKey);

      // Handle date fields
      if (mappedKey === 'loanedDate' || mappedKey === 'expectedReturnDate') {
        (record as any)[mappedKey] = parseDate(value);
      } else if (mappedKey === 'daysOverdue') {
        (record as any)[mappedKey] = value ? Number(value) : null;
      } else {
        (record as any)[mappedKey] = value ? String(value).trim() : null;
      }
    }

    // Generate upsertKey: loanerId + etchId + expectedReturnDate + bucket
    const loanerId = record.loanerId || '';
    const etchId = record.etchId || '';
    const expectedReturnDate = record.expectedReturnDate || '';
    record.upsertKey = `${loanerId}|${etchId}|${expectedReturnDate}|${bucket}`;

    // Only include if upsertKey has at least some component
    if (record.upsertKey !== '|||' + bucket) {
      records.push(record);
    }
  }

  return records;
};

export default async function importMichiganLoanerReport(req: any, res: any) {
  try {
    const { fileBuffer } = req.body;

    if (!fileBuffer) {
      return res.status(400).json({ error: 'No file provided' });
    }

    // Decode base64 if needed
    const buffer = Buffer.isBuffer(fileBuffer)
      ? fileBuffer
      : Buffer.from(fileBuffer, 'base64');

    // Read workbook
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const reportDate = new Date().toISOString().split('T')[0];

    const allRecords: LoanerRecord[] = [];

    // Process sheets
    const sheetMapping: Record<string, 'DUE_SOON' | 'OVERDUE' | 'ALL_PENDING'> = {
      'due today/tomorrow': 'DUE_SOON',
      'due_today_tomorrow': 'DUE_SOON',
      'overdue': 'OVERDUE',
      'all pending': 'ALL_PENDING',
      'all_pending': 'ALL_PENDING',
    };

    for (const sheetName of workbook.SheetNames) {
      const normalizedName = sheetName.toLowerCase().trim().replace(/\s+/g, '_');
      const bucket = sheetMapping[normalizedName];

      if (bucket) {
        const worksheet = workbook.Sheets[sheetName];
        const sheetData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
        const records = processSheet(sheetData, bucket, reportDate);
        allRecords.push(...records);
      }
    }

    if (allRecords.length === 0) {
      return res.status(400).json({
        error: 'No valid data found in sheets',
        processedSheets: workbook.SheetNames,
      });
    }

    // Upsert logic: group by upsertKey and reportDate
    const upsertMap = new Map<string, LoanerRecord>();
    for (const record of allRecords) {
      const key = `${record.upsertKey}|${record.reportDate}`;
      upsertMap.set(key, record);
    }

    const recordsToUpsert = Array.from(upsertMap.values());

    // Attempt to upsert records
    let created = 0;
    let updated = 0;
    const failures: any[] = [];

    for (const record of recordsToUpsert) {
      try {
        // Try to find existing record by upsertKey and reportDate
        const existing = await base44.asServiceRole.entities.MichiganLoaners.filter(
          { upsertKey: record.upsertKey, reportDate: record.reportDate },
          '',
          1
        );

        if (existing && existing.length > 0) {
          // Update existing
          await base44.asServiceRole.entities.MichiganLoaners.update(existing[0].id, record);
          updated++;
        } else {
          // Create new
          await base44.asServiceRole.entities.MichiganLoaners.create(record);
          created++;
        }
      } catch (error) {
        failures.push({
          record,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return res.json({
      success: failures.length === 0,
      created,
      updated,
      total: recordsToUpsert.length,
      failures: failures.length > 0 ? failures : undefined,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}