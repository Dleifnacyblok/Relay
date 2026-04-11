import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import * as XLSX from "xlsx";
import { TrendingUp, Upload, CheckCircle, AlertCircle, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

export default function IEPImport() {
  const [file, setFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const { data: user, isLoading: isLoadingUser } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
  });

  const isAuthorized = user?.role === "admin" || user?.role === "manager";

  if (isLoadingUser) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="text-center">
          <AlertCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Access restricted</p>
          <p className="text-sm text-slate-500 mt-1">Admin or manager access required</p>
        </div>
      </div>
    );
  }

  const toNum = (v) => {
    if (v === null || v === undefined || v === "") return null;
    const n = parseFloat(String(v).replace(/[,%]/g, "").trim());
    return isNaN(n) ? null : n;
  };

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (f) {
      setFile(f);
      setResult(null);
      setError(null);
    }
  };

  const handleImport = async () => {
    if (!file || isImporting) return;

    setIsImporting(true);
    setError(null);
    setResult(null);
    setProgress("Reading file...");

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: "array", cellDates: true });
      const sheetName = workbook.SheetNames[0];
      const worksheet = workbook.Sheets[sheetName];
      const allRows = XLSX.utils.sheet_to_json(worksheet, { defval: "", raw: false });

      const validRows = allRows.filter((r) => r["Name"] && String(r["Name"]).trim() !== "");

      if (!validRows.length) throw new Error("No valid rows found. Make sure the sheet has a 'Name' column.");

      const importedAt = new Date().toISOString();

      setProgress("Clearing existing IEP data...");
      const existing = await base44.entities.IEPSystemData.list();
      for (const rec of existing) {
        await base44.entities.IEPSystemData.delete(rec.id);
      }

      let count = 0;
      for (const row of validRows) {
        setProgress(`Importing system ${count + 1} of ${validRows.length}...`);
        await base44.entities.IEPSystemData.create({
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
        });
        count++;
      }

      setResult(count);
      setFile(null);
    } catch (err) {
      setError(err.message || "Import failed. Please try again.");
    } finally {
      setIsImporting(false);
      setProgress(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-xl mx-auto px-4 py-10">
        <div className="mb-8 flex items-center gap-3">
          <div className="p-2.5 rounded-lg bg-purple-100">
            <TrendingUp className="w-6 h-6 text-purple-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-900">IEP Efficiency Import</h1>
            <p className="text-sm text-slate-500 mt-0.5">
              Upload the Globus Grid 6 system efficiency report to update IEP dashboard data.
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
          <div className="bg-slate-50 rounded-lg p-4 mb-6 text-xs text-slate-600 space-y-1">
            <p className="font-medium text-slate-700 mb-1">Expected columns (first sheet):</p>
            <p>Name <span className="text-red-500">*</span>, Sys Cnt, Cons Exp Usage, Cons Exp Usage Proj</p>
            <p>Loaner Exp Usage, Loaner Exp Usage Proj, Total Exp Usage, Total Exp Usage Proj</p>
            <p>Proc Cmpl, Proc Cmpl Proj, Eff Score, Eff Score Proj, Eff %, Eff % Proj</p>
            <p className="text-slate-400 italic mt-2">Each import fully replaces all previous IEP system records.</p>
          </div>

          <div className="border-2 border-dashed border-slate-200 rounded-lg p-8 text-center hover:border-purple-300 transition-colors mb-6">
            <Upload className="w-10 h-10 text-slate-300 mx-auto mb-3" />
            <input
              type="file"
              accept=".xlsx"
              onChange={handleFileChange}
              className="hidden"
              id="iep-import-file"
            />
            <label
              htmlFor="iep-import-file"
              className="cursor-pointer text-purple-600 hover:text-purple-700 font-medium text-sm"
            >
              Choose Excel file (.xlsx)
            </label>
            <p className="text-xs text-slate-400 mt-1">or drag and drop</p>
            {file && (
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-2 bg-slate-100 rounded-lg">
                <TrendingUp className="w-4 h-4 text-slate-400" />
                <span className="text-sm font-medium text-slate-700">{file.name}</span>
              </div>
            )}
          </div>

          {progress && (
            <div className="flex items-center gap-2 text-sm text-slate-600 mb-4">
              <Loader2 className="w-4 h-4 animate-spin text-purple-500" />
              <span>{progress}</span>
            </div>
          )}

          {result !== null && (
            <div className="flex items-start gap-3 p-4 bg-green-50 border border-green-200 rounded-lg mb-4">
              <CheckCircle className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
              <div className="text-sm text-green-800">
                <p className="font-medium">{result} systems imported successfully. IEP Dashboard is now updated.</p>
                <Link to="/IEPDashboard" className="underline text-green-700 hover:text-green-900 mt-1 inline-block">
                  Go to IEP Dashboard →
                </Link>
              </div>
            </div>
          )}

          {error && (
            <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-lg mb-4">
              <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 shrink-0" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          <button
            onClick={handleImport}
            disabled={!file || isImporting}
            className="w-full h-11 flex items-center justify-center gap-2 rounded-md bg-purple-600 hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors"
          >
            {isImporting ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="w-4 h-4" />
                Import IEP Data
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}