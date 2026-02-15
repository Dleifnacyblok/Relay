import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import * as XLSX from "xlsx";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Loader2, Trash2 } from "lucide-react";
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
  const [showMapping, setShowMapping] = useState(false);
  const [detectedColumns, setDetectedColumns] = useState([]);
  const [columnMapping, setColumnMapping] = useState({});
  
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
  });

  const { data: existingLoaners = [] } = useQuery({
    queryKey: ["loaners"],
    queryFn: () => base44.entities.Loaners.list(),
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

  const handleFileChange = async (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setImportResult(null);
      setError(null);
      setFailedRows([]);
      
      // Detect columns from file
      try {
        const arrayBuffer = await selectedFile.arrayBuffer();
        const wb = XLSX.read(arrayBuffer, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rawRows = XLSX.utils.sheet_to_json(ws, { defval: "", header: 1 });
        
        if (rawRows.length > 0) {
          const headers = rawRows[0].filter(h => h && h.toString().trim());
          setDetectedColumns(headers);
          
          // Auto-map columns based on common patterns
          const autoMapping = {};
          const requiredFields = [
            { field: 'setId', patterns: ['set id', 'setid'] },
            { field: 'setName', patterns: ['set name', 'setname'] },
            { field: 'currentFieldSalesName', patterns: ['current field sales name', 'field sales', 'current field sales'] },
            { field: 'associateSalesRepName', patterns: ['associate sales rep name', 'associate rep', 'assoc rep'] },
            { field: 'accountName', patterns: ['account name', 'account'] },
            { field: 'etchId', patterns: ['etch id', 'etchid', 'etch'] },
            { field: 'loanedDate', patterns: ['loaned date', 'loan date', 'date loaned'] },
            { field: 'expectedReturnDate', patterns: ['expected return date', 'return date', 'due date'] }
          ];
          
          headers.forEach(header => {
            const normalized = header.toLowerCase().trim();
            requiredFields.forEach(({ field, patterns }) => {
              if (patterns.some(p => normalized === p || normalized.includes(p))) {
                if (!autoMapping[field]) {
                  autoMapping[field] = header;
                }
              }
            });
          });
          
          setColumnMapping(autoMapping);
          setShowMapping(true);
        }
      } catch (err) {
        console.error("Failed to detect columns:", err);
        setError("Failed to read file headers");
      }
    }
  };

  const handleImport = async () => {
    if (!file || isUploading) return;

    setIsUploading(true);
    setError(null);
    setImportResult(null);
    setFailedRows([]);

    try {
      // Read file as base64
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const fileBuffer = buffer.toString('base64');

      // Send column mapping to backend
      const response = await base44.functions.importMichiganLoanerReport({
        fileBuffer,
        columnMapping
      });

      if (response.success) {
        setImportResult({
          success: true,
          created: response.created,
          updated: response.updated,
          total: response.importedRows
        });
        queryClient.invalidateQueries({ queryKey: ["loaners"] });
        setFile(null);
        setShowMapping(false);
        setDetectedColumns([]);
        setColumnMapping({});
      } else {
        throw new Error(response.error || "Import failed");
      }

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
        <div className="bg-white rounded-xl border border-slate-200 p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">Current Records</p>
              <p className="text-2xl font-bold text-slate-900">{existingLoaners.length}</p>
            </div>
            {existingLoaners.length > 0 && (
              <Button 
                variant="outline" 
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                onClick={() => setShowClearDialog(true)}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear All
              </Button>
            )}
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

          {/* Column Mapping UI */}
          {showMapping && detectedColumns.length > 0 && (
            <div className="bg-slate-50 rounded-lg p-4 mb-6">
              <p className="text-sm font-medium text-slate-700 mb-4">Column Mapping:</p>
              <div className="space-y-3">
                {[
                  { field: 'setId', label: 'Set ID', required: true },
                  { field: 'setName', label: 'Set Name', required: true },
                  { field: 'currentFieldSalesName', label: 'Current Field Sales Name', required: true },
                  { field: 'associateSalesRepName', label: 'Associate Sales Rep Name', required: false },
                  { field: 'accountName', label: 'Account Name', required: true },
                  { field: 'etchId', label: 'Etch ID', required: true },
                  { field: 'loanedDate', label: 'Loaned Date', required: true },
                  { field: 'expectedReturnDate', label: 'Expected Return Date', required: true }
                ].map(({ field, label, required }) => (
                  <div key={field} className="flex items-center justify-between gap-4">
                    <label className="text-sm text-slate-600 flex-shrink-0">
                      {label} {required && <span className="text-red-600">*</span>}
                    </label>
                    <select
                      value={columnMapping[field] || ''}
                      onChange={(e) => setColumnMapping({ ...columnMapping, [field]: e.target.value })}
                      className="flex-1 max-w-xs text-sm border border-slate-300 rounded-md px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      <option value="">-- Select Column --</option>
                      {detectedColumns.map(col => (
                        <option key={col} value={col}>{col}</option>
                      ))}
                    </select>
                  </div>
                ))}
              </div>
              <p className="text-xs text-slate-500 mt-4">
                <span className="text-red-600">*</span> Required fields must be mapped to proceed.
              </p>
            </div>
          )}

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
             <div className="mt-4 p-4 bg-amber-50 rounded-lg border border-amber-200">
               <p className="text-sm font-medium text-amber-900 mb-3">
                 {failedRows.length} row{failedRows.length !== 1 ? 's' : ''} failed:
               </p>
               <div className="space-y-2 max-h-48 overflow-y-auto">
                 {failedRows.slice(0, 10).map((row, idx) => (
                   <div key={idx} className="text-xs text-amber-800">
                     <span className="font-medium">Row {row.rowIndex}:</span> {row.data.set_name || '(unnamed)'} - {row.error}
                   </div>
                 ))}
                 {failedRows.length > 10 && (
                   <p className="text-xs text-amber-700 italic">
                     ... and {failedRows.length - 10} more
                   </p>
                 )}
               </div>
             </div>
           )}

          {/* Success Alert */}
          {importResult?.success && (
            <Alert className="mt-4 border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Successfully imported {importResult.total} records ({importResult.created} created, {importResult.updated} updated)
              </AlertDescription>
            </Alert>
          )}

          {/* Import Button */}
           <Button 
            className="w-full mt-6 h-11"
            onClick={handleImport}
            disabled={!file || isUploading || !showMapping || !columnMapping.setId || !columnMapping.setName || !columnMapping.accountName || !columnMapping.etchId || !columnMapping.loanedDate || !columnMapping.expectedReturnDate || !columnMapping.currentFieldSalesName}
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

        {/* Clear Confirmation Dialog */}
        <Dialog open={showClearDialog} onOpenChange={setShowClearDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Clear All Data?</DialogTitle>
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
      </div>
    </div>
  );
}