import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import * as XLSX from "xlsx";
import { TrendingUp, Upload, CheckCircle, AlertCircle, Loader2, FileSpreadsheet } from "lucide-react";
import { Link } from "react-router-dom";

const toNum = (v) => {
  if (v === null || v === undefined || v === "") return null;
  const s = String(v).replace(/\u00a0/g, "").trim();
  if (!s || s === "\xa0") return null;
  const n = parseFloat(s.replace(/[,%]/g, ""));
  return isNaN(n) ? null : n;
};

const cleanStr = (v) => {
  if (!v) return "";
  return String(v).replace(/\u00a0/g, "").trim();
};

// Detect which grid file this is based on columns present
function detectFileType(rows) {
  if (!rows.length) return null;
  const keys = Object.keys(rows[0]);
  if (keys.includes("Name") && keys.includes("Eff %") && keys.includes("Sys Cnt")) return "grid6";
  if (keys.includes("Tag Id") && keys.includes("Cons Compl")) return "grid4";
  if (keys.includes("Loaner Id") && keys.includes("Loaner Cmpl")) return "grid5";
  return null;
}

async function importViaBackend(fileUrl, fileType, setProgress) {
  setProgress(`Uploading to server...`);
  const res = await base44.functions.invoke('importIEPFiles', { fileUrl, fileType });
  return res.data.imported;
}

async function importGrid4(rows, setProgress) {
  const importedAt = new Date().toISOString();
  const valid = rows.filter(r => cleanStr(r["Set Name"]));
  const existing = await base44.entities.IEPConsignmentData.list();
  for (const rec of existing) await base44.entities.IEPConsignmentData.delete(rec.id);
  let count = 0;
  for (const row of valid) {
    setProgress(`Importing consignment ${count + 1} of ${valid.length}...`);
    const consCompl = toNum(row["Cons Compl"]);
    const consTotProj = toNum(row["Cons Tot Proj"]);
    const effPct = (consCompl != null && consTotProj != null && consTotProj > 0)
      ? (consCompl / consTotProj) * 100 : null;
    await base44.entities.IEPConsignmentData.create({
      adName: cleanStr(row["Ad Name"]),
      fieldSales: cleanStr(row["Field Sales"]),
      tagId: cleanStr(row["Tag Id"]),
      system: cleanStr(row["System"]),
      type: cleanStr(row["Type"]),
      setId: cleanStr(row["Set Id"]),
      setName: cleanStr(row["Set Name"]),
      consignmentId: cleanStr(row["Consignment Id"]),
      placementDate: cleanStr(row["Placement Date"]),
      returnDate: cleanStr(row["Return Date"]),
      daysKept: toNum(row["Days Kept"]),
      last2MoDaysKept: toNum(row["Last 2 Mo. Days Kept"]),
      projDaysKept: toNum(row["Proj days kept"]),
      consCompl,
      last2MoCmpl: toNum(row["Last 2 Mon. Cmpl"]),
      consTotProj,
      effPct,
      importedAt,
    });
    count++;
  }
  return count;
}

const FILE_TYPES = {
  grid6: {
    label: "Grid 6 — System Efficiency Summary",
    color: "purple",
    hint: "Columns: Name, Sys Cnt, Cons/Loaner Exp Usage, Proc Cmpl, Eff %, Eff Score…",
  },
  grid4: {
    label: "Grid 4 — Consignment Sets",
    color: "blue",
    hint: "Columns: Ad Name, Field Sales, Tag Id, System, Set Name, Cons Compl, Cons Tot Proj…",
  },
  grid5: {
    label: "Grid 5 — Loaner Sets",
    color: "green",
    hint: "Columns: AD, Field Sales, System, Set Name, Loaner Id, Etch Id, Rep, Loaner Cmpl…",
  },
};

function FileImportCard({ typeKey, onSuccess }) {
  const [file, setFile] = useState(null);
  const [isImporting, setIsImporting] = useState(false);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);
  const [detectedType, setDetectedType] = useState(null);

  const info = FILE_TYPES[typeKey];
  const colorMap = {
    purple: { ring: "border-purple-300", badge: "bg-purple-100 text-purple-700", btn: "bg-purple-600 hover:bg-purple-700" },
    blue: { ring: "border-blue-300", badge: "bg-blue-100 text-blue-700", btn: "bg-blue-600 hover:bg-blue-700" },
    green: { ring: "border-green-300", badge: "bg-green-100 text-green-700", btn: "bg-green-600 hover:bg-green-700" },
  };
  const c = colorMap[info.color];

  const handleFileChange = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setResult(null);
    setError(null);
    setDetectedType(null);

    // Peek at the file to detect type
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });
        setDetectedType(detectFileType(rows));
      } catch {
        setDetectedType(null);
      }
    };
    reader.readAsArrayBuffer(f);
  };

  const handleImport = async () => {
    if (!file || isImporting) return;
    setIsImporting(true);
    setError(null);
    setResult(null);
    setProgress("Reading file...");
    try {
      const ab = await file.arrayBuffer();
      const wb = XLSX.read(ab, { type: "array", cellDates: true });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval: "", raw: false });

      const detected = detectFileType(rows);
      if (detected !== typeKey) {
        throw new Error(`This file looks like ${detected ? FILE_TYPES[detected]?.label : "an unknown format"}, not ${info.label}. Please upload the correct file.`);
      }

      let count = 0;
      setProgress("Clearing existing data...");
      if (typeKey === "grid6") {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        count = await importViaBackend(file_url, 'grid6', setProgress);
      } else if (typeKey === "grid4") count = await importGrid4(rows, setProgress);
      else if (typeKey === "grid5") {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        count = await importViaBackend(file_url, 'grid5', setProgress);
      }

      setResult(count);
      setFile(null);
      if (onSuccess) onSuccess(typeKey, count);
    } catch (err) {
      setError(err.message || "Import failed. Please try again.");
    } finally {
      setIsImporting(false);
      setProgress(null);
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
      <div className="flex items-start gap-3 mb-4">
        <div className={`p-2 rounded-lg ${info.color === "purple" ? "bg-purple-50" : info.color === "blue" ? "bg-blue-50" : "bg-green-50"}`}>
          <FileSpreadsheet className={`w-5 h-5 ${info.color === "purple" ? "text-purple-600" : info.color === "blue" ? "text-blue-600" : "text-green-600"}`} />
        </div>
        <div>
          <h2 className="text-sm font-semibold text-slate-800">{info.label}</h2>
          <p className="text-xs text-slate-400 mt-0.5">{info.hint}</p>
        </div>
      </div>

      <div className={`border-2 border-dashed rounded-lg p-6 text-center hover:${c.ring} transition-colors mb-4 border-slate-200`}>
        <input type="file" accept=".xlsx" onChange={handleFileChange}
          className="hidden" id={`iep-file-${typeKey}`} />
        <label htmlFor={`iep-file-${typeKey}`}
          className={`cursor-pointer font-medium text-sm ${info.color === "purple" ? "text-purple-600 hover:text-purple-700" : info.color === "blue" ? "text-blue-600 hover:text-blue-700" : "text-green-600 hover:text-green-700"}`}>
          Choose Excel file (.xlsx)
        </label>
        <p className="text-xs text-slate-400 mt-1">or drag and drop</p>
        {file && (
          <div className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 bg-slate-100 rounded-lg">
            <FileSpreadsheet className="w-3.5 h-3.5 text-slate-400" />
            <span className="text-xs font-medium text-slate-700">{file.name}</span>
            {detectedType && detectedType === typeKey && (
              <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full ${c.badge}`}>✓ correct format</span>
            )}
            {detectedType && detectedType !== typeKey && (
              <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-red-100 text-red-600">⚠ wrong file</span>
            )}
          </div>
        )}
      </div>

      {progress && (
        <div className="flex items-center gap-2 text-sm text-slate-600 mb-3">
          <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
          <span>{progress}</span>
        </div>
      )}

      {result !== null && (
        <div className="flex items-start gap-2 p-3 bg-green-50 border border-green-200 rounded-lg mb-3">
          <CheckCircle className="w-4 h-4 text-green-600 mt-0.5 shrink-0" />
          <p className="text-sm text-green-800 font-medium">{result} records imported successfully.</p>
        </div>
      )}

      {error && (
        <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg mb-3">
          <AlertCircle className="w-4 h-4 text-red-500 mt-0.5 shrink-0" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      <button onClick={handleImport} disabled={!file || isImporting}
        className={`w-full h-10 flex items-center justify-center gap-2 rounded-md ${c.btn} disabled:opacity-40 disabled:cursor-not-allowed text-white font-medium text-sm transition-colors`}>
        {isImporting ? <><Loader2 className="w-4 h-4 animate-spin" /> Importing...</> : <><Upload className="w-4 h-4" /> Import</>}
      </button>
    </div>
  );
}

export default function IEPImport() {
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-3xl mx-auto px-4 py-10">
        <div className="mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-lg bg-purple-100">
              <TrendingUp className="w-6 h-6 text-purple-600" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-900">IEP Data Import</h1>
              <p className="text-sm text-slate-500 mt-0.5">Upload each file independently — they don't need to be imported together.</p>
            </div>
          </div>
          <Link to="/IEPDashboard"
            className="text-sm text-purple-600 hover:text-purple-800 font-medium underline">
            ← Back to Dashboard
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-6">
          <FileImportCard typeKey="grid6" />
          <FileImportCard typeKey="grid4" />
          <FileImportCard typeKey="grid5" />
        </div>
      </div>
    </div>
  );
}