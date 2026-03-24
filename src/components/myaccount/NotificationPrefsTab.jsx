import { useState, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Bell, Mail, Smartphone, Check } from "lucide-react";
import { toast } from "sonner";

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
  { key: "overdue", label: "Overdue Loaner Reminders", description: "Alerts when a loaner is past its expected return date" },
  { key: "due_soon", label: "Due Soon Alerts", description: "Reminders when a loaner is due within 7 days" },
  { key: "missing_part", label: "Missing Part Alerts", description: "Notifications about new or outstanding missing parts" },
  { key: "transfer", label: "Transfer Notifications", description: "Updates when loaners are transferred to or from you" },
];

export default function NotificationPrefsTab({ user }) {
  const [prefs, setPrefs] = useState(DEFAULT_PREFS);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (user?.notification_preferences) {
      setPrefs(prev => ({ ...prev, ...user.notification_preferences }));
    }
  }, [user]);

  const saveMutation = useMutation({
    mutationFn: () => base44.auth.updateMe({ notification_preferences: prefs }),
    onSuccess: () => {
      toast.success("Preferences saved");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
    onError: () => toast.error("Failed to save preferences"),
  });

  const toggle = (key) => setPrefs(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-6 mb-1 px-1">
        <div className="flex items-center gap-2 text-xs text-slate-400"><Smartphone className="w-3.5 h-3.5" /> In-App</div>
        <div className="flex items-center gap-2 text-xs text-slate-400"><Mail className="w-3.5 h-3.5" /> Email</div>
      </div>

      {NOTIFICATIONS.map(({ key, label, description }) => (
        <Card key={key} className="p-4 bg-white border-slate-200">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-0.5">
                <Bell className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                <p className="font-medium text-slate-900 text-sm">{label}</p>
              </div>
              <p className="text-xs text-slate-500 ml-5">{description}</p>
            </div>
            <div className="flex items-center gap-5 shrink-0">
              <div className="flex flex-col items-center gap-1">
                <Smartphone className="w-3 h-3 text-slate-400" />
                <Switch checked={prefs[`${key}_inapp`]} onCheckedChange={() => toggle(`${key}_inapp`)} />
              </div>
              <div className="flex flex-col items-center gap-1">
                <Mail className="w-3 h-3 text-slate-400" />
                <Switch checked={prefs[`${key}_email`]} onCheckedChange={() => toggle(`${key}_email`)} />
              </div>
            </div>
          </div>
        </Card>
      ))}

      <Button className="w-full mt-2" onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
        {saved ? <><Check className="w-4 h-4 mr-2" />Saved!</> : saveMutation.isPending ? "Saving..." : "Save Preferences"}
      </Button>
    </div>
  );
}