import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Bell, X, CheckCheck, AlertCircle, Clock, Package } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { computeLoanerData } from "@/components/loaners/loanerUtils";

export default function NotificationCenter({ userName }) {
  const [open, setOpen] = useState(false);
  const [seenNotificationIds, setSeenNotificationIds] = useState(new Set());
  const queryClient = useQueryClient();

  const { data: loaners = [] } = useQuery({
    queryKey: ["loaners"],
    queryFn: () => base44.entities.Loaners.list(),
  });

  const { data: missingParts = [] } = useQuery({
    queryKey: ["missingParts"],
    queryFn: () => base44.entities.MissingPart.list(),
  });

  const { data: storedNotifications = [] } = useQuery({
    queryKey: ["notifications", userName],
    queryFn: async () => {
      if (!userName) return [];
      return base44.entities.Notification.filter({ repName: userName });
    },
    enabled: !!userName,
  });

  // Generate real-time notifications from current data
  const liveNotifications = useMemo(() => {
    if (!userName) return [];
    
    const notifications = [];
    const myLoaners = loaners
      .map(computeLoanerData)
      .filter(l => l.repName?.toLowerCase() === userName.toLowerCase());

    // Overdue loaners
    myLoaners.forEach(loaner => {
      if (loaner.risk_status === "Overdue") {
        notifications.push({
          id: `overdue-${loaner.id}`,
          type: "overdue",
          severity: "critical",
          title: "Loaner Overdue",
          message: `${loaner.setName} is ${loaner.daysOverdue} days overdue`,
          relatedLoanerId: loaner.id,
          created_date: loaner.expectedReturnDate,
        });
      } else if (loaner.risk_status === "Due Soon") {
        notifications.push({
          id: `due-soon-${loaner.id}`,
          type: "due_soon",
          severity: "warning",
          title: "Loaner Due Soon",
          message: `${loaner.setName} due in ${loaner.daysUntilDue} days`,
          relatedLoanerId: loaner.id,
          created_date: loaner.expectedReturnDate,
        });
      }
    });

    // Missing parts
    const myMissingParts = missingParts.filter(
      p => p.repName?.toLowerCase() === userName.toLowerCase() && p.status === "missing"
    );

    myMissingParts.forEach(part => {
      notifications.push({
        id: `missing-part-${part.id}`,
        type: "missing_part",
        severity: "warning",
        title: "Missing Part",
        message: `${part.partName}${part.partNumber ? ` (#${part.partNumber})` : ""}`,
        relatedPartId: part.id,
        created_date: part.missingDate,
      });
    });

    return notifications;
  }, [loaners, missingParts, userName]);

  const allNotifications = [...storedNotifications, ...liveNotifications];
  const unreadCount = allNotifications.filter(n => !n.isRead && !seenNotificationIds.has(n.id)).length;

  // Mark all notifications as seen when panel opens
  useEffect(() => {
    if (open && allNotifications.length > 0) {
      const newSeenIds = new Set(seenNotificationIds);
      allNotifications.forEach(n => newSeenIds.add(n.id));
      setSeenNotificationIds(newSeenIds);
    }
  }, [open]);

  const markAllReadMutation = useMutation({
    mutationFn: async () => {
      const unread = storedNotifications.filter(n => !n.isRead);
      for (const notification of unread) {
        await base44.entities.Notification.update(notification.id, { isRead: true });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["notifications", userName]);
    },
  });

  const getIcon = (type) => {
    switch (type) {
      case "overdue":
        return <AlertCircle className="w-4 h-4 text-red-500" />;
      case "due_soon":
        return <Clock className="w-4 h-4 text-amber-500" />;
      case "missing_part":
        return <Package className="w-4 h-4 text-orange-500" />;
      case "loaner_request":
        return <Bell className="w-4 h-4 text-blue-500" />;
      default:
        return <Bell className="w-4 h-4 text-slate-500" />;
    }
  };

  const getSeverityColor = (severity) => {
    switch (severity) {
      case "critical":
        return "bg-red-50 border-red-200";
      case "warning":
        return "bg-amber-50 border-amber-200";
      default:
        return "bg-slate-50 border-slate-200";
    }
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-5 h-5" />
          {unreadCount > 0 && (
            <Badge 
              className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center bg-red-500 hover:bg-red-600 text-white text-xs"
            >
              {unreadCount > 9 ? "9+" : unreadCount}
            </Badge>
          )}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full sm:w-96 p-0">
        <SheetHeader className="p-4 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle className="text-lg font-semibold">Notifications</SheetTitle>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => markAllReadMutation.mutate()}
                disabled={markAllReadMutation.isPending}
              >
                <CheckCheck className="w-4 h-4 mr-2" />
                Mark all read
              </Button>
            )}
          </div>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-80px)]">
          {allNotifications.length === 0 ? (
            <div className="p-12 text-center">
              <Bell className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">No notifications</p>
              <p className="text-sm text-slate-500 mt-1">
                You're all caught up!
              </p>
            </div>
          ) : (
            <div className="divide-y">
              {allNotifications.map((notification) => (
                <div
                  key={notification.id}
                  className={`p-4 hover:bg-slate-50 transition-colors ${
                    !notification.isRead ? "bg-blue-50/30" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div className={`p-2 rounded-lg ${getSeverityColor(notification.severity)}`}>
                      {getIcon(notification.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-medium text-sm text-slate-900">
                          {notification.title}
                        </p>
                        {!notification.isRead && (
                          <div className="w-2 h-2 rounded-full bg-blue-500 shrink-0 mt-1" />
                        )}
                      </div>
                      <p className="text-sm text-slate-600 mt-0.5">
                        {notification.message}
                      </p>
                      {notification.relatedLoanerId && (
                        <Link
                          to={createPageUrl("LoanerDetail") + `?id=${notification.relatedLoanerId}`}
                          className="text-xs text-blue-600 hover:text-blue-700 mt-2 inline-block"
                          onClick={() => setOpen(false)}
                        >
                          View loaner →
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}