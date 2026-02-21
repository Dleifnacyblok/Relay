import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Bell, Mail, Smartphone, ChevronLeft, Check } from "lucide-react";
import { toast } from "sonner";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";

const DEFAULT_PREFS = {
  overdue_inapp: true,
  overdue_email: false,
  due_soon_inapp: true,
  due_soon_email: false,
  missing_part_inapp: true,
  missing_part_email: false,
  transfer_inapp: true,
  transfer_email: false,
};

const NOTIFICATIONS = [
  {
    key: "overdue",
    label: "Overdue Loaner Reminders",
    description: "Alerts when a loaner is past its expected return date",
  },
  {
    key: "due_soon",
    label: "Due Soon Alerts",
    description: "Reminders when a loaner is due within 7 days",
  },
  {
    key: "missing_part",
    label: "Missing Part Alerts",
    description: "Notifications about new or outstanding missing parts",
  },
  {
    key: "transfer",
    label: "Transfer Notifications",
    description: "Updates when loaners are transferred to or from you",
  },
];

export default function NotificationPreferences() {
  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
  });

  const savedPrefs = user?.notification_preferences || {};
  const [prefs, setPrefs] = useState({ ...DEFAULT_PREFS, ...savedPrefs });
  const [saved, setSaved] = useState(false);

  const saveMutation = useMutation({
    mutationFn: () => base44.auth.updateMe({ notification_preferences: prefs }),
    onSuccess: () => {
      toast.success("Preferences saved");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: () => toast.error("Failed to save preferences"),
  });

  const toggle = (key) => setPrefs((prev) => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 pb-20">
      <div className="max-w-2xl mx-auto px-4 py-6 sm:py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link to={createPageUrl("MyAccount")} className="text-slate-400 hover:text-slate-700 transition-colors">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Notification Preferences</h1>
            <p className="text-slate-500 text-sm mt-0.5">Choose what you're notified about and how</p>
          </div>
        </div>

        {/* Channel Legend */}
        <div className="flex items-center gap-6 mb-4 px-1">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Smartphone className="w-4 h-4" />
            In-App
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Mail className="w-4 h-4" />
            Email
          </div>
        </div>

        {/* Notification Rows */}
        <div className="space-y-3">
          {NOTIFICATIONS.map(({ key, label, description }) => (
            <Card key={key} className="p-5 bg-white border-slate-200">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <Bell className="w-4 h-4 text-slate-400 shrink-0" />
                    <p className="font-medium text-slate-900 text-sm">{label}</p>
                  </div>
                  <p className="text-xs text-slate-500 ml-6">{description}</p>
                </div>
                <div className="flex items-center gap-5 shrink-0">
                  {/* In-App */}
                  <div className="flex flex-col items-center gap-1">
                    <Smartphone className="w-3.5 h-3.5 text-slate-400" />
                    <Switch
                      checked={prefs[`${key}_inapp`]}
                      onCheckedChange={() => toggle(`${key}_inapp`)}
                    />
                  </div>
                  {/* Email */}
                  <div className="flex flex-col items-center gap-1">
                    <Mail className="w-3.5 h-3.5 text-slate-400" />
                    <Switch
                      checked={prefs[`${key}_email`]}
                      onCheckedChange={() => toggle(`${key}_email`)}
                    />
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {/* Save Button */}
        <Button
          className="w-full mt-6"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saved ? (
            <><Check className="w-4 h-4 mr-2" />Saved!</>
          ) : saveMutation.isPending ? (
            "Saving..."
          ) : (
            "Save Preferences"
          )}
        </Button>
      </div>
    </div>
  );
}