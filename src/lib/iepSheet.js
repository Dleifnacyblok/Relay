import * as XLSX from "xlsx";

// Normalize a header label so column names match regardless of case/spacing/punctuation
export const iepNormKey = (v) =>
  String(v ?? "")
    .replace(/\u00a0/g, " ")
    .toUpperCase()
    .replace(/%/g, " PCT ")
    .replace(/[^A-Z0-9]+/g, " ")
    .trim();

// IEP exports often start with title/banner rows above the real header row
function findHeaderRow(aoa) {
  for (let i = 0; i < Math.min(aoa.length, 20); i++) {
    const keys = (aoa[i] || []).map(iepNormKey);
    if (keys.includes("NAME") || keys.includes("SET NAME") || keys.includes("TAG ID")) return i;
  }
  return -1;
}

// Parse an IEP sheet into rows keyed by normalized header names
export function parseIepSheet(worksheet) {
  const aoa = XLSX.utils.sheet_to_json(worksheet, {
    header: 1,
    defval: "",
    raw: false,
    blankrows: false,
  });
  const headerIdx = findHeaderRow(aoa);
  if (headerIdx < 0) return [];
  const headers = (aoa[headerIdx] || []).map(iepNormKey);
  return aoa.slice(headerIdx + 1).map((cells) => {
    const row = {};
    headers.forEach((h, i) => {
      if (h) row[h] = cells?.[i] ?? "";
    });
    return row;
  });
}

// Read a field by any of its known header spellings
export const iepField = (row, ...aliases) => {
  for (const alias of aliases) {
    const v = row[iepNormKey(alias)];
    if (v !== undefined && v !== null && String(v).trim() !== "") return v;
  }
  return "";
};

// Skip total/footer rows that are not real systems
export const isJunkIepName = (name) => {
  const s = String(name ?? "").replace(/\u00a0/g, "").trim().toLowerCase();
  if (!s) return true;
  if (s === "name" || s === "set name") return true;
  if (s.startsWith("grand total")) return true;
  if (/^\d+\s+rows?$/.test(s)) return true;
  return false;
};

const toNum = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const n = parseFloat(String(v).replace(/[,%]/g, "").trim());
  return isNaN(n) ? null : n;
};

// Build IEPSystemData records from a Grid 6 / Efficiency Scorecard sheet.
// Accepts both the new scorecard columns (NAME, SYS CNT, CONS USAGE, …) and the older export.
export function buildIepSystemRecords(worksheet, importedAt) {
  return parseIepSheet(worksheet)
    .filter((row) => !isJunkIepName(iepField(row, "NAME")))
    .map((row) => ({
      systemName: String(iepField(row, "NAME")).replace(/\u00a0/g, "").trim(),
      sysCnt: toNum(iepField(row, "SYS CNT")),
      consExpUsage: toNum(iepField(row, "CONS USAGE", "CONS EXP USAGE")),
      consExpUsageProj: toNum(iepField(row, "CONS USAGE PROJ", "CONS EXP USAGE PROJ")),
      loanerExpUsage: toNum(iepField(row, "LOAN USAGE", "LOANER EXP USAGE")),
      loanerExpUsageProj: toNum(iepField(row, "LOAN USAGE PROJ", "LOANER EXP USAGE PROJ")),
      totalExpUsage: toNum(iepField(row, "TOT USAGE", "TOTAL EXP USAGE")),
      totalExpUsageProj: toNum(iepField(row, "TOT USAGE PROJ", "TOTAL EXP USAGE PROJ")),
      procCmpl: toNum(iepField(row, "PROC CMPL")),
      procCmplProj: toNum(iepField(row, "PROC CMPL PROJ")),
      effScore: toNum(iepField(row, "EFF SCORE")),
      effScoreProj: toNum(iepField(row, "EFF SCORE PROJ")),
      effPct: toNum(iepField(row, "EFF %", "EFF PCT")),
      effPctProj: toNum(iepField(row, "EFF % PROJ", "EFF PCT PROJ")),
      importedAt,
    }));
}