import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
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

  const handleImport = async () => {
    if (!file) return;

    setIsUploading(true);
    setError(null);
    setImportResult(null);

    try {
      // Upload file
      const { file_url } = await base44.integrations.Core.UploadFile({ file });

      // Extract data with mapping schema
      const extractionSchema = {
        type: "array",
        items: {
          type: "object",
          properties: {
            set_name: { type: "string", description: "Maps from 'Set Name'" },
            etch_id: { type: "string", description: "Maps from 'Etch Id'" },
            primary_rep: { type: "string", description: "Maps from 'Current Field Sales Name'" },
            associate_rep: { type: "string", description: "Maps from 'Associate Sales Rep Name'" },
            account_name: { type: "string", description: "Maps from 'Account Name'" },
            status: { type: "string", description: "Maps from 'Status'" },
            loaned_date: { type: "string", description: "Maps from 'Loaned Date' (format: YYYY-MM-DD)" },
            expected_return_date: { type: "string", description: "Maps from 'Expected Return Date' (format: YYYY-MM-DD)" }
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

      // Upsert loaners based on composite key: etch_id + set_name
      let createdCount = 0;
      let updatedCount = 0;
      
      for (const record of extractedData) {
        let existing = null;
        
        // Find by composite key: etch_id + set_name
        if (record.etch_id && record.set_name) {
          existing = existingLoaners.find(l => 
            l.etch_id === record.etch_id && l.set_name === record.set_name
          );
        }
        
        if (existing) {
          // Update existing record
          await base44.entities.Loaners.update(existing.id, record);
          updatedCount++;
        } else {
          // Create new record
          await base44.entities.Loaners.create(record);
          createdCount++;
        }
      }
      
      setImportResult({
        success: true,
        count: extractedData.length,
        created: createdCount,
        updated: updatedCount
      });

      queryClient.invalidateQueries(["loaners"]);
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
            <p className="text-sm font-medium text-slate-700 mb-2">Expected columns:</p>
            <div className="grid grid-cols-2 gap-2 text-xs text-slate-600">
              <div>• Set Name</div>
              <div>• Etch Id</div>
              <div>• Current Field Sales Name</div>
              <div>• Associate Sales Rep Name</div>
              <div>• Account Name</div>
              <div>• Status</div>
              <div>• Loaned Date</div>
              <div>• Expected Return Date</div>
            </div>
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

          {/* Success Alert */}
          {importResult?.success && (
            <Alert className="mt-4 border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Successfully imported {importResult.count} records 
                ({importResult.created} created, {importResult.updated} updated)
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