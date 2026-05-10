import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Loader2, Trash2, Download, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ImportData() {
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [importResult, setImportResult] = useState(null);
  const [error, setError] = useState(null);
  const [showClearDialog, setShowClearDialog] = useState(false);
  const [isClearing, setIsClearing] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [failedRows, setFailedRows] = useState([]);
  
  // IEP Efficiency Report state
  const [iepFile, setIepFile] = useState(null);
  const [isUploadingIep, setIsUploadingIep] = useState(false);
  const [iepImportResult, setIepImportResult] = useState(null);
  const [iepError, setIepError] = useState(null);
  const [iepProgress, setIepProgress] = useState(null);

  // Missing Parts state
  const [partsFile, setPartsFile] = useState(null);
  const [isUploadingParts, setIsUploadingParts] = useState(false);
  const [partsImportResult, setPartsImportResult] = useState(null);
  const [partsError, setPartsError] = useState(null);
  const [showClearPartsDialog, setShowClearPartsDialog] = useState(false);
  const [isClearingParts, setIsClearingParts] = useState(false);
  const [partsProgress, setPartsProgress] = useState(null);
  
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
  });

  const { data: existingLoaners = [] } = useQuery({
    queryKey: ["loaners"],
    queryFn: () => base44.entities.Loaners.list(),
  });

  const { data: existingParts = [] } = useQuery({
    queryKey: ["missingParts"],
    queryFn: () => base44.entities.MissingPart.list(),
  });

  const { data: repAssignments = [] } = useQuery({
    queryKey: ["repAccountAssignments"],
    queryFn: () => base44.entities.RepAccountAssignment.list(),
  });

  const isAdmin = user?.role === "admin";

  const toCleanString = (v) => {
    if (v === null || v === undefined) return "";
    return String(v).trim();
  };

  const normalizeDueDate = (v) => {
    const s = toCleanString(v);
    if (!s) return "";

    // Excel date number
    if (/^\d+(\.\d+)?$/.test(s)) {
      const n = Number(s);
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const dt = new Date(excelEpoch.getTime() + n * 24 * 60 * 60 * 1000);
      if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
    }

    // ISO date
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

    // MM/DD/YYYY or M/D/YYYY
    const mdy = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (mdy) {
      const mm = mdy[1].padStart(2, "0");
      const dd = mdy[2].padStart(2, "0");
      const yyyy = mdy[3];
      return `${yyyy}-${mm}-${dd}`;
    }

    // Try Date.parse
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);

    return s;
  };

  const sanitizeEtchId = (v) => {
    const s = toCleanString(v);
    return s.replace(/[\u200B-\u200D\uFEFF]/g, "");
  };

  const mapRow = (raw) => {
    const set_name = toCleanString(raw["Set Name"]);
    const account = toCleanString(raw["Account Name"]);

    if (!set_name && !account) return null;

    return {
      set_name,
      account,
      etch_id: sanitizeEtchId(raw["Etch Id"]),
      rep: toCleanString(raw["Current Field Sales Name"]),
      associate_rep: toCleanString(raw["Associate Sales Rep Name"]),
      due_date: normalizeDueDate(raw["Expected Return Date"]),
    };
  };

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setImportResult(null);
      setError(null);
      setFailedRows([]);
    }
  };

  const downloadErrorReport = () => {
    if (failedRows.length === 0) return;

    const reportLines = [
      'Michigan Loaner Import - Error Report',
      `Generated: ${new Date().toLocaleString()}`,
      `Total Errors: ${failedRows.length}`,
      '',
      'Row Number | Set Name | Account | Error Details',
      '-----------|----------|---------|---------------'
    ];

    failedRows.forEach(row => {
      const setName = row.data?.set_name || '(unnamed)';
      const account = row.data?.account || '(unnamed)';
      reportLines.push(`${row.rowIndex} | ${setName} | ${account} | ${row.error}`);
    });

    const blob = new Blob([reportLines.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `import-errors-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const parseDate = (value) => {
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
  };

  const daysDiff = (from, to) => {
    const a = new Date(from.getFullYear(), from.getMonth(), from.getDate()).getTime();
    const b = new Date(to.getFullYear(), to.getMonth(), to.getDate()).getTime();
    return Math.round((b - a) / 86400000);
  };

  const makeImportKey = (setId, etchId, accountName, loanedDate) => {
    const loanedISO = loanedDate.toISOString().slice(0, 10);
    const safeAccount = accountName.replace(/\s+/g, " ").trim();
    return `${setId}__${etchId}__${safeAccount}__${loanedISO}`.toLowerCase();
  };

  const handleImport = async () => {
    if (!file || isUploading) return;

    setIsUploading(true);
    setError(null);
    setImportResult(null);
    setFailedRows([]);
    setUploadProgress(null);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
      
      // Only import from "All Pending Return" sheet
      const targetSheet = workbook.SheetNames.find(name => 
        name.toLowerCase().includes('all pending') || 
        name.toLowerCase().includes('pending return')
      );
      
      if (!targetSheet) {
        throw new Error('Could not find "All Pending Return" sheet in workbook');
      }

      const worksheet = workbook.Sheets[targetSheet];
      const allRows = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false });

      if (!allRows.length) throw new Error("No data found in 'All Pending Return' sheet");

      const normalizedRows = allRows.map((r) => {
        const out = {};
        for (const k of Object.keys(r)) {
          out[k.toString().trim().toLowerCase().replace(/\s+/g, " ")] = r[k];
        }
        return out;
      });

      const requiredHeaders = ["set id", "set name", "current field sales name", "associate sales rep name", "account name", "etch id", "loaned date", "expected return date"];
      const keyUnion = new Set();
      for (const r of normalizedRows.slice(0, 5)) {
        for (const k of Object.keys(r)) keyUnion.add(k);
      }
      const missingHeaders = requiredHeaders.filter((h) => !keyUnion.has(h));
      if (missingHeaders.length) {
        throw new Error(`Missing columns: ${missingHeaders.join(", ")}`);
      }

      const now = new Date();
      const errors = [];
      const payload = [];

      normalizedRows.forEach((r, idx) => {
        const rowNum = idx + 2;
        const setId = (r["set id"] || "").toString().trim();
        const setName = (r["set name"] || "").toString().trim();
        const fieldSalesRep = (r["current field sales name"] || "").toString().trim();
        const accountName = (r["account name"] || "").toString().trim();
        const assocRaw = (r["associate sales rep name"] || "").toString().trim();
        let repName = assocRaw || "None";

        // Look up assigned rep from RepAccountAssignment if no associate rep
        if (!assocRaw) {
          const lowerAccount = accountName.toLowerCase();
          const match = repAssignments.find(a =>
            a.accountName && lowerAccount.includes(a.accountName.toLowerCase().trim())
          );
          if (match) {
            const reps = match.assignedReps?.length ? match.assignedReps : (match.assignedRep ? [match.assignedRep] : []);
            repName = reps.join(" / ") || fieldSalesRep || "None";
          } else {
            repName = fieldSalesRep || "None";
          }
        }
        const etchId = (r["etch id"] || "").toString().trim();
        const loanedDate = parseDate(r["loaned date"]);
        const expectedReturnDate = parseDate(r["expected return date"]);

        const missing = [];
        if (!setId) missing.push("Set ID");
        if (!setName) missing.push("Set Name");
        if (!accountName) missing.push("Account Name");
        if (!etchId) missing.push("Etch Id");
        if (!loanedDate) missing.push("Loaned Date");
        if (!expectedReturnDate) missing.push("Expected Return Date");
        if (!fieldSalesRep) missing.push("Current Field Sales Name");

        if (missing.length) {
          errors.push({ rowIndex: rowNum, error: `Missing: ${missing.join(", ")}`, data: { set_name: setName } });
          return;
        }

        const daysUntilDue = daysDiff(now, expectedReturnDate);
        const isOverdue = daysUntilDue < 0;
        const daysOverdue = isOverdue ? Math.abs(daysUntilDue) : 0;
        const fineAmount = daysOverdue * 50;
        const importKey = makeImportKey(setId, etchId, accountName, loanedDate);

        payload.push({
          importKey,
          setName,
          etchId,
          accountName,
          repName,
          expectedReturnDate: expectedReturnDate.toISOString().slice(0, 10),
          fineAmount,
          isOverdue,
          setId,
          fieldSalesRep,
          loanedDate: loanedDate.toISOString().slice(0, 10),
          daysUntilDue,
          daysOverdue,
          finePerDay: 50,
          lastImportedAt: now.toISOString(),
        });
      });

      if (errors.length > 0) {
        setFailedRows(errors);
        throw new Error(`${errors.length} rows have errors`);
      }

      // Fetch ALL existing records once and build multiple lookup maps
      const allExisting = await base44.entities.Loaners.list();
      const existingMap = new Map();
      const existingBySetAccount = new Map();
      
      allExisting.forEach(e => {
        if (e?.importKey && e?.id) {
          existingMap.set(e.importKey, e.id);
        }
        // Secondary lookup to prevent duplicates
        if (e?.setId && e?.accountName && e?.id) {
          const key = `${e.setId}__${e.accountName}`.toLowerCase();
          existingBySetAccount.set(key, e.id);
        }
      });

      let created = 0;
      let updated = 0;
      let skipped = 0;
      const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

      // Process one at a time with delays to avoid rate limits
      for (let i = 0; i < payload.length; i++) {
        const rec = payload[i];
        let existingId = existingMap.get(rec.importKey);
        
        // Fallback check to prevent duplicates
        if (!existingId) {
          const fallbackKey = `${rec.setId}__${rec.accountName}`.toLowerCase();
          existingId = existingBySetAccount.get(fallbackKey);
        }
        
        let success = false;
        let retries = 0;
        const maxRetries = 3;
        
        while (!success && retries < maxRetries) {
          try {
            if (existingId) {
              await base44.entities.Loaners.update(existingId, rec);
              updated++;
            } else {
              const newRecord = await base44.entities.Loaners.create(rec);
              created++;
              existingMap.set(rec.importKey, newRecord.id);
              const fallbackKey = `${rec.setId}__${rec.accountName}`.toLowerCase();
              existingBySetAccount.set(fallbackKey, newRecord.id);
            }
            success = true;
          } catch (err) {
            retries++;
            if (retries < maxRetries) {
              await sleep(2000 * retries);
            } else {
              skipped++;
              console.error(`Failed to process record ${i + 1}:`, err);
            }
          }
        }
        
        await sleep(500);
        setUploadProgress({ current: i + 1, total: payload.length });
      }

      // --- CLEANUP: Delete loaners no longer in the spreadsheet ---
      const newImportKeySet = new Set(payload.map(p => p.importKey));
      let deleted = 0;
      for (const loaner of allExisting) {
        if (loaner.importKey && !newImportKeySet.has(loaner.importKey)) {
          try {
            await base44.entities.Loaners.delete(loaner.id);
            deleted++;
            await sleep(300);
          } catch (e) {
            console.error("Failed to delete stale loaner:", loaner.id, e);
          }
        }
      }

      // Update AppSetting with import timestamp
      const appSettings = await base44.entities.AppSetting.filter({ key: 'import_metadata' });
      if (appSettings.length > 0) {
        await base44.entities.AppSetting.update(appSettings[0].id, {
          last_imported_at: new Date().toISOString()
        });
      } else {
        await base44.entities.AppSetting.create({
          key: 'import_metadata',
          last_imported_at: new Date().toISOString()
        });
      }

      setImportResult({ success: true, created, updated, skipped, deleted, total: created + updated + skipped });
      queryClient.invalidateQueries({ queryKey: ["loaners"] });
      queryClient.invalidateQueries({ queryKey: ["appSetting"] });
      setFile(null);

    } catch (err) {
      setError(err.message || "Failed to import data");
    } finally {
      setIsUploading(false);
    }
  };



  const handleClearAll = async () => {
    setIsClearing(true);
    try {
      // Delete all existing loaners
      for (const loaner of existingLoaners) {
        await base44.entities.Loaners.delete(loaner.id);
      }
      queryClient.invalidateQueries(["loaners"]);
      setShowClearDialog(false);
    } catch (err) {
      setError("Failed to clear existing data");
    } finally {
      setIsClearing(false);
    }
  };

  const handleClearParts = async () => {
    setIsClearingParts(true);
    try {
      for (const part of existingParts) {
        await base44.entities.MissingPart.delete(part.id);
      }
      queryClient.invalidateQueries(["missingParts"]);
      setShowClearPartsDialog(false);
    } catch (err) {
      setPartsError("Failed to clear parts data");
    } finally {
      setIsClearingParts(false);
    }
  };

  const handlePartsFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setPartsFile(selectedFile);
      setPartsImportResult(null);
      setPartsError(null);
    }
  };

  const handleImportParts = async () => {
    if (!partsFile || isUploadingParts) return;

    setIsUploadingParts(true);
    setPartsError(null);
    setPartsImportResult(null);
    setPartsProgress(null);

    try {
      const arrayBuffer = await partsFile.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });

      const allRows = [];
      for (const sheetName of workbook.SheetNames) {
        const worksheet = workbook.Sheets[sheetName];
        const sheetData = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false });
        allRows.push(...sheetData);
      }

      if (!allRows.length) throw new Error("No data found in file");

      const normalizedRows = allRows.map((r) => {
        const out = {};
        for (const k of Object.keys(r)) {
          out[k.toString().trim().toLowerCase().replace(/\s+/g, " ")] = r[k];
        }
        return out;
      });

      const payload = [];
      const errors = [];

      // First, fetch all loaners to lookup field sales reps
      const allLoaners = await base44.entities.Loaners.list();

      normalizedRows.forEach((r, idx) => {
        const rowNum = idx + 2;
        let repName = (r["assoc.rep"] || r["assoc. rep"] || r["associate rep"] || r["assoc rep"] || r["rep name"] || "").toString().trim();
        const partName = (r["part description"] || r["part name"] || r["part"] || "").toString().trim();
        const partNumber = (r["part/set #"] || r["part number"] || r["part #"] || "").toString().trim();
        const loanerSetName = (r["set name"] || r["loaner"] || r["loaner set"] || "").toString().trim();
        const etchId = (r["etch id"] || r["etch"] || "").toString().trim();
        const missingDate = parseDate(r["deduction date"] || r["date"] || r["missing date"]);

        // Try multiple column name variations for charges
        const chargeRaw = r["total charge"] || r["charge per part"] || r["fine"] || r["fine amount"] || r["charge"] || r["amount"] || "0";
        const chargeStr = chargeRaw.toString().trim().replace(/[$,]/g, "");
        const fineAmount = parseFloat(chargeStr) || 0;

        const requestNumber = (r["request #"] || r["request number"] || "").toString().trim();
        const partSetNumber = partNumber;
        const deductionDate = missingDate ? missingDate.toISOString().slice(0, 10) : null;
        const missingQuantity = parseInt(r["missing qty"] || r["quantity"] || 1) || 1;

        // If no associate rep, try to find field sales rep from matching loaner
        if (!repName && (loanerSetName || etchId)) {
          const matchingLoaner = allLoaners.find(l => 
            (loanerSetName && l.setName === loanerSetName) || 
            (etchId && l.etchId === etchId)
          );
          if (matchingLoaner) {
            repName = matchingLoaner.fieldSalesRep || matchingLoaner.repName || "";
          }
        }

        // Default rep for My Midmichigan account
        if (!repName && loanerSetName) {
          const lowerSetName = loanerSetName.toLowerCase();
          if (lowerSetName.includes("my midmichigan") || lowerSetName.includes("midmichigan")) {
            repName = "Jason Carter";
          }
        }

        const missing = [];
        if (!partName) missing.push("Part Description");
        if (!missingDate) missing.push("Deduction Date");
        if (!missingQuantity || missingQuantity < 1) missing.push("Missing Qty");

        if (missing.length) {
          errors.push({ row: rowNum, error: `Missing: ${missing.join(", ")}` });
          return;
        }

        // Robust unique key — combines all stable identifiers to prevent duplicates
        const uniqueKey = [
          requestNumber || 'none',
          partSetNumber || partNumber || 'none',
          deductionDate || 'none',
          etchId || 'none',
          (partName || 'none').slice(0, 30),
        ].join('__').toLowerCase();

        payload.push({
          uniqueKey,
          repName,
          partName,
          partNumber,
          loanerSetName,
          etchId,
          missingDate: missingDate.toISOString().slice(0, 10),
          fineAmount: fineAmount || 0,
          status: "missing",
          requestNumber,
          partSetNumber,
          deductionDate,
          missingQuantity
        });
      });

      if (errors.length > 0) {
        throw new Error(`${errors.length} rows have errors: ${errors.map(e => `Row ${e.row}: ${e.error}`).join("; ")}`);
      }

      // Fetch all existing parts and build lookup map, deduplicating in the process
      const allExisting = await base44.entities.MissingPart.list();
      const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

      // Group all existing records by their computed key
      const keyToIds = new Map();
      allExisting.forEach(e => {
        const key = `${e.requestNumber || 'none'}__${e.partSetNumber || 'none'}__${e.deductionDate || 'none'}__${(e.partName || 'none').slice(0, 20)}`.toLowerCase();
        if (!keyToIds.has(key)) keyToIds.set(key, []);
        keyToIds.get(key).push(e.id);
      });

      // Build existingMap keeping only the first record per key; delete extra duplicates
      const existingMap = new Map();
      for (const [key, ids] of keyToIds.entries()) {
        existingMap.set(key, ids[0]);
        for (let i = 1; i < ids.length; i++) {
          try { await base44.entities.MissingPart.delete(ids[i]); } catch (_) {}
          await sleep(200);
        }
      }

      let created = 0;
      let updated = 0;

      for (let i = 0; i < payload.length; i++) {
        const rec = payload[i];
        const existingId = existingMap.get(rec.uniqueKey);
        const { uniqueKey, ...recordData } = rec;

        let success = false;
        let retries = 0;
        const maxRetries = 5;
        while (!success && retries < maxRetries) {
          try {
            if (existingId) {
              await base44.entities.MissingPart.update(existingId, recordData);
              updated++;
            } else {
              const newRecord = await base44.entities.MissingPart.create(recordData);
              created++;
              existingMap.set(rec.uniqueKey, newRecord.id);
            }
            success = true;
          } catch (err) {
            retries++;
            if (retries < maxRetries) {
              await sleep(2000 * retries);
            } else {
              console.error(`Failed to process part ${i + 1}:`, err);
            }
          }
        }

        setPartsProgress({ current: i + 1, total: payload.length });
        await sleep(500);
      }

      // Delete stale parts no longer in the spreadsheet
      const newKeySet = new Set(payload.map(p => p.uniqueKey));
      let deleted = 0;
      for (const [key, id] of existingMap.entries()) {
        if (!newKeySet.has(key)) {
          try { await base44.entities.MissingPart.delete(id); deleted++; } catch (_) {}
          await sleep(200);
        }
      }

      setPartsImportResult({ success: true, created, updated, deleted, total: created + updated });
      queryClient.invalidateQueries({ queryKey: ["missingParts"] });
      setPartsFile(null);

    } catch (err) {
      setPartsError(err.message || "Failed to import parts data");
    } finally {
      setIsUploadingParts(false);
    }
  };

  const toNum = (v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = parseFloat(String(v).replace(/[,%]/g, "").trim());
    return isNaN(n) ? null : n;
  };

  const handleIepImport = async () => {
    if (!iepFile || isUploadingIep) return;
    setIsUploadingIep(true);
    setIepError(null);
    setIepImportResult(null);
    setIepProgress("Reading file...");
    const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));
    try {
      const importedAt = new Date().toISOString();
      let records = [];

      const isPdf = iepFile.name.toLowerCase().endsWith(".pdf");

      if (isPdf) {
        setIepProgress("Uploading PDF...");
        const { file_url } = await base44.integrations.Core.UploadFile({ file: iepFile });
        setIepProgress("Extracting data from PDF (this may take a moment)...");
        const extracted = await base44.integrations.Core.ExtractDataFromUploadedFile({
          file_url,
          json_schema: {
            type: "object",
            properties: {
              overallScore: { type: "number", description: "The large bold OVERALL SCORE number shown in the top-right corner of the scorecard (e.g. 95.3)" },
              rows: {
                type: "array",
                description: "Every data row from the table. Columns are: Set ID, Set Name, Cons Exp Usage Proj, Loaner Exp Usage Proj, Total Exp Usage Proj, Proc Cmpl Proj, Eff Proj",
                items: {
                  type: "object",
                  properties: {
                    setId: { type: "string", description: "Set ID column" },
                    setName: { type: "string", description: "Set Name column" },
                    consExpUsageProj: { type: "number", description: "Cons Exp Usage Proj column" },
                    loanerExpUsageProj: { type: "number", description: "Loaner Exp Usage Proj column" },
                    totalExpUsageProj: { type: "number", description: "Total Exp Usage Proj column" },
                    procCmplProj: { type: "number", description: "Proc Cmpl Proj column" },
                    effPctProj: { type: "number", description: "Eff Proj column (the efficiency percentage)" },
                  }
                }
              }
            }
          }
        });

        if (!extracted?.output?.rows?.length) {
          throw new Error("Could not extract rows from PDF. Make sure it is the IEP Efficiency Scorecard.");
        }

        const overallScore = extracted.output.overallScore ?? null;
        const scorecardRows = extracted.output.rows;
        records = scorecardRows.map(row => ({
          systemName: row.setName || "",
          sysCnt: null,
          consExpUsage: null,
          consExpUsageProj: row.consExpUsageProj ?? null,
          loanerExpUsage: null,
          loanerExpUsageProj: row.loanerExpUsageProj ?? null,
          totalExpUsage: null,
          totalExpUsageProj: row.totalExpUsageProj ?? null,
          procCmpl: null,
          procCmplProj: row.procCmplProj ?? null,
          effScore: null,
          effScoreProj: overallScore,
          effPct: null,
          effPctProj: row.effPctProj ?? null,
          importedAt,
        }));
      } else {
        const arrayBuffer = await iepFile.arrayBuffer();
        const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
        const worksheet = workbook.Sheets[workbook.SheetNames[0]];
        const allRows = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false });
        const validRows = allRows.filter((r) => r["Name"] && String(r["Name"]).trim() !== "");
        if (!validRows.length) throw new Error("No valid rows found. Make sure the sheet has a 'Name' column.");
        records = validRows.map(row => ({
          systemName: String(row["Name"]).trim(),
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
      }

      setIepProgress("Clearing existing IEP data...");
      const existing = await base44.entities.IEPSystemData.list();
      for (let i = 0; i < existing.length; i += 5) {
        await Promise.all(existing.slice(i, i + 5).map(r => base44.entities.IEPSystemData.delete(r.id)));
        await sleep(300);
      }

      setIepProgress(`Saving ${records.length} records...`);
      for (let i = 0; i < records.length; i += 50) {
        await base44.entities.IEPSystemData.bulkCreate(records.slice(i, i + 50));
        if (i + 50 < records.length) await sleep(300);
      }

      setIepImportResult(records.length);
      setIepFile(null);
    } catch (err) {
      setIepError(err.message || "Import failed.");
    } finally {
      setIsUploadingIep(false);
      setIepProgress(null);
    }
  };

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Admin access required</p>
          <p className="text-sm text-slate-500 mt-1">Only admins can import data</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Import Data
          </h1>
          <p className="text-slate-500 mt-1">
            Upload the daily loaner spreadsheet to update records
          </p>
        </div>

        {/* Current Data Status */}
        <div className="grid md:grid-cols-2 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Loaner Records</p>
                <p className="text-2xl font-bold text-slate-900">{existingLoaners.length}</p>
              </div>
              {existingLoaners.length > 0 && (
                <Button 
                  variant="outline" 
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => setShowClearDialog(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              )}
            </div>
          </div>
          <div className="bg-white rounded-xl border border-slate-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-500">Missing Parts</p>
                <p className="text-2xl font-bold text-slate-900">{existingParts.length}</p>
              </div>
              {existingParts.length > 0 && (
                <Button 
                  variant="outline" 
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => setShowClearPartsDialog(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Upload Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-lg bg-indigo-100">
              <FileSpreadsheet className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Upload Spreadsheet</h2>
              <p className="text-sm text-slate-500">CSV or Excel file</p>
            </div>
          </div>

          {/* Column Mapping Info */}
          <div className="bg-slate-50 rounded-lg p-4 mb-6">
            <p className="text-sm font-medium text-slate-700 mb-2">Column Mapping:</p>
            <div className="space-y-2 text-xs text-slate-600">
              <div className="flex items-center justify-between">
                <span>Set Name</span>
                <span className="text-slate-400">→ set_name <span className="text-red-600">*</span></span>
              </div>
              <div className="flex items-center justify-between">
                <span>Account Name</span>
                <span className="text-slate-400">→ account <span className="text-red-600">*</span></span>
              </div>
              <div className="flex items-center justify-between">
                <span>Etch Id</span>
                <span className="text-slate-400">→ etch_id</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Current Field Sales Name</span>
                <span className="text-slate-400">→ rep</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Associate Sales Rep Name</span>
                <span className="text-slate-400">→ associate_rep</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Expected Return Date</span>
                <span className="text-slate-400">→ due_date</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3"><span className="text-red-600">*</span> Required. Other columns ignored. Invalid dates stored as text. Extra columns not imported.</p>
          </div>

          {/* File Input */}
          <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center hover:border-indigo-300 transition-colors">
            <Upload className="w-10 h-10 text-slate-400 mx-auto mb-4" />
            <Input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="hidden"
              id="file-upload"
            />
            <label 
              htmlFor="file-upload" 
              className="cursor-pointer text-indigo-600 hover:text-indigo-700 font-medium"
            >
              Choose a file
            </label>
            <p className="text-sm text-slate-500 mt-2">or drag and drop</p>
            
            {file && (
              <div className="mt-4 p-3 bg-slate-100 rounded-lg inline-flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">{file.name}</span>
              </div>
            )}
          </div>



          {/* Error Alert */}
           {error && (
             <Alert variant="destructive" className="mt-4">
               <AlertCircle className="h-4 w-4" />
               <AlertDescription>{error}</AlertDescription>
             </Alert>
           )}

           {/* Failed Rows */}
           {failedRows.length > 0 && (
             <div className="mt-4 p-4 bg-red-50 rounded-lg border border-red-200">
               <div className="flex items-center justify-between mb-3">
                 <p className="text-sm font-semibold text-red-900">
                   {failedRows.length} row{failedRows.length !== 1 ? 's' : ''} failed validation
                 </p>
                 <Button 
                   variant="outline" 
                   size="sm"
                   onClick={downloadErrorReport}
                   className="text-red-700 hover:text-red-800 hover:bg-red-100 border-red-300"
                 >
                   <Download className="w-3 h-3 mr-1.5" />
                   Download Report
                 </Button>
               </div>
               <div className="space-y-2 max-h-60 overflow-y-auto bg-white rounded p-3">
                 {failedRows.map((row, idx) => (
                   <div key={idx} className="text-xs border-l-2 border-red-400 pl-3 py-1">
                     <span className="font-semibold text-red-900">Row {row.rowIndex}:</span>
                     <span className="text-red-700 ml-2">{row.error}</span>
                     {row.data?.set_name && (
                       <span className="text-gray-600 ml-2">({row.data.set_name})</span>
                     )}
                   </div>
                 ))}
               </div>
               <p className="text-xs text-red-700 mt-3 italic">
                 Fix the errors above and re-upload the file
               </p>
             </div>
           )}

          {/* Success Alert */}
          {importResult?.success && (
            <Alert className="mt-4 border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Successfully processed {importResult.total} records
                {importResult.created > 0 && ` (${importResult.created} created)`}
                {importResult.updated > 0 && ` (${importResult.updated} updated)`}
                {importResult.skipped > 0 && ` (${importResult.skipped} skipped due to errors)`}
                {importResult.deleted > 0 && ` (${importResult.deleted} removed — no longer in spreadsheet)`}
              </AlertDescription>
            </Alert>
          )}

          {/* Import Progress */}
          {uploadProgress && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
                <span>Processing records...</span>
                <span>{uploadProgress.current} / {uploadProgress.total}</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div 
                  className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Import Button */}
           <Button 
             className="w-full mt-6 h-11"
             onClick={handleImport}
             disabled={!file || isUploading}
           >
             {isUploading ? (
               <>
                 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                 Importing...
               </>
             ) : (
               <>
                 <Upload className="w-4 h-4 mr-2" />
                 Import Data
               </>
             )}
           </Button>
        </div>

        {/* Missing Parts Upload */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mt-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-lg bg-orange-100">
              <FileSpreadsheet className="w-5 h-5 text-orange-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Upload Missing Parts</h2>
              <p className="text-sm text-slate-500">Separate spreadsheet for missing parts</p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 mb-6">
            <p className="text-sm font-medium text-slate-700 mb-2">Expected Columns:</p>
            <div className="space-y-2 text-xs text-slate-600">
              <div>Assoc.Rep - Will use Field Sales Rep if missing</div>
              <div className="flex items-center justify-between">
                <span>Part Description</span>
                <span className="text-red-600">* Required</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Deduction Date</span>
                <span className="text-red-600">* Required</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Missing Qty</span>
                <span className="text-red-600">* Required</span>
              </div>
              <div>Request # - Used for unique identifier</div>
              <div>Part/Set # - Used for unique identifier</div>
              <div>Set Name - Used to find loaner's field rep</div>
              <div>Etch ID - Used to find loaner's field rep</div>
              <div>Total Charge - Used for fine amount</div>
            </div>
          </div>

          <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center hover:border-orange-300 transition-colors">
            <Upload className="w-10 h-10 text-slate-400 mx-auto mb-4" />
            <Input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handlePartsFileChange}
              className="hidden"
              id="parts-file-upload"
            />
            <label 
              htmlFor="parts-file-upload" 
              className="cursor-pointer text-orange-600 hover:text-orange-700 font-medium"
            >
              Choose a file
            </label>
            <p className="text-sm text-slate-500 mt-2">or drag and drop</p>

            {partsFile && (
              <div className="mt-4 p-3 bg-slate-100 rounded-lg inline-flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">{partsFile.name}</span>
              </div>
            )}
          </div>

          {partsError && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{partsError}</AlertDescription>
            </Alert>
          )}

          {partsImportResult?.success && (
            <Alert className="mt-4 border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Successfully processed {partsImportResult.total} missing parts
                {partsImportResult.created > 0 && ` (${partsImportResult.created} created)`}
                {partsImportResult.updated > 0 && ` (${partsImportResult.updated} updated)`}
                {partsImportResult.deleted > 0 && ` (${partsImportResult.deleted} removed — no longer in spreadsheet)`}
              </AlertDescription>
            </Alert>
          )}

          {partsProgress && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm text-slate-600 mb-2">
                <span>Processing parts...</span>
                <span>{partsProgress.current} / {partsProgress.total}</span>
              </div>
              <div className="w-full bg-slate-200 rounded-full h-2">
                <div
                  className="bg-orange-500 h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(partsProgress.current / partsProgress.total) * 100}%` }}
                />
              </div>
            </div>
          )}

          <Button 
            className="w-full mt-6 h-11 bg-orange-600 hover:bg-orange-700"
            onClick={handleImportParts}
            disabled={!partsFile || isUploadingParts}
          >
            {isUploadingParts ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4 mr-2" />
                Import Missing Parts
              </>
            )}
          </Button>
        </div>

        {/* IEP Efficiency Import */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mt-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2.5 rounded-lg bg-purple-100">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <h2 className="font-semibold text-slate-900">Upload IEP Efficiency Report</h2>
              <p className="text-sm text-slate-500">PDF Scorecard or Globus Grid 6 Excel (.xlsx)</p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 mb-6 text-xs text-slate-600 space-y-1">
            <p className="font-medium text-slate-700 mb-1">Accepted formats:</p>
            <p><span className="font-medium">PDF Scorecard</span> — IEP Efficiency Scorecard PDF (Set ID, Set Name, Cons/Loaner Exp Usage Proj, Proc Cmpl Proj, Eff Proj)</p>
            <p><span className="font-medium">Excel (Grid 6)</span> — Columns: Name, Sys Cnt, Cons/Loaner Exp Usage, Proc Cmpl, Eff %, Eff Score…</p>
            <p className="text-slate-400 italic mt-1">Each import fully replaces all previous IEP system records.</p>
          </div>

          <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center hover:border-purple-300 transition-colors">
            <TrendingUp className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <Input
              type="file"
              accept=".xlsx,.pdf"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { setIepFile(f); setIepImportResult(null); setIepError(null); } }}
              className="hidden"
              id="iep-file-upload"
            />
            <label htmlFor="iep-file-upload" className="cursor-pointer text-purple-600 hover:text-purple-700 font-medium">
              Choose file (.xlsx or .pdf)
            </label>
            <p className="text-sm text-slate-500 mt-2">or drag and drop</p>
            {iepFile && (
              <div className="mt-4 p-3 bg-slate-100 rounded-lg inline-flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-medium text-slate-700">{iepFile.name}</span>
              </div>
            )}
          </div>

          {iepProgress && (
            <div className="flex items-center gap-2 text-sm text-slate-600 mt-4">
              <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
              <span>{iepProgress}</span>
            </div>
          )}

          {iepImportResult !== null && (
            <Alert className="mt-4 border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                {iepImportResult} systems imported successfully. IEP Dashboard is now updated.
              </AlertDescription>
            </Alert>
          )}

          {iepError && (
            <Alert variant="destructive" className="mt-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{iepError}</AlertDescription>
            </Alert>
          )}

          <Button
            className="w-full mt-6 h-11 bg-purple-600 hover:bg-purple-700"
            onClick={handleIepImport}
            disabled={!iepFile || isUploadingIep}
          >
            {isUploadingIep ? (
              <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importing...</>
            ) : (
              <><TrendingUp className="w-4 h-4 mr-2" />Import IEP Data</>
            )}
          </Button>
        </div>

        {/* Clear Confirmation Dialog */}
        <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Clear All Loaners?</DialogTitle>
              <DialogDescription>
                This will permanently delete all {existingLoaners.length} loaner records. 
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowClearDialog(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleClearAll}
                disabled={isClearing}
              >
                {isClearing ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  "Clear All"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Clear Parts Confirmation Dialog */}
        <Dialog open={showClearPartsDialog} onOpenChange={setShowClearPartsDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Clear All Missing Parts?</DialogTitle>
              <DialogDescription>
                This will permanently delete all {existingParts.length} missing part records. 
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowClearPartsDialog(false)}>
                Cancel
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleClearParts}
                disabled={isClearingParts}
              >
                {isClearingParts ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Clearing...
                  </>
                ) : (
                  "Clear All"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}