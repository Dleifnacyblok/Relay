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

  const handleImport = async () => {
    if (!file || isUploading) return;

    setIsUploading(true);
    setError(null);
    setImportResult(null);
    setFailedRows([]);

    try {
      // Convert file to base64
      const arrayBuffer = await file.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      const base64 = buffer.toString('base64');

      // Call the importMichiganLoanerReport function
      const result = await base44.functions.importMichiganLoanerReport({ fileBuffer: base64 });

      if (result.success) {
        setImportResult({
          success: true,
          created: result.created,
          updated: result.updated,
          total: result.created + result.updated
        });
        queryClient.invalidateQueries({ queryKey: ["loaners"] });
        setFile(null);
      } else {
        throw new Error(result.error || "Import failed");
      }

    } catch (err) {
      const errorMsg = err.message || "Failed to import data";
      setError(errorMsg);
      
      // Parse detailed errors from backend if available
      if (errorMsg.includes("Row ")) {
        const errorLines = errorMsg.split('\n').filter(line => line.includes("Row "));
        const parsedErrors = errorLines.map(line => {
          const rowMatch = line.match(/Row (\d+):/);
          const rowNum = rowMatch ? rowMatch[1] : '?';
          const errorDetail = line.substring(line.indexOf(':') + 1).trim();
          return {
            rowIndex: rowNum,
            error: errorDetail,
            data: {}
          };
        });
        setFailedRows(parsedErrors);
      }
    } finally {
      setIsUploading(false);
      setUploadProgress(null);
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