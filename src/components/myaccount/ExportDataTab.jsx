import { useState } from "react";
import { Download, FileText, Package, AlertCircle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import ExportMyLoanersPDF from "@/components/loaners/ExportMyLoanersPDF";
import ExportMissingPartsPDF from "@/components/missingparts/ExportMissingPartsPDF";

export default function ExportDataTab({ loaners, missingParts, userName }) {
  const [showLoanersPDF, setShowLoanersPDF] = useState(false);
  const [showPartsPDF, setShowPartsPDF] = useState(false);

  const overdueCount = loaners.filter(l => l.isOverdue).length;
  const dueSoonCount = loaners.filter(l => !l.isOverdue && l.daysUntilDue != null && l.daysUntilDue <= 7).length;
  const missingCount = missingParts.filter(p => p.status === "missing").length;

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-500">Export your personal loaner and missing parts data as PDF reports.</p>

      {/* Loaners Export */}
      <Card className="p-5 bg-white border-slate-200">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-blue-50 shrink-0">
            <FileText className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 text-sm">My Loaners Report</p>
            <p className="text-xs text-slate-500 mt-0.5 mb-3">
              {loaners.length} total loaner{loaners.length !== 1 ? "s" : ""}
              {overdueCount > 0 && <span className="text-red-500 ml-2">• {overdueCount} overdue</span>}
              {dueSoonCount > 0 && <span className="text-amber-500 ml-2">• {dueSoonCount} due soon</span>}
            </p>
            <Button
              size="sm"
              onClick={() => setShowLoanersPDF(true)}
              disabled={loaners.length === 0}
              className="gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              Export PDF
            </Button>
          </div>
        </div>
      </Card>

      {/* Missing Parts Export */}
      <Card className="p-5 bg-white border-slate-200">
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-orange-50 shrink-0">
            <AlertCircle className="w-5 h-5 text-orange-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-slate-900 text-sm">My Missing Parts Report</p>
            <p className="text-xs text-slate-500 mt-0.5 mb-3">
              {missingParts.length} total part{missingParts.length !== 1 ? "s" : ""}
              {missingCount > 0 && <span className="text-orange-500 ml-2">• {missingCount} still missing</span>}
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowPartsPDF(true)}
              disabled={missingParts.length === 0}
              className="gap-2"
            >
              <Download className="w-3.5 h-3.5" />
              Export PDF
            </Button>
          </div>
        </div>
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