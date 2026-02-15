import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Loader2, Trash2, Download } from "lucide-react";
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
  
  // Missing Parts state
  const [partsFile, setPartsFile] = useState(null);
  const [isUploadingParts, setIsUploadingParts] = useState(false);
  const [partsImportResult, setPartsImportResult] = useState(null);
  const [partsError, setPartsError] = useState(null);
  const [showClearPartsDialog, setShowClearPartsDialog] = useState(false);
  const [isClearingParts, setIsClearingParts] = useState(false);
  
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
        const assocRaw = (r["associate sales rep name"] || "").toString().trim();
        const repName = assocRaw || "None";
        const accountName = (r["account name"] || "").toString().trim();
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
      const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

      // Process in smaller batches with delays
      const BATCH_SIZE = 10;
      for (let i = 0; i < payload.length; i += BATCH_SIZE) {
        const batch = payload.slice(i, i + BATCH_SIZE);
        
        for (const rec of batch) {
          let existingId = existingMap.get(rec.importKey);
          
          // Fallback check to prevent duplicates
          if (!existingId) {
            const fallbackKey = `${rec.setId}__${rec.accountName}`.toLowerCase();
            existingId = existingBySetAccount.get(fallbackKey);
          }
          
          if (existingId) {
            await base44.entities.Loaners.update(existingId, rec);
            updated++;
          } else {
            const newRecord = await base44.entities.Loaners.create(rec);
            created++;
            // Update maps with new record to prevent duplicates within same import
            existingMap.set(rec.importKey, newRecord.id);
            const fallbackKey = `${rec.setId}__${rec.accountName}`.toLowerCase();
            existingBySetAccount.set(fallbackKey, newRecord.id);
          }
          
          // Small delay between each record
          await sleep(100);
        }
        
        // Longer delay between batches
        if (i + BATCH_SIZE < payload.length) {
          await sleep(1000);
        }
        
        setUploadProgress({ current: Math.min(i + BATCH_SIZE, payload.length), total: payload.length });
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

      setImportResult({ success: true, created, updated, total: created + updated });
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

      normalizedRows.forEach((r, idx) => {
        const rowNum = idx + 2;
        const repName = (r["rep name"] || r["rep"] || "").toString().trim();
        const partName = (r["part name"] || r["part"] || "").toString().trim();
        const partNumber = (r["part number"] || r["part #"] || "").toString().trim();
        const loanerSetName = (r["loaner"] || r["set name"] || r["loaner set"] || "").toString().trim();
        const etchId = (r["etch id"] || r["etch"] || "").toString().trim();
        const missingDate = parseDate(r["date"] || r["missing date"]);
        const fineAmount = parseFloat(r["fine"] || r["fine amount"] || 0);

        const missing = [];
        if (!repName) missing.push("Rep Name");
        if (!partName) missing.push("Part Name");
        if (!missingDate) missing.push("Date");

        if (missing.length) {
          errors.push({ row: rowNum, error: `Missing: ${missing.join(", ")}` });
          return;
        }

        payload.push({
          repName,
          partName,
          partNumber,
          loanerSetName,
          etchId,
          missingDate: missingDate.toISOString().slice(0, 10),
          fineAmount: fineAmount || 0,
          status: "missing"
        });
      });

      if (errors.length > 0) {
        throw new Error(`${errors.length} rows have errors: ${errors.map(e => `Row ${e.row}: ${e.error}`).join("; ")}`);
      }

      let created = 0;
      const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

      // Process in smaller batches with delays
      const BATCH_SIZE = 10;
      for (let i = 0; i < payload.length; i += BATCH_SIZE) {
        const batch = payload.slice(i, i + BATCH_SIZE);
        
        for (const rec of batch) {
          await base44.entities.MissingPart.create(rec);
          created++;
          await sleep(100);
        }
        
        if (i + BATCH_SIZE < payload.length) {
          await sleep(1000);
        }
      }

      setPartsImportResult({ success: true, created, total: created });
      queryClient.invalidateQueries({ queryKey: ["missingParts"] });
      setPartsFile(null);

    } catch (err) {
      setPartsError(err.message || "Failed to import parts data");
    } finally {
      setIsUploadingParts(false);
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
              <div className="flex items-center justify-between">
                <span>Rep Name (or "Rep")</span>
                <span className="text-red-600">* Required</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Part Name (or "Part")</span>
                <span className="text-red-600">* Required</span>
              </div>
              <div className="flex items-center justify-between">
                <span>Date (or "Missing Date")</span>
                <span className="text-red-600">* Required</span>
              </div>
              <div>Part Number (or "Part #") - Optional</div>
              <div>Loaner (or "Set Name", "Loaner Set") - Optional</div>
              <div>Etch ID (or "Etch") - Optional</div>
              <div>Fine Amount (or "Fine") - Optional</div>
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
                Successfully imported {partsImportResult.total} missing parts
              </AlertDescription>
            </Alert>
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