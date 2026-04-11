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
    const rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
    const importedAt = new Date().toISOString();

    if (fileType === 'grid6') {
      const valid = rows.filter(r => cleanStr(r["Name"]));
      await deleteAll(base44.asServiceRole.entities.IEPSystemData);
      const records = valid.map(row => ({
        systemName: cleanStr(row["Name"]),
        sysCnt: toNum(row["Sys Cnt"]),
        consExpUsage: toNum(row["Cons Exp Usage"]),
        consExpUsageProj: toNum(row["Cons Exp Usage Proj"]),
        loanerExpUsage: toNum(row["Loaner Exp Usage"]),
        loanerExpUsageProj: toNum(row["Loaner Exp Usage Proj"]),
        totalExpUsage: toNum(row["Total Exp Usage"]),
        totalExpUsageProj: toNum(row["Total Exp Usage Proj"]),
        procCmpl: toNum(row["Proc Cmpl"]),
        procCmplProj: toNum(row["Proc Cmpl Proj"]),
        effScore: toNum(row["Eff Score"]),
        effScoreProj: toNum(row["Eff Score Proj"]),
        effPct: toNum(row["Eff %"]),
        effPctProj: toNum(row["Eff % Proj"]),
        importedAt,
      }));
      await bulkCreate(base44.asServiceRole.entities.IEPSystemData, records);
      return Response.json({ imported: records.length, type: 'grid6' });
    }

    if (fileType === 'grid5') {
      const valid = rows.filter(r => cleanStr(r["Set Name"]));
      await deleteAll(base44.asServiceRole.entities.IEPLoanerData);
      const records = valid.map(row => {
        const loanerCmpl = toNum(row["Loaner Cmpl"]);
        const loanerTotProj = toNum(row["Loaner Tot Proj"]);
        const statusRaw = cleanStr(row["Status"]);
        const isMissing = statusRaw.toLowerCase() === "missing";
        const effPct = (loanerCmpl != null && loanerTotProj != null && loanerTotProj > 0)
          ? (loanerCmpl / loanerTotProj) * 100
          : null;
        return {
          ad: cleanStr(row["AD"]),
          fieldSales: cleanStr(row["Field Sales"]),
          system: cleanStr(row["System"]),
          type: cleanStr(row["Type"]),
          setId: cleanStr(row["Set Id"]),
          setName: cleanStr(row["Set Name"]),
          loanerId: cleanStr(row["Loaner Id"]),
          etchId: cleanStr(row["Etch Id"]),
          consignmentId: cleanStr(row["Consignment ID"]),
          rep: cleanStr(row["Rep"]),
          assocRep: cleanStr(row["Assoc. Rep"]),
          status: statusRaw,
          placementDate: cleanStr(row["Placement Date"]),
          returnDate: cleanStr(row["Return Date"]),
          loanerCmpl,
          loanerLast2Mo: toNum(row["Loaner Last 2 Mo."]),
          loanerProj: toNum(row["Loaner Proj"]),
          loanerTotProj,
          effPct,
          isMissing,
          importedAt,
        };
      });
      await bulkCreate(base44.asServiceRole.entities.IEPLoanerData, records);
      return Response.json({ imported: records.length, type: 'grid5' });
    }

    return Response.json({ error: 'Unknown fileType. Use grid5 or grid6.' }, { status: 400 });

  } catch (err) {
    console.error('importIEPFiles error:', err.message, err.stack);
    return Response.json({ error: err.message }, { status: 500 });
  }
});