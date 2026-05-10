import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { ShoppingBag, Bell, CheckCheck, X, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function RequestedNotificationsCard({ userName }) {
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ["requestedNotifications", userName],
    queryFn: async () => {
      if (!userName) return [];
      const all = await base44.entities.Notification.filter({ repName: userName });
      return all.filter(n =>
        (n.type === "marketplace_match" || n.type === "loaner_request_status") && !n.isRead
      );
    },
    enabled: !!userName,
    refetchInterval: 30000,
  });

  const dismissMutation = useMutation({
    mutationFn: (id) => base44.entities.Notification.update(id, { isRead: true }),
    onSuccess: () => {
      queryClient.invalidateQueries(["requestedNotifications", userName]);
      queryClient.invalidateQueries(["notifications", userName]);
    },
  });

  const dismissAllMutation = useMutation({
    mutationFn: async () => {
      await Promise.all(notifications.map(n => base44.entities.Notification.update(n.id, { isRead: true })));
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["requestedNotifications", userName]);
      queryClient.invalidateQueries(["notifications", userName]);
    },
  });

  if (notifications.length === 0) return null;

  const typeConfig = {
    marketplace_match: {
      icon: ShoppingBag,
      iconColor: "text-emerald-600",
      bg: "bg-emerald-50",
      border: "border-emerald-200",
      accentBar: "bg-emerald-500",
      label: "Marketplace",
    },
    loaner_request_status: {
      icon: Bell,
      iconColor: "text-blue-600",
      bg: "bg-blue-50",
      border: "border-blue-200",
      accentBar: "bg-blue-500",
      label: "Request Update",
    },
  };

  return (
    <div className="mb-5">
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          🔔 New Alerts ({notifications.length})
        </p>
        {notifications.length > 1 && (
          <button
            onClick={() => dismissAllMutation.mutate()}
            disabled={dismissAllMutation.isPending}
            className="text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1"
          >
            <CheckCheck className="w-3 h-3" /> Dismiss all
          </button>
        )}
      </div>

      <div className="space-y-2">
        {notifications.map((n) => {
          const config = typeConfig[n.type] || typeConfig.loaner_request_status;
          const Icon = config.icon;

          return (
            <div
              key={n.id}
              className={`relative flex items-start gap-3 p-4 rounded-xl border ${config.bg} ${config.border} shadow-sm overflow-hidden`}
            >
              {/* Left accent bar */}
              <div className={`absolute left-0 top-0 bottom-0 w-1 ${config.accentBar} rounded-l-xl`} />

              <div className={`ml-1 w-9 h-9 rounded-lg flex items-center justify-center shrink-0 bg-white shadow-sm`}>
                <Icon className={`w-4 h-4 ${config.iconColor}`} />
              </div>

              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-0.5">{config.label}</p>
                <p className="text-sm font-semibold text-gray-900 leading-snug">{n.title}</p>
                <p className="text-xs text-gray-600 mt-0.5 leading-snug">{n.message}</p>

                {n.relatedMarketplaceItemId && (
                  <Link
                    to={createPageUrl("Marketplace")}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-emerald-700 hover:text-emerald-900"
                  >
                    View on Marketplace <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
                {n.relatedLoanerId && !n.relatedMarketplaceItemId && (
                  <Link
                    to={createPageUrl("LoanerDetail") + `?id=${n.relatedLoanerId}`}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-700 hover:text-blue-900"
                  >
                    View Loaner <ExternalLink className="w-3 h-3" />
                  </Link>
                )}
              </div>

              <button
                onClick={() => dismissMutation.mutate(n.id)}
                disabled={dismissMutation.isPending}
                className="shrink-0 text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}