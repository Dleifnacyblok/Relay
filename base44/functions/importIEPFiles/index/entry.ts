import { createClientFromRequest } from 'npm:@base44/sdk@0.8.23';
import * as XLSX from 'npm:xlsx@0.18.5';

const toNum = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).replace(/\u00a0/g, "").trim();
  if (!s) return null;
  const n = parseFloat(s.replace(/[,%]/g, ""));
  return isNaN(n) ? null : n;
};

const cleanStr = (v) => {
  if (!v) return "";
  return String(v).replace(/\u00a0/g, "").trim();
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Normalize a header label so column names match regardless of case/spacing/punctuation
const normKey = (v) =>
  String(v ?? "")
    .replace(/\u00a0/g, " ")
    .toUpperCase()
    .replace(/%/g, " PCT ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

// IEP exports often start with title/banner rows above the real header row
function findHeaderRow(aoa) {
  for (let i = 0; i < Math.min(aoa.length, 20); i++) {
    const keys = (aoa[i] || []).map(normKey);
    if (keys.includes("NAME") || keys.includes("SET NAME") || keys.includes("TAG ID")) return i;
  }
  return -1;
}

// Parse a grid sheet into rows keyed by normalized header names
function parseSheet(ws) {
  const aoa = XLSX.utils.sheet_to_json(ws, { header: 1, defval: "", raw: false, blankrows: false });
  const headerIdx = findHeaderRow(aoa);
  if (headerIdx < 0) return [];
  const headers = (aoa[headerIdx] || []).map(normKey);
  return aoa.slice(headerIdx + 1).map((cells) => {
    const row = {};
    headers.forEach((h, i) => {
      if (h) row[h] = cells?.[i] ?? "";
    });
    return row;
  });
}

// Read a field by any of its known header spellings
const f = (row, ...aliases) => {
  for (const alias of aliases) {
    const v = row[normKey(alias)];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
};

// Skip total/footer rows that are not real systems or sets
const isJunkName = (name) => {
  const s = cleanStr(name).toLowerCase();
  if (!s) return true;
  if (s === "name" || s === "set name") return true;
  if (s.startsWith("grand total")) return true;
  if (/^\d+\s+rows?$/.test(s)) return true;
  return false;
};

// Delete all records in chunks to avoid rate limit
async function deleteAll(entity) {
  const existing = await entity.list('created_date', 200);
  for (let i = 0; i < existing.length; i += 5) {
    const chunk = existing.slice(i, i + 5);
    await Promise.all(chunk.map(r => entity.delete(r.id)));
    await sleep(600);
  }
}

// Bulk create in chunks
async function bulkCreate(entity, records) {
  for (let i = 0; i < records.length; i += 50) {
    const chunk = records.slice(i, i + 50);
    await entity.bulkCreate(chunk);
    if (i + 50 < records.length) await sleep(500);
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();
    if (!user || (user.role !== 'admin' && user.role !== 'manager')) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await req.json();
    const { fileUrl, fileType } = body;

    if (!fileUrl || !fileType) {
      return Response.json({ error: 'fileUrl and fileType required' }, { status: 400 });
    }

    const res = await fetch(fileUrl);
    if (!res.ok) {
      return Response.json({ error: `Failed to fetch file: ${res.status}` }, { status: 400 });
    }
    const ab = await res.arrayBuffer();
    const wb = XLSX.read(new Uint8Array(ab), { type: 'array' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows = parseSheet(ws);
    const importedAt = new Date().toISOString();

    if (fileType === 'grid6') {
      const valid = rows.filter(r => !isJunkName(f(r, "NAME")));
      await deleteAll(base44.asServiceRole.entities.IEPSystemData);
      const records = valid.map(row => ({
        systemName: cleanStr(f(row, "NAME")),
        sysCnt: toNum(f(row, "SYS CNT")),
        consExpUsage: toNum(f(row, "CONS USAGE", "CONS EXP USAGE")),
        consExpUsageProj: toNum(f(row, "CONS USAGE PROJ", "CONS EXP USAGE PROJ")),
        loanerExpUsage: toNum(f(row, "LOAN USAGE", "LOANER EXP USAGE")),
        loanerExpUsageProj: toNum(f(row, "LOAN USAGE PROJ", "LOANER EXP USAGE PROJ")),
        totalExpUsage: toNum(f(row, "TOT USAGE", "TOTAL EXP USAGE")),
        totalExpUsageProj: toNum(f(row, "TOT USAGE PROJ", "TOTAL EXP USAGE PROJ")),
        procCmpl: toNum(f(row, "PROC CMPL")),
        procCmplProj: toNum(f(row, "PROC CMPL PROJ")),
        effScore: toNum(f(row, "EFF SCORE")),
        effScoreProj: toNum(f(row, "EFF SCORE PROJ")),
        effPct: toNum(f(row, "EFF %", "EFF PCT")),
        effPctProj: toNum(f(row, "EFF % PROJ", "EFF PCT PROJ")),
        importedAt,
      }));
      await bulkCreate(base44.asServiceRole.entities.IEPSystemData, records);

      // Archive snapshot
      const totalUsage = records.reduce((a, r) => a + (r.totalExpUsage || 0), 0);
      const overallEffPct = totalUsage > 0
        ? (records.reduce((a, r) => a + (r.procCmpl || 0), 0) / totalUsage) * 100
        : null;
      await base44.asServiceRole.entities.IEPImportSnapshot.create({
        importBatchId: importedAt,
        importedAt,
        fileType: 'grid6',
        totalRecords: records.length,
        overallEffPct,
        records,
      });

      return Response.json({ imported: records.length, type: 'grid6' });
    }

    if (fileType === 'grid5') {
      const valid = rows.filter(r => !isJunkName(f(r, "SET NAME")));
      await deleteAll(base44.asServiceRole.entities.IEPLoanerData);
      const records = valid.map(row => {
        const loanerCmpl = toNum(f(row, "LOANER CMPL"));
        const loanerTotProj = toNum(f(row, "LOANER TOT PROJ"));
        const statusRaw = cleanStr(f(row, "STATUS"));
        const isMissing = statusRaw.toLowerCase() === "missing";
        const effPct = (loanerCmpl != null && loanerTotProj != null && loanerTotProj > 0)
          ? (loanerCmpl / loanerTotProj) * 100
          : null;
        return {
          ad: cleanStr(f(row, "AD")),
          fieldSales: cleanStr(f(row, "FIELD SALES")),
          system: cleanStr(f(row, "SYSTEM")),
          type: cleanStr(f(row, "TYPE")),
          setId: cleanStr(f(row, "SET ID")),
          setName: cleanStr(f(row, "SET NAME")),
          loanerId: cleanStr(f(row, "LOANER ID")),
          etchId: cleanStr(f(row, "ETCH ID")),
          consignmentId: cleanStr(f(row, "CONSIGNMENT ID")),
          rep: cleanStr(f(row, "REP")),
          assocRep: cleanStr(f(row, "ASSOC REP", "ASSOC. REP")),
          status: statusRaw,
          placementDate: cleanStr(f(row, "PLACEMENT DATE")),
          returnDate: cleanStr(f(row, "RETURN DATE")),
          loanerCmpl,
          loanerLast2Mo: toNum(f(row, "LOANER LAST 2 MO", "LOANER LAST 2 MO.")),
          loanerProj: toNum(f(row, "LOANER PROJ")),
          loanerTotProj,
          effPct,
          isMissing,
          importedAt,
        };
      });
      await bulkCreate(base44.asServiceRole.entities.IEPLoanerData, records);

      // Archive snapshot
      await base44.asServiceRole.entities.IEPImportSnapshot.create({
        importBatchId: importedAt,
        importedAt,
        fileType: 'grid5',
        totalRecords: records.length,
        records,
      });

      return Response.json({ imported: records.length, type: 'grid5' });
    }

    return Response.json({ error: 'Unknown fileType. Use grid5 or grid6.' }, { status: 400 });

  } catch (err) {
    console.error('importIEPFiles error:', err.message, err.stack);
    return Response.json({ error: err.message }, { status: 500 });
  }
});