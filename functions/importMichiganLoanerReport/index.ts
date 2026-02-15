import * as XLSX from 'xlsx';

type RawRow = Record<string, any>;

const REQUIRED_HEADERS = [
  "set id",
  "set name",
  "current field sales name",
  "associate sales rep name",
  "account name",
  "etch id",
  "loaned date",
  "expected return date",
];

const IGNORE_HEADERS = new Set([
  "area",
  "loaner id",
  "consignment id",
  "status",
]);

const FINE_PER_DAY = 50;

function normalizeHeader(h: string): string {
  return (h || "")
    .toString()
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function cleanString(v: any): string {
  return (v ?? "").toString().trim();
}

function parseDate(value: any): Date | null {
  if (value == null || value === "") return null;

  if (value instanceof Date && !isNaN(value.getTime())) return value;

  if (typeof value === "number") {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const ms = value * 86400000;
    const d = new Date(excelEpoch.getTime() + ms);
    return isNaN(d.getTime()) ? null : d;
  }

  const s = value.toString().trim();
  if (!s) return null;

  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

function daysDiff(from: Date, to: Date): number {
  const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
  const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
  return Math.round((b - a) / 86400000);
}

function makeImportKey(setId: string, etchId: string, accountName: string, loanedDate: Date): string {
  const loanedISO = loanedDate.toISOString().slice(0, 10);
  const safeAccount = accountName.replace(/\s+/g, " ").trim();
  return `${setId}__${etchId}__${safeAccount}__${loanedISO}`.toLowerCase();
}

export default async function importMichiganLoanerReport(req: any, res: any) {
  try {
    const { fileBuffer } = req.body;

    if (!fileBuffer) {
      return res.status(400).json({ error: 'No file provided' });
    }

    const buffer = Buffer.isBuffer(fileBuffer)
      ? fileBuffer
      : Buffer.from(fileBuffer, 'base64');

    const workbook = XLSX.read(buffer, { type: 'buffer' });
    
    // Process all sheets
    const allRows: RawRow[] = [];
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const sheetData = XLSX.utils.sheet_to_json(worksheet, { defval: '' });
      allRows.push(...sheetData);
    }

    if (allRows.length === 0) {
      return res.status(400).json({ error: 'No rows found in upload' });
    }

    // Normalize headers
    const normalizedRows = allRows.map((r) => {
      const out: Record<string, any> = {};
      for (const key of Object.keys(r)) {
        out[normalizeHeader(key)] = r[key];
      }
      return out;
    });

    // Validate required headers
    const keys = new Set(Object.keys(normalizedRows[0] || {}));
    const missingHeaders = REQUIRED_HEADERS.filter((h) => !keys.has(h));
    if (missingHeaders.length) {
      return res.status(400).json({
        error: `Upload missing required columns: ${missingHeaders.join(", ")}. Found columns: ${Array.from(keys).join(", ")}`
      });
    }

    const now = new Date();
    const errors: string[] = [];
    const payload: any[] = [];

    normalizedRows.forEach((r, idx) => {
      const rowNum = idx + 2;

      const setId = cleanString(r["set id"]);
      const setName = cleanString(r["set name"]);
      const fieldSalesRep = cleanString(r["current field sales name"]);
      const assocRaw = cleanString(r["associate sales rep name"]);
      const repName = assocRaw || "None";
      const accountName = cleanString(r["account name"]);
      const etchId = cleanString(r["etch id"]);

      const loanedDate = parseDate(r["loaned date"]);
      const expectedReturnDate = parseDate(r["expected return date"]);

      const missing: string[] = [];
      if (!setId) missing.push("Set ID");
      if (!setName) missing.push("Set Name");
      if (!accountName) missing.push("Account Name");
      if (!etchId) missing.push("Etch Id");
      if (!loanedDate) missing.push("Loaned Date");
      if (!expectedReturnDate) missing.push("Expected Return Date");
      if (!fieldSalesRep) missing.push("Current Field Sales Name");

      if (missing.length) {
        errors.push(`Row ${rowNum}: missing ${missing.join(", ")}`);
        return;
      }

      const daysUntilDue = daysDiff(now, expectedReturnDate!);
      const isOverdue = daysUntilDue < 0;
      const daysOverdue = isOverdue ? Math.abs(daysUntilDue) : 0;
      const fineAmount = daysOverdue * FINE_PER_DAY;

      const importKey = makeImportKey(setId, etchId, accountName, loanedDate!);

      payload.push({
        importKey,
        setName,
        etchId,
        accountName,
        repName,
        expectedReturnDate: expectedReturnDate!.toISOString().split('T')[0],
        fineAmount,
        setId,
        fieldSalesRep,
        associateSalesRep: repName,
        loanedDate: loanedDate!.toISOString().split('T')[0],
        daysUntilDue,
        daysOverdue,
        isOverdue,
        finePerDay: FINE_PER_DAY,
        lastImportedAt: now.toISOString(),
      });
    });

    if (errors.length) {
      return res.status(400).json({
        error: `Import blocked. Fix these issues:\n- ${errors.slice(0, 20).join("\n- ")}${
          errors.length > 20 ? `\n...and ${errors.length - 20} more` : ""
        }`
      });
    }

    // Upsert in batches
    const BATCH_SIZE = 25;
    let created = 0;
    let updated = 0;

    for (let i = 0; i < payload.length; i += BATCH_SIZE) {
      const batch = payload.slice(i, i + BATCH_SIZE);

      for (const record of batch) {
        try {
          const existing = await base44.asServiceRole.entities.Loaners.filter(
            { importKey: record.importKey },
            '',
            1
          );

          if (existing && existing.length > 0) {
            await base44.asServiceRole.entities.Loaners.update(existing[0].id, record);
            updated++;
          } else {
            await base44.asServiceRole.entities.Loaners.create(record);
            created++;
          }
        } catch (error) {
          errors.push(`Failed to upsert record with importKey ${record.importKey}: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    }

    return res.json({
      success: errors.length === 0,
      created,
      updated,
      total: payload.length,
      receivedRows: allRows.length,
      importedRows: created + updated,
      ignoredColumns: Array.from(IGNORE_HEADERS),
      repFallback: 'Blank Associate Sales Rep Name → "None"',
      fineRule: `$${FINE_PER_DAY}/day overdue`,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error) {
    return res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}