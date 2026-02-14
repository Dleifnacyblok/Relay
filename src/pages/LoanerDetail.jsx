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
  Users, 
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
import { computeLoanerFields, formatCurrency } from "@/components/loaners/loanerUtils";

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
      return loaners[0] ? computeLoanerFields(loaners[0]) : null;
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
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
        {/* Back Button */}
        <Link 
          to={createPageUrl("Dashboard")}
          className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-900 mb-6 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span className="text-sm font-medium">Back</span>
        </Link>

        {/* Header Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 mb-6">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{loaner.set_name}</h1>
              <p className="text-slate-500 mt-1">{loaner.set_id}</p>
            </div>
            <RiskBadge riskStatus={loaner.risk_status} />
          </div>

          {/* Risk Summary */}
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
                      ? `${loaner.days_overdue} days overdue`
                      : `Due in ${loaner.days_until_due} days`
                    }
                  </p>
                  {loaner.fine_exposure > 0 && (
                    <p className="text-sm text-red-700">
                      Fine exposure: {formatCurrency(loaner.fine_exposure)}
                    </p>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Details Card */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm divide-y divide-slate-100">
          <div className="p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-2">Loaner Details</h2>
            
            <div className="grid sm:grid-cols-2 gap-x-6">
              <DetailRow 
                icon={Building2} 
                label="Account" 
                value={loaner.account_name} 
              />
              <DetailRow 
                icon={Package} 
                label="Status" 
                value={loaner.status} 
              />
              <DetailRow 
                icon={User} 
                label="Primary Rep" 
                value={loaner.primary_rep} 
              />
              <DetailRow 
                icon={Users} 
                label="Associate Rep" 
                value={loaner.associate_rep_display} 
              />
              <DetailRow 
                icon={Calendar} 
                label="Loaned Date" 
                value={formatDate(loaner.loaned_date)} 
              />
              <DetailRow 
                icon={Calendar} 
                label="Expected Return" 
                value={formatDate(loaner.expected_return_date)} 
              />
            </div>
          </div>

          {/* Risk Metrics */}
          <div className="p-6">
            <h2 className="text-lg font-semibold text-slate-900 mb-4">Risk Metrics</h2>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="bg-slate-50 rounded-lg p-4 text-center">
                <Clock className="w-5 h-5 text-slate-400 mx-auto mb-2" />
                <p className="text-2xl font-bold text-slate-900">
                  {loaner.days_until_due !== null ? loaner.days_until_due : "—"}
                </p>
                <p className="text-xs text-slate-500">Days Until Due</p>
              </div>
              
              <div className={`rounded-lg p-4 text-center ${
                loaner.days_overdue > 0 ? "bg-red-50" : "bg-slate-50"
              }`}>
                <AlertTriangle className={`w-5 h-5 mx-auto mb-2 ${
                  loaner.days_overdue > 0 ? "text-red-500" : "text-slate-400"
                }`} />
                <p className={`text-2xl font-bold ${
                  loaner.days_overdue > 0 ? "text-red-700" : "text-slate-900"
                }`}>
                  {loaner.days_overdue}
                </p>
                <p className="text-xs text-slate-500">Days Overdue</p>
              </div>
              
              <div className={`rounded-lg p-4 text-center col-span-2 ${
                loaner.fine_exposure > 0 ? "bg-red-50" : "bg-slate-50"
              }`}>
                <DollarSign className={`w-5 h-5 mx-auto mb-2 ${
                  loaner.fine_exposure > 0 ? "text-red-500" : "text-slate-400"
                }`} />
                <p className={`text-2xl font-bold ${
                  loaner.fine_exposure > 0 ? "text-red-700" : "text-slate-900"
                }`}>
                  {formatCurrency(loaner.fine_exposure)}
                </p>
                <p className="text-xs text-slate-500">Fine Exposure ($50/day)</p>
              </div>
            </div>
          </div>

          {/* Notes Section */}
          <div className="p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <FileText className="w-5 h-5 text-slate-400" />
                <h2 className="text-lg font-semibold text-slate-900">Notes</h2>
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