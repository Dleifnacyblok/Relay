import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle, Loader2, Trash2, Sparkles, Clock } from "lucide-react";
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
  const [isCleaning, setIsCleaning] = useState(false);
  const [cleanupResult, setCleanupResult] = useState(null);
  const [retryCountdown, setRetryCountdown] = useState(0);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [failedRows, setFailedRows] = useState([]);
  
  const queryClient = useQueryClient();

  // Countdown timer for rate limit
  useEffect(() => {
    if (retryCountdown <= 0) return;
    
    const timer = setInterval(() => {
      setRetryCountdown(prev => Math.max(0, prev - 1));
    }, 1000);
    
    return () => clearInterval(timer);
  }, [retryCountdown]);

  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
  });

  const { data: appSetting } = useQuery({
    queryKey: ["appSetting"],
    queryFn: async () => {
      const result = await base44.entities.AppSetting.filter({ key: 'import_metadata' });
      return result?.[0] || null;
    }
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
      // Upload file
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Extract data with CSV column names exactly as they appear
      const extractionSchema = {
        type: "array",
        items: {
          type: "object",
          properties: {
            "Set Name": { type: "string" },
            "Loaner Id": { type: "string" },
            "Etch Id": { type: "string" },
            "Account Name": { type: "string" },
            "Associate Sales Rep Name": { type: "string" },
            "Current Field Sales Name": { type: "string" },
            "Status": { type: "string" },
            "Loaned Date": { type: "string" },
            "Expected Return Date": { type: "string" }
          }
        }
      };

      const result = await base44.integrations.Core.ExtractDataFromUploadedFile({
        file_url,
        json_schema: extractionSchema
      });

      if (result.status === "error") {
        throw new Error(result.details || "Failed to extract data from file");
      }

      const extractedData = result.output;
      
      if (!Array.isArray(extractedData) || extractedData.length === 0) {
        throw new Error("No valid data found in the file");
      }

      // Process in batches of 50
      const BATCH_SIZE = 50;
      const totalBatches = Math.ceil(extractedData.length / BATCH_SIZE);
      let totalImported = 0;
      const failures = [];

      for (let i = 0; i < extractedData.length; i += BATCH_SIZE) {
        const batchIndex = Math.floor(i / BATCH_SIZE);
        setUploadProgress({
          current: batchIndex,
          total: totalBatches,
          percent: Math.round((batchIndex / totalBatches) * 100)
        });

        const batch = extractedData.slice(i, i + BATCH_SIZE);

        try {
          const response = await fetch('/api/bulkImportLoaners', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data: batch })
          });

          if (response.status === 429) {
            const errorData = await response.json();
            const retryAfter = errorData.retryAfter || 30;
            setRetryCountdown(retryAfter);
            throw new Error(`Rate limited. Please try again in ${retryAfter} seconds.`);
          }

          if (!response.ok) {
            const errorData = await response.json();
            // Track failed batch rows
            batch.forEach((row, idx) => {
              failures.push({
                rowIndex: i + idx + 2, // +2 for header row and 0-indexing
                data: row,
                error: errorData.error || 'Failed to import'
              });
            });
          } else {
            const result = await response.json();
            totalImported += result.recordCount || batch.length;
          }
        } catch (err) {
          // If batch fails, track all rows in batch as failed
          batch.forEach((row, idx) => {
            failures.push({
              rowIndex: i + idx + 2,
              data: row,
              error: err.message
            });
          });
        }

        // Delay between batches (200ms to avoid rate limits)
        if (i + BATCH_SIZE < extractedData.length) {
          await delay(200);
        }
      }

      setUploadProgress(null);
      setFailedRows(failures);

      if (failures.length === 0) {
        setImportResult({
          success: true,
          count: totalImported
        });
        queryClient.invalidateQueries(["loaners"]);
        queryClient.invalidateQueries(["appSetting"]);
        setFile(null);
      } else {
        setError(`Completed with ${failures.length} failed rows. ${totalImported} rows imported successfully.`);
      }

    } catch (err) {
      setError(err.message || "Failed to import data");
    } finally {
      setIsUploading(false);
    }
  };

  const handleCleanupDuplicates = async () => {
    setIsCleaning(true);
    setCleanupResult(null);
    setError(null);
    
    try {
      let deletedCount = 0;
      const toDelete = new Set();
      
      // Step 1: Group by set_name + account_name + expected_return_date + rep
      const duplicateGroups = {};
      for (const loaner of existingLoaners) {
        const rep = loaner.associate_rep || loaner.primary_rep || '';
        const key = `${loaner.set_name || ''}|${loaner.account_name || ''}|${loaner.expected_return_date || ''}|${rep}`;
        if (!duplicateGroups[key]) {
          duplicateGroups[key] = [];
        }
        duplicateGroups[key].push(loaner);
      }
      
      // Within duplicates, delete records with blank etch_id
      for (const key in duplicateGroups) {
        const group = duplicateGroups[key];
        if (group.length > 1) {
          const withEtchId = group.filter(l => l.etch_id && l.etch_id.trim() !== '');
          const withoutEtchId = group.filter(l => !l.etch_id || l.etch_id.trim() === '');
          
          // If we have records with etch_id, delete the ones without
          if (withEtchId.length > 0) {
            for (const loaner of withoutEtchId) {
              toDelete.add(loaner.id);
            }
          }
        }
      }
      
      // Step 2: Group by etch_id + set_name, keep only one
      const compositeGroups = {};
      for (const loaner of existingLoaners) {
        if (toDelete.has(loaner.id)) continue; // Skip already marked for deletion
        
        const key = `${loaner.etch_id || ''}|${loaner.set_name || ''}`;
        if (!compositeGroups[key]) {
          compositeGroups[key] = [];
        }
        compositeGroups[key].push(loaner);
      }
      
      // Keep only one record per etch_id + set_name
      for (const key in compositeGroups) {
        const group = compositeGroups[key];
        if (group.length > 1) {
          // Sort by updated_date descending, keep the first
          const sorted = [...group].sort((a, b) => 
            new Date(b.updated_date) - new Date(a.updated_date)
          );
          
          // Mark all except the first for deletion
          for (let i = 1; i < sorted.length; i++) {
            toDelete.add(sorted[i].id);
          }
        }
      }
      
      // Execute deletions
      for (const id of toDelete) {
        await base44.entities.Loaners.delete(id);
        deletedCount++;
      }
      
      setCleanupResult({
        success: true,
        deletedCount
      });
      
      queryClient.invalidateQueries(["loaners"]);
      
    } catch (err) {
      setError("Failed to cleanup duplicates: " + err.message);
    } finally {
      setIsCleaning(false);
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
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  className="text-indigo-600 hover:text-indigo-700 hover:bg-indigo-50"
                  onClick={handleCleanupDuplicates}
                  disabled={isCleaning}
                >
                  {isCleaning ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Cleaning...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-4 h-4 mr-2" />
                      Clean Duplicates
                    </>
                  )}
                </Button>
                <Button 
                  variant="outline" 
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  onClick={() => setShowClearDialog(true)}
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  Clear All
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Cleanup Result */}
        {cleanupResult?.success && (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <AlertDescription className="text-green-800">
              Cleanup complete! Removed {cleanupResult.deletedCount} duplicate/blank records.
            </AlertDescription>
          </Alert>
        )}

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
            <p className="text-sm font-medium text-slate-700 mb-2">Expected columns:</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
              <div>• Set Name <span className="text-red-600">*</span></div>
              <div>• Loaner Id</div>
              <div>• Etch Id</div>
              <div>• Account Name <span className="text-red-600">*</span></div>
              <div>• Associate Sales Rep Name</div>
              <div>• Current Field Sales Name</div>
              <div>• Status</div>
              <div>• Loaned Date</div>
              <div>• Expected Return Date</div>
            </div>
            <p className="text-xs text-slate-500 mt-3"><span className="text-red-600">*</span> Required. Missing or invalid values for optional fields are set to null. Status "Pending Return" converts to "loaned". Extra columns are ignored. Files up to 600 rows processed in batches of 50.</p>
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

          {/* Progress */}
          {uploadProgress && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg border border-blue-200">
              <p className="text-sm font-medium text-blue-900 mb-2">
                Uploading batch {uploadProgress.current + 1} of {uploadProgress.total}
              </p>
              <div className="w-full bg-blue-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all"
                  style={{ width: `${uploadProgress.percent}%` }}
                />
              </div>
            </div>
          )}

          {/* Error Alert */}
           {error && (
             <Alert variant="destructive" className="mt-4">
               <AlertCircle className="h-4 w-4" />
               <AlertDescription>
                 {error}
                 {retryCountdown > 0 && (
                   <div className="mt-2 text-sm font-medium">
                     Try again in {retryCountdown}s
                   </div>
                 )}
               </AlertDescription>
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
             disabled={!file || isUploading || retryCountdown > 0}
             title={retryCountdown > 0 ? `Try again in ${retryCountdown}s` : ''}
           >
             {isUploading ? (
               <>
                 <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                 Importing...
               </>
             ) : retryCountdown > 0 ? (
               <>
                 <Clock className="w-4 h-4 mr-2" />
                 Retry in {retryCountdown}s
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