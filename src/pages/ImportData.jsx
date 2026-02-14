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

  const handleFileChange = (e) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setImportResult(null);
      setError(null);
    }
  };

  const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  const handleImport = async () => {
    if (!file || isUploading) return;

    setIsUploading(true);
    setError(null);
    setImportResult(null);
    setFailedRows([]);

    try {
      // Read file with XLSX
      const arrayBuffer = await file.arrayBuffer();
      const wb = XLSX.read(arrayBuffer, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(ws, { defval: "" });

      if (!Array.isArray(rawRows) || rawRows.length === 0) {
        throw new Error("No valid data found in the file");
      }

      // Map rows
      const rows = [];
      const skipped = [];
      for (let i = 0; i < rawRows.length; i++) {
        const mapped = mapRow(rawRows[i]);
        if (mapped) {
          rows.push(mapped);
        } else {
          skipped.push(i + 2); // +2 for header and 0-indexing
        }
      }

      if (rows.length === 0) {
        throw new Error("No valid rows found (all rows missing Set Name and Account Name)");
      }

      // Send to backend for batch insert
      const response = await fetch('/api/bulkImportLoaners', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to import data");
      }

      const result = await response.json();
      setFailedRows(result.failures || []);

      if (result.success) {
        setImportResult({
          success: true,
          count: result.recordCount
        });
        queryClient.invalidateQueries({ queryKey: ["loaners"] });
        setFile(null);
      } else {
        setError(`${result.failureCount} rows failed. ${result.recordCount} rows imported successfully.`);
      }

    } catch (err) {
      setError(err.message || "Failed to import data");
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
                Successfully imported {importResult.count} records
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