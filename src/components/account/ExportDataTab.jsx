import { useState } from "react";
import { Download, FileText, Package, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import ExportMyLoanersPDF from "@/components/loaners/ExportMyLoanersPDF";
import ExportMissingPartsPDF from "@/components/missingparts/ExportMissingPartsPDF";

export default function ExportDataTab({ loaners, missingParts, userName }) {
  const [showLoanersPDF, setShowLoanersPDF] = useState(false);
  const [showPartsPDF, setShowPartsPDF] = useState(false);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500 mb-2">Export your personal loaner and missing parts data as a PDF report.</p>

      <Card
        className="p-5 bg-white border-slate-200 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
        onClick={() => setShowLoanersPDF(true)}
      >
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-blue-50">
            <Package className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">My Loaners Report</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {loaners.length} active loaner{loaners.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2 shrink-0">
          <Download className="w-4 h-4" /> Export PDF
        </Button>
      </Card>

      <Card
        className="p-5 bg-white border-slate-200 flex items-center justify-between hover:bg-slate-50 transition-colors cursor-pointer"
        onClick={() => setShowPartsPDF(true)}
      >
        <div className="flex items-center gap-4">
          <div className="p-3 rounded-xl bg-amber-50">
            <AlertCircle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">My Missing Parts Report</p>
            <p className="text-xs text-slate-500 mt-0.5">
              {missingParts.length} missing part{missingParts.length !== 1 ? "s" : ""}
            </p>
          </div>
        </div>
        <Button variant="outline" size="sm" className="gap-2 shrink-0">
          <Download className="w-4 h-4" /> Export PDF
        </Button>
      </Card>

      <ExportMyLoanersPDF
        open={showLoanersPDF}
        onClose={() => setShowLoanersPDF(false)}
        loaners={loaners}
        userName={userName}
      />
      <ExportMissingPartsPDF
        open={showPartsPDF}
        onClose={() => setShowPartsPDF(false)}
        parts={missingParts}
        userName={userName}
      />
    </div>
  );
}