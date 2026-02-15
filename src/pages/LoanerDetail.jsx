import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, parseISO } from "date-fns";
import { 
  ArrowLeft, 
  Calendar, 
  Building2, 
  User, 
  Package,
  Clock,
  DollarSign,
  AlertTriangle,
  FileText,
  Save
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import RiskBadge from "@/components/loaners/RiskBadge";
import { computeLoanerData, formatCurrency } from "@/components/loaners/loanerUtils";
import RequestLoanerDialog from "@/components/loaners/RequestLoanerDialog";
import LoanerRequests from "@/components/loaners/LoanerRequests";

export default function LoanerDetail() {
  const urlParams = new URLSearchParams(window.location.search);
  const loanerId = urlParams.get("id");
  const queryClient = useQueryClient();

  const [notes, setNotes] = useState("");
  const [isEditingNotes, setIsEditingNotes] = useState(false);

  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
  });

  const { data: loaner, isLoading } = useQuery({
    queryKey: ["loaner", loanerId],
    queryFn: async () => {
      const loaners = await base44.entities.Loaners.filter({ id: loanerId });
      return loaners[0] ? computeLoanerData(loaners[0]) : null;
    },
    enabled: !!loanerId,
  });

  useEffect(() => {
    if (loaner?.notes) {
      setNotes(loaner.notes);
    }
  }, [loaner?.notes]);

  const updateNotesMutation = useMutation({
    mutationFn: (newNotes) => 
      base44.entities.Loaners.update(loanerId, { notes: newNotes }),
    onSuccess: () => {
      queryClient.invalidateQueries(["loaner", loanerId]);
      setIsEditingNotes(false);
    },
  });

  const toggleFeesWaivedMutation = useMutation({
    mutationFn: (waived) => 
      base44.entities.Loaners.update(loanerId, { feesWaived: waived }),
    onSuccess: () => {
      queryClient.invalidateQueries(["loaner", loanerId]);
    },
  });

  const isAdmin = user?.role === "admin";

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      return format(parseISO(dateStr), "MMMM d, yyyy");
    } catch {
      return dateStr;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 p-4 sm:p-8">
        <div className="max-w-3xl mx-auto">
          <Skeleton className="h-8 w-32 mb-6" />
          <Skeleton className="h-48 rounded-xl mb-6" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!loaner) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 flex items-center justify-center p-4">
        <div className="text-center">
          <Package className="w-12 h-12 text-slate-300 mx-auto mb-4" />
          <p className="text-slate-600 font-medium">Loaner not found</p>
          <Link to={createPageUrl("Dashboard")}>
            <Button variant="outline" className="mt-4">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const DetailRow = ({ icon: Icon, label, value, highlight }) => (
    <div className="flex items-start gap-3 py-3">
      <div className="p-2 rounded-lg bg-slate-100 shrink-0">
        <Icon className="w-4 h-4 text-slate-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm text-slate-500">{label}</p>
        <p className={`font-medium ${highlight ? highlight : "text-slate-900"}`}>
          {value || "—"}
        </p>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen" style={{backgroundColor: '#FFFFFF'}}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        <Link 
          to={createPageUrl("Dashboard")}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back</span>
        </Link>

        <div className="rounded-xl py-6 px-6 mb-6" style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #EEEEEE',
          boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.06)'
        }}>
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold" style={{color: '#000000'}}>{loaner.setName}</h1>
              <p className="mt-1">
                <span style={{color: '#777777'}}>Etch ID: </span>
                <span style={{color: '#222222', letterSpacing: '0.02em'}}>{loaner.etchId || "(missing)"}</span>
              </p>
            </div>
            <RiskBadge riskStatus={loaner.risk_status} />
          </div>

          <RequestLoanerDialog loaner={loaner} currentUser={user} />

          {loaner.risk_status !== "Safe" && (
            <div className={`mt-6 p-4 rounded-lg ${
              loaner.risk_status === "Overdue" 
                ? "bg-red-50 border border-red-200" 
                : "bg-amber-50 border border-amber-200"
            }`}>
              <div className="flex items-center gap-3">
                <AlertTriangle className={`w-5 h-5 ${
                  loaner.risk_status === "Overdue" ? "text-red-600" : "text-amber-600"
                }`} />
                <div>
                  <p className={`font-semibold ${
                    loaner.risk_status === "Overdue" ? "text-red-900" : "text-amber-900"
                  }`}>
                    {loaner.risk_status === "Overdue" 
                      ? `${loaner.daysOverdue} days overdue`
                      : `Due in ${loaner.daysUntilDue} days`
                    }
                  </p>
                  {loaner.fineAmount > 0 && (
                    <p className="text-sm text-red-700">
                      Fine exposure: {formatCurrency(loaner.fineAmount)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        <LoanerRequests loanerId={loanerId} />

        <div className="rounded-xl divide-y divide-slate-100 mt-6" style={{
          backgroundColor: '#FFFFFF',
          border: '1px solid #EEEEEE',
          boxShadow: '0px 8px 24px rgba(0, 0, 0, 0.06)'
        }}>
          <div className="py-6 px-6">
            <h2 className="text-lg font-semibold mb-2" style={{color: '#111111'}}>Loaner Details</h2>
            
            <div className="grid sm:grid-cols-2 gap-x-6">
              <DetailRow icon={Package} label="Etch ID" value={loaner.etchId} />
              <DetailRow icon={Building2} label="Account" value={loaner.accountName} />
              <DetailRow icon={User} label="Rep" value={loaner.repName} />
              <DetailRow icon={Calendar} label="Expected Return" value={formatDate(loaner.expectedReturnDate)} />
            </div>
          </div>

          <div className="py-6 px-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold" style={{color: '#111111'}}>Risk Metrics</h2>
              {loaner.fineAmount > 0 && (
                <Button
                  variant={loaner.feesWaived ? "outline" : "default"}
                  size="sm"
                  onClick={() => toggleFeesWaivedMutation.mutate(!loaner.feesWaived)}
                  disabled={toggleFeesWaivedMutation.isPending}
                  className={loaner.feesWaived ? "" : "bg-green-600 hover:bg-green-700"}
                >
                  {loaner.feesWaived ? "Unwaive Fees" : "Waive Fees"}
                </Button>
              )}
            </div>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <Clock className="w-5 h-5 text-slate-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-slate-900">
                  {loaner.daysUntilDue !== null && loaner.daysUntilDue !== undefined ? loaner.daysUntilDue : "—"}
                </p>
                <p className="text-xs text-slate-500">Days Until Due</p>
              </div>
              
              <div className={`rounded-lg p-4 text-center ${
                loaner.daysOverdue > 0 ? "bg-red-50" : "bg-slate-50"
              }`}>
                <AlertTriangle className={`w-5 h-5 mx-auto mb-2 ${
                  loaner.daysOverdue > 0 ? "text-red-500" : "text-slate-400"
                }`} />
                <p className={`text-2xl font-bold ${
                  loaner.daysOverdue > 0 ? "text-red-700" : "text-slate-900"
                }`}>
                  {loaner.daysOverdue}
                </p>
                <p className="text-xs text-slate-500">Days Overdue</p>
              </div>
              
              <div className={`rounded-lg p-4 text-center col-span-2 ${
                loaner.fineAmount > 0 ? (loaner.feesWaived ? "bg-green-50" : "bg-red-50") : "bg-slate-50"
              }`}>
                <DollarSign className={`w-5 h-5 mx-auto mb-2 ${
                  loaner.fineAmount > 0 ? (loaner.feesWaived ? "text-green-500" : "text-red-500") : "text-slate-400"
                }`} />
                <div>
                  <p className={`text-2xl font-bold ${
                    loaner.fineAmount > 0 ? (loaner.feesWaived ? "text-green-700 line-through" : "text-red-700") : "text-slate-900"
                  }`}>
                    {formatCurrency(loaner.fineAmount)}
                  </p>
                  {loaner.feesWaived && (
                    <p className="text-xs text-green-700 font-semibold mt-1">Fees Waived</p>
                  )}
                </div>
                <p className="text-xs text-slate-500">Fine Exposure ($50/day)</p>
              </div>
            </div>
          </div>

          <div className="py-6 px-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-400" />
                <h2 className="text-lg font-semibold" style={{color: '#111111'}}>Notes</h2>
              </div>
              {isAdmin && !isEditingNotes && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => setIsEditingNotes(true)}
                >
                  Edit
                </Button>
              )}
            </div>

            {isEditingNotes ? (
              <div className="space-y-3">
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add notes about this loaner..."
                  rows={4}
                  className="resize-none"
                />
                <div className="flex gap-2 justify-end">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => {
                      setNotes(loaner.notes || "");
                      setIsEditingNotes(false);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button 
                    size="sm"
                    onClick={() => updateNotesMutation.mutate(notes)}
                    disabled={updateNotesMutation.isPending}
                  >
                    <Save className="w-4 h-4 mr-2" />
                    Save
                  </Button>
                </div>
              </div>
            ) : (
              <div className="bg-slate-50 rounded-lg p-4 min-h-[80px]">
                {loaner.notes ? (
                  <p className="text-slate-700 whitespace-pre-wrap">{loaner.notes}</p>
                ) : (
                  <p className="text-slate-400 italic">No notes added</p>
                )}
                {!isAdmin && (
                  <p className="text-xs text-slate-400 mt-3">Only admins can edit notes</p>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}