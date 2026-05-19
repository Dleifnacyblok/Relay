import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Loader2, Trash2, Download, TrendingUp, Clock, Mail, RefreshCcw } from "lucide-react";
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

  // Auto-import and drag-zone state
  const [isAutoImporting, setIsAutoImporting] = useState(false);
  const [autoImportResult, setAutoImportResult] = useState(null);
  const [dragZone, setDragZone] = useState(null); // 'loaners' | 'parts' | 'iep' | null

  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
  });

  const fetchAllPages = async (entity) => {
    const all = [];
    let skip = 0;
    const pageSize = 100;
    while (true) {
      const page = await entity.list(undefined, pageSize, skip);
      all.push(...page);
      if (page.length < pageSize) break;
      skip += pageSize;
    }
    return all;
  };

  const { data: existingLoaners = [] } = useQuery({
    queryKey: ["loaners"],
    queryFn: () => fetchAllPages(base44.entities.Loaners),
  });

  const { data: existingParts = [] } = useQuery({
    queryKey: ["missingParts"],
    queryFn: () => fetchAllPages(base44.entities.MissingPart),
  });

  const { data: repAssignments = [] } = useQuery({
    queryKey: ["repAccountAssignments"],
    queryFn: () => fetchAllPages(base44.entities.RepAccountAssignment),
  });

  const { data: appSettings = [] } = useQuery({
    queryKey: ["appSetting", "import_metadata"],
    queryFn: () => base44.entities.AppSetting.filter({ key: "import_metadata" }),
  });
  const lastImportedAt = appSettings[0]?.last_imported_at || null;

  const handleAutoImport = async () => {
    if (isAutoImporting) return;
    setIsAutoImporting(true);
    setAutoImportResult(null);
    try {
      const result = await base44.functions.invoke("autoImportFromGmail");
      setAutoImportResult({ success: true, ...(result || {}) });
      queryClient.invalidateQueries({ queryKey: ["loaners"] });
      queryClient.invalidateQueries({ queryKey: ["appSetting", "import_metadata"] });
    } catch (err) {
      setAutoImportResult({ success: false, error: err?.message || "Auto-import failed." });
    } finally {
      setIsAutoImporting(false);
    }
  };

  // Shared drag-and-drop handlers. Each zone shares a single dragZone state
  // so visual feedback is exclusive (only one zone highlights at a time).
  const handleDragOver = (e) => e.preventDefault();
  const handleDragEnter = (zone) => (e) => {
    e.preventDefault();
    setDragZone(zone);
  };
  const handleDragLeave = () => setDragZone(null);
  const handleDrop = (zone, setSelectedFile, clearResults) => (e) => {
    e.preventDefault();
    setDragZone(null);
    const dropped = e.dataTransfer?.files?.[0];
    if (dropped) {
      setSelectedFile(dropped);
      if (clearResults) clearResults();
    }
  };

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

  const saveAnalyticsSnapshot = async (trigger) => {
    const [allLoaners, allParts] = await Promise.all([
      fetchAllPages(base44.entities.Loaners),
      fetchAllPages(base44.entities.MissingPart),
    ]);

    const now = new Date();
    const overdueCount = allLoaners.filter(l => l.isOverdue).length;
    const dueSoonCount = allLoaners.filter(l => {
      if (l.isOverdue) return false;
      return (l.daysUntilDue != null) && l.daysUntilDue <= 7;
    }).length;
    const totalFines = allLoaners.reduce((s, l) => s + (l.fineAmount || 0), 0);
    const activeMissingParts = allParts.filter(p => p.status === "missing").length;
    const totalMissingPartFines = allParts.reduce((s, p) => s + (p.fineAmount || 0), 0);

    // Overdue by rep
    const repMap = {};
    allLoaners.forEach(l => {
      const rep = l.repName || "Unknown";
      if (!repMap[rep]) repMap[rep] = { rep, overdue: 0, total: 0, fines: 0 };
      repMap[rep].total++;
      if (l.isOverdue) repMap[rep].overdue++;
      repMap[rep].fines += l.fineAmount || 0;
    });
    const overdueByRep = Object.values(repMap).sort((a, b) => b.overdue - a.overdue).slice(0, 10);
    const finesByRep = Object.values(repMap).filter(r => r.fines > 0).sort((a, b) => b.fines - a.fines).slice(0, 8).map(r => ({ rep: r.rep, fines: r.fines }));

    // Top overdue sets
    const setMap = {};
    allLoaners.forEach(l => {
      const s = l.setName || "Unknown";
      if (!setMap[s]) setMap[s] = { setName: s, overdue: 0, total: 0, fines: 0 };
      setMap[s].total++;
      if (l.isOverdue) setMap[s].overdue++;
      setMap[s].fines += l.fineAmount || 0;
    });
    const topOverdueSets = Object.values(setMap).filter(s => s.overdue > 0).sort((a, b) => b.overdue - a.overdue).slice(0, 10);

    // Top missing parts
    const partCounts = {};
    allParts.filter(p => p.status === "missing").forEach(p => {
      const name = p.partName || "Unknown";
      partCounts[name] = (partCounts[name] || 0) + (p.missingQuantity || 1);
    });
    const topMissingParts = Object.entries(partCounts).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8);

    await base44.entities.AnalyticsSnapshot.create({
      snapshotDate: now.toISOString().slice(0, 10),
      importedAt: now.toISOString(),
      trigger,
      totalLoaners: allLoaners.length,
      overdueCount,
      overdueRate: allLoaners.length > 0 ? Math.round(overdueCount / allLoaners.length * 100) : 0,
      dueSoonCount,
      totalFines,
      activeMissingParts,
      totalMissingPartFines,
      overdueByRep,
      finesByRep,
      topOverdueSets,
      topMissingParts,
    });
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

      const requiredHeaders = ["set id", "set name", "current field sales name", "account name", "etch id", "loaned date", "expected return date"];
      const keyUnion = new Set();
      for (const r of normalizedRows) {
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
        const assocRawVal = r["associate sales rep name"];
        const assocRaw = (assocRawVal == null || assocRawVal === "None") ? "" : assocRawVal.toString().trim();
        let repName = assocRaw || "None";

        // Look up assigned rep from RepAccountAssignment if no associate rep
        if (!assocRaw) {
          const normalize = (s) => s.toLowerCase().replace(/[.\-,]/g, ' ').replace(/\s+/g, ' ').trim();
          const normalizedAccount = normalize(accountName);
          const match = repAssignments.find(a => {
            if (!a.accountName) return false;
            const normalizedAssignment = normalize(a.accountName);
            return normalizedAccount.includes(normalizedAssignment) || normalizedAssignment.includes(normalizedAccount);
          });
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
        // Don't block — warn and continue with valid rows
      }

      if (payload.length === 0) {
        throw new Error("No valid rows to import after validation.");
      }

      // Fetch ALL existing records once and build multiple lookup maps
      const allExisting = await fetchAllPages(base44.entities.Loaners);
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

      // Split payload into new records (bulk create) and existing (batch update)
      const toCreate = [];
      const toUpdate = [];
      for (const rec of payload) {
        let existingId = existingMap.get(rec.importKey);
        if (!existingId) {
          const fallbackKey = `${rec.setId}__${rec.accountName}`.toLowerCase();
          existingId = existingBySetAccount.get(fallbackKey);
        }
        if (existingId) {
          toUpdate.push({ id: existingId, data: rec });
        } else {
          toCreate.push(rec);
        }
      }

      // Bulk create new records in batches of 50
      const CREATE_BATCH = 50;
      for (let i = 0; i < toCreate.length; i += CREATE_BATCH) {
        const batch = toCreate.slice(i, i + CREATE_BATCH);
        try {
          await base44.entities.Loaners.bulkCreate(batch);
          created += batch.length;
        } catch (err) {
          // Fall back to individual creates for this batch
          for (const rec of batch) {
            try {
              await base44.entities.Loaners.create(rec);
              created++;
            } catch (e) {
              skipped++;
            }
          }
        }
        setUploadProgress({ current: Math.min(i + CREATE_BATCH, toCreate.length), total: payload.length });
        if (i + CREATE_BATCH < toCreate.length) await sleep(300);
      }

      // Batch updates — run 10 in parallel, then next 10
      const UPDATE_BATCH = 10;
      for (let i = 0; i < toUpdate.length; i += UPDATE_BATCH) {
        const batch = toUpdate.slice(i, i + UPDATE_BATCH);
        await Promise.all(batch.map(({ id, data }) =>
          base44.entities.Loaners.update(id, data).then(() => { updated++; }).catch(() => { skipped++; })
        ));
        setUploadProgress({ current: toCreate.length + Math.min(i + UPDATE_BATCH, toUpdate.length), total: payload.length });
        if (i + UPDATE_BATCH < toUpdate.length) await sleep(200);
      }

      // --- CLEANUP: Delete loaners no longer in the spreadsheet ---
      const newImportKeySet = new Set(payload.map(p => p.importKey));
      let deleted = 0;
      const toDelete = allExisting.filter(l => l.importKey && !newImportKeySet.has(l.importKey));
      for (let i = 0; i < toDelete.length; i += 10) {
        const batch = toDelete.slice(i, i + 10);
        await Promise.all(batch.map(l => base44.entities.Loaners.delete(l.id).then(() => { deleted++; }).catch(() => {})));
        if (i + 10 < toDelete.length) await sleep(200);
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

      // Archive snapshot for historical analysis
      base44.functions.invoke('archiveImportSnapshot', { type: 'loaners' }).catch(() => {});

      // Save analytics snapshot
      saveAnalyticsSnapshot('loaners').catch(() => {});

    } catch (err) {
      setError(err.message || "Failed to import data");
    } finally {
      setIsUploading(false);
    }
  };



  const handleClearAll = async () => {
    setIsClearing(true);
    try {
      const all = await fetchAllPages(base44.entities.Loaners);
      for (const loaner of all) {
        await base44.entities.Loaners.delete(loaner.id);
      }
      queryClient.invalidateQueries({ queryKey: ["loaners"] });
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
      const all = await fetchAllPages(base44.entities.MissingPart);
      for (const part of all) {
        await base44.entities.MissingPart.delete(part.id);
      }
      queryClient.invalidateQueries({ queryKey: ["missingParts"] });
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

      // Reuse the loaners we already fetched at page mount for rep-name lookup.
      // Staleness is acceptable here — rep names don't change between renders.
      const allLoaners = existingLoaners;

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
      const allExisting = await fetchAllPages(base44.entities.MissingPart);
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
        await sleep(100);
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

      // Archive snapshot for historical analysis
      base44.functions.invoke('archiveImportSnapshot', { type: 'missing_parts' }).catch(() => {});

      // Save analytics snapshot
      saveAnalyticsSnapshot('missing_parts').catch(() => {});

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

      setIepProgress("Clearing existing IEP data...");
      const existing = await fetchAllPages(base44.entities.IEPSystemData);
      for (let i = 0; i < existing.length; i += 5) {
        await Promise.all(existing.slice(i, i + 5).map(r => base44.entities.IEPSystemData.delete(r.id)));
        await sleep(300);
      }

      setIepProgress(`Saving ${records.length} records...`);
      for (let i = 0; i < records.length; i += 50) {
        await base44.entities.IEPSystemData.bulkCreate(records.slice(i, i + 50));
        if (i + 50 < records.length) await sleep(300);
      }

      // Archive IEP snapshot for historical analysis
      const importedAtSnap = new Date().toISOString();
      const effVals = records.map(r => r.effPct).filter(v => v != null);
      const overallEffPct = effVals.length > 0 ? effVals.reduce((a, b) => a + b, 0) / effVals.length : null;
      base44.entities.IEPImportSnapshot.create({
        importBatchId: importedAtSnap,
        importedAt: importedAtSnap,
        fileType: 'grid6',
        totalRecords: records.length,
        overallEffPct,
        records,
      }).catch(() => {});

      setIepImportResult(records.length);
      setIepFile(null);

      // Save analytics snapshot
      saveAnalyticsSnapshot('iep').catch(() => {});
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
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
            Import Data
          </h1>
          <p className="text-slate-500 mt-1">
            Upload the daily loaner spreadsheet to update records
          </p>
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <Clock className="w-3.5 h-3.5" />
            <span>
              Last imported:{" "}
              <span className="font-medium text-slate-700">
                {lastImportedAt ? new Date(lastImportedAt).toLocaleString() : "Never"}
              </span>
            </span>
          </div>
        </div>

        {/* Auto-import (server-side Gmail pull) */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 mb-6">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-blue-100 flex-shrink-0">
              <Mail className="w-5 h-5 text-blue-600" />
            </div>
            <div className="flex-1 min-w-0">
              <h2 className="font-semibold text-slate-900">Run Auto-Import Now</h2>
              <p className="text-sm text-slate-500 mt-0.5">
                Pulls the most recent loaner spreadsheet attachment from the connected Gmail inbox. Runs on the server — no browser tab needed.
              </p>
              {autoImportResult?.success && (
                <Alert className="mt-3 border-green-200 bg-green-50">
                  <CheckCircle className="h-4 w-4 text-green-600" />
                  <AlertDescription className="text-green-800">
                    {autoImportResult.message ||
                      `Imported ${autoImportResult.total ?? 0} records (${autoImportResult.created ?? 0} created, ${autoImportResult.updated ?? 0} updated).`}
                  </AlertDescription>
                </Alert>
              )}
              {autoImportResult && !autoImportResult.success && (
                <Alert variant="destructive" className="mt-3">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>{autoImportResult.error}</AlertDescription>
                </Alert>
              )}
            </div>
            <Button
              onClick={handleAutoImport}
              disabled={isAutoImporting}
              className="flex-shrink-0 bg-blue-600 hover:bg-blue-700 h-10"
            >
              {isAutoImporting ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Running...
                </>
              ) : (
                <>
                  <RefreshCcw className="w-4 h-4 mr-2" />
                  Run Now
                </>
              )}
            </Button>
          </div>
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
          <div
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter("loaners")}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop("loaners", setFile, () => {
              setImportResult(null);
              setError(null);
              setFailedRows([]);
            })}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragZone === "loaners"
                ? "border-indigo-500 bg-indigo-50"
                : "border-slate-200 hover:border-indigo-300"
            }`}
          >
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

          <div
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter("parts")}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop("parts", setPartsFile, () => {
              setPartsImportResult(null);
              setPartsError(null);
            })}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragZone === "parts"
                ? "border-orange-500 bg-orange-50"
                : "border-slate-200 hover:border-orange-300"
            }`}
          >
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
              <p className="text-sm text-slate-500">Globus Grid 6 Excel (.xlsx)</p>
            </div>
          </div>

          <div className="bg-slate-50 rounded-lg p-4 mb-6 text-xs text-slate-600 space-y-1">
            <p className="font-medium text-slate-700 mb-1">Expected columns (Grid 6):</p>
            <p>Name, Sys Cnt, Cons/Loaner Exp Usage, Proc Cmpl, Eff %, Eff Score, and Proj variants</p>
            <p className="text-slate-400 italic mt-1">Each import fully replaces all previous IEP system records.</p>
          </div>

          <div
            onDragOver={handleDragOver}
            onDragEnter={handleDragEnter("iep")}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop("iep", setIepFile, () => {
              setIepImportResult(null);
              setIepError(null);
            })}
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
              dragZone === "iep"
                ? "border-purple-500 bg-purple-50"
                : "border-slate-200 hover:border-purple-300"
            }`}
          >
            <TrendingUp className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) { setIepFile(f); setIepImportResult(null); setIepError(null); } }}
              className="hidden"
              id="iep-file-upload"
            />
            <label htmlFor="iep-file-upload" className="cursor-pointer text-purple-600 hover:text-purple-700 font-medium">
              Choose file (.xlsx)
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