import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { HandCoins, Clock, AlertCircle } from "lucide-react";

export default function LoanerRequests({ loanerId }) {
  const { data: requests = [] } = useQuery({
    queryKey: ["loanerRequests", loanerId],
    queryFn: async () => {
      const allRequests = await base44.entities.LoanerRequest.filter({ 
        loanerId,
        status: "pending"
      });
      return allRequests;
    },
    enabled: !!loanerId,
  });

  if (requests.length === 0) {
    return null;
  }

  const urgencyColors = {
    low: "bg-blue-100 text-blue-700",
    medium: "bg-amber-100 text-amber-700",
    high: "bg-red-100 text-red-700",
  };

  const urgencyIcons = {
    low: Clock,
    medium: AlertCircle,
    high: AlertCircle,
  };

  return (
    <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="flex items-center gap-2 mb-3">
        <HandCoins className="w-5 h-5 text-blue-600" />
        <h3 className="font-semibold text-blue-900">
          Pending Requests ({requests.length})
        </h3>
      </div>
      
      <div className="space-y-3">
        {requests.map((request) => {
          const UrgencyIcon = urgencyIcons[request.urgency];
          return (
            <div key={request.id} className="bg-white rounded-lg p-3 border border-blue-100">
              <div className="flex items-start justify-between gap-2 mb-2">
                <div>
                  <p className="font-medium text-slate-900">{request.requesterName}</p>
                  <p className="text-sm text-slate-600">
                    For: {request.accountName}
                  </p>
                </div>
                <Badge className={urgencyColors[request.urgency]}>
                  <UrgencyIcon className="w-3 h-3 mr-1" />
                  {request.urgency}
                </Badge>
              </div>
              
              {request.reason && (
                <p className="text-sm text-slate-600 mt-2 italic">
                  "{request.reason}"
                </p>
              )}
              
              <p className="text-xs text-slate-400 mt-2">
                Requested {new Date(request.created_date).toLocaleDateString()}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}