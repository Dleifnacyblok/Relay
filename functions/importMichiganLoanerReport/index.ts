import * as XLSX from "npm:xlsx@0.18.5";

type RawRow = Record<string, any>;

/**
 * RELAY / MICHIGAN LOANER IMPORT (BULLETPROOF)
 * - Reads uploaded XLSX from req.body.fileBuffer (supports Buffer, base64 string, {data: base64}, Uint8Array)
 * - Accepts spreadsheet as-is
 * - Ignores: Area, Loaner ID, Consignment ID, Status
 * - Requires: Set ID, Set Name, Current Field Sales Name, Associate Sales Rep Name, Account Name, Etch Id, Loaned Date, Expected Return Date
 * - Rep shown on card = Associate Sales Rep Name; if blank => "None"
 * - Computes overdue + fine = $50/day * days overdue
 * - Upserts to base44.asServiceRole.entities.Loaners using importKey
 * - Prefetches existing records via filter { importKey: { in: [...] } } to avoid rate limits
 */

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

const IGNORE_HEADERS = new Set(["area", "loaner id", "consignment id", "status"]);
const FINE_PER_DAY = 50;

// -------------------- helpers --------------------
function normalizeHeader(h: string): string {
  return (h || "").toString().trim().toLowerCase().replace(/\s+/g, " ");
}

function cleanString(v: any): string {
  return (v ?? "").toString().trim();
}

// Convert Excel serial OR string OR Date => Date
function parseDate(value: any): Date | null {
  if (value == null || value === "") return null;

  if (value instanceof Date && !isNaN(value.getTime())) return value;

  // Excel serial
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

// Unique key so re-import doesn't duplicate
function makeImportKey(setId: string, etchId: string, accountName: string, loanedDate: Date): string {
  const loanedISO = loanedDate.toISOString().slice(0, 10); // YYYY-MM-DD
  const safeAccount = accountName.replace(/\s+/g, " ").trim();
  return `${setId}__${etchId}__${safeAccount}__${loanedISO}`.toLowerCase();
}

function sleep(ms: number) {
  return new Promise((res) => setTimeout(res, ms));
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// Accept Buffer | base64 string | { data: base64 } | Uint8Array
function coerceToBuffer(fileBuffer: any): Buffer {
  if (!fileBuffer) throw new Error("No file provided (expected req.body.fileBuffer)");

  if (Buffer.isBuffer(fileBuffer)) return fileBuffer;

  if (fileBuffer?.data && typeof fileBuffer.data === "string") {
    return Buffer.from(fileBuffer.data, "base64");
  }

  if (typeof fileBuffer === "string") {
    return Buffer.from(fileBuffer, "base64");
  }

  if (fileBuffer instanceof Uint8Array) {
    return Buffer.from(fileBuffer);
  }

  throw new Error(`Unsupported fileBuffer type: ${typeof fileBuffer}`);
}

// -------------------- importer --------------------
async function importLoanersFromSheet(rows: RawRow[]) {
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new Error("No rows found in upload.");
  }

  // Normalize headers for each row
  const normalizedRows = rows.map((r) => {
    const out: Record<string, any> = {};
    for (const k of Object.keys(r)) {
      out[normalizeHeader(k)] = r[k];
    }
    return out;
  });

  // Validate required headers using union of first few rows
  const keyUnion = new Set<string>();
  for (const r of normalizedRows.slice(0, 5)) {
    for (const k of Object.keys(r)) keyUnion.add(k);
  }

  const missingHeaders = REQUIRED_HEADERS.filter((h) => !keyUnion.has(h));
  if (missingHeaders.length) {
    throw new Error(
      `Upload missing required columns: ${missingHeaders.join(", ")}. Found: ${Array.from(keyUnion).join(", ")}`
    );
  }

  const now = new Date();
  const errors: string[] = [];
  const payload: any[] = [];

  normalizedRows.forEach((r, idx) => {
    const rowNum = idx + 2; // assumes row 1 is header

    const setId = cleanString(r["set id"]);
    const setName = cleanString(r["set name"]);
    const fieldSalesRep = cleanString(r["current field sales name"]);

    // Rep shown on card is Associate; fallback to "None"
    const assocRaw = cleanString(r["associate sales rep name"]);
    const repName = assocRaw ? assocRaw : "None";

    const accountName = cleanString(r["account name"]);
    const etchId = cleanString(r["etch id"]);
    const loanedDate = parseDate(r["loaned date"]);
    const expectedReturnDate = parseDate(r["expected return date"]);

    // Required cell-level validation (associate rep NOT required)
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

      // Card fields (bind these directly in UI)
      setName,
      etchId,
      accountName,
      repName,
      expectedReturnDate,
      fineAmount,
      isOverdue,

      // Extras for sorting/reporting
      setId,
      fieldSalesRep,
      loanedDate,
      daysUntilDue,
      daysOverdue,
      finePerDay: FINE_PER_DAY,
      lastImportedAt: now,
    });
  });

  if (errors.length) {
    throw new Error(
      `Import blocked. Fix these:\n- ${errors.slice(0, 20).join("\n- ")}${
        errors.length > 20 ? `\n...and ${errors.length - 20} more` : ""
      }`
    );
  }

  // Base44 entity (Service Role)
  const Loaners = base44.asServiceRole.entities.Loaners;

  // Prefetch existing by importKey using IN operator (lowercase 'in')
  const importKeys = payload.map((p) => p.importKey);
  const existingMap = new Map<string, { id: string }>();

  for (const keyBatch of chunk(importKeys, 50)) {
    const existing = await Loaners.findMany({
      filter: {
        importKey: { in: keyBatch },
      },
    });

    if (Array.isArray(existing)) {
      for (const e of existing) {
        if (e?.importKey && e?.id) existingMap.set(e.importKey, { id: e.id });
      }
    }

    await sleep(75);
  }

  // Write throttled to avoid rate limits
  let created = 0;
  let updated = 0;

  for (let i = 0; i < payload.length; i++) {
    const rec = payload[i];
    const existing = existingMap.get(rec.importKey);

    if (existing?.id) {
      await Loaners.update({ id: existing.id, data: rec });
      updated++;
    } else {
      const createdRec = await Loaners.create({ data: rec });
      created++;
      if (createdRec?.importKey && createdRec?.id) {
        existingMap.set(createdRec.importKey, { id: createdRec.id });
      }
    }

    // Aggressive throttling: wait after every 3 operations
    if ((i + 1) % 3 === 0) await sleep(400);
  }

  // --- CLEANUP: Delete loaners no longer in the spreadsheet ---
  // Fetch ALL existing loaners and delete any whose importKey is not in the new batch
  const newImportKeySet = new Set(importKeys);
  let deleted = 0;

  // Paginate through all records
  let page = 0;
  const pageSize = 100;
  while (true) {
    const allLoaners = await Loaners.findMany({ limit: pageSize, skip: page * pageSize });
    if (!Array.isArray(allLoaners) || allLoaners.length === 0) break;

    for (const loaner of allLoaners) {
      // Only delete records that have an importKey (i.e. were created by this import system)
      // and are NOT in the new batch
      if (loaner.importKey && !newImportKeySet.has(loaner.importKey)) {
        await Loaners.delete({ id: loaner.id });
        deleted++;
        await sleep(100);
      }
    }

    if (allLoaners.length < pageSize) break;
    page++;
    await sleep(200);
  }

  return {
    receivedRows: rows.length,
    importedRows: payload.length,
    created,
    updated,
    deleted,
    ignoredColumns: Array.from(IGNORE_HEADERS),
    repFallback: 'Blank Associate Sales Rep Name → "None"',
    fineRule: `$${FINE_PER_DAY}/day overdue`,
  };
}

// -------------------- Base44 handler --------------------
export default async function importMichiganLoanerReport(req: any, res: any) {
  try {
    // Accept a few common names Base44 might send
    const fileBuffer = req?.body?.fileBuffer ?? req?.body?.file ?? req?.body?.buffer;

    const buffer = coerceToBuffer(fileBuffer);

    // cellDates helps XLSX output actual Date objects
    const workbook = XLSX.read(buffer, { type: "buffer", cellDates: true });

    const allRows: RawRow[] = [];

    // If you only ever expect one sheet, you can switch to only the first sheet.
    for (const sheetName of workbook.SheetNames) {
      const worksheet = workbook.Sheets[sheetName];
      const sheetData = XLSX.utils.sheet_to_json(worksheet, {
        defval: "",
        raw: false,
      }) as RawRow[];

      allRows.push(...sheetData);
    }

    const result = await importLoanersFromSheet(allRows);

    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}