import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Bell, Settings, Save, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";

export default function NotificationSettingsPage() {
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
  });

  const userName = user?.full_name || "";

  const { data: existingSettings, isLoading } = useQuery({
    queryKey: ["notificationSettings", userName],
    queryFn: async () => {
      if (!userName) return null;
      const results = await base44.entities.NotificationSettings.filter({ repName: userName });
      return results?.[0] || null;
    },
    enabled: !!userName,
  });

  const [settings, setSettings] = useState({
    notifyOverdue: true,
    notifyDueSoon: true,
    notifyFines: true,
    dueSoonThresholdDays: 7,
  });

  useEffect(() => {
    if (existingSettings) {
      setSettings({
        notifyOverdue: existingSettings.notifyOverdue ?? true,
        notifyDueSoon: existingSettings.notifyDueSoon ?? true,
        notifyFines: existingSettings.notifyFines ?? true,
        dueSoonThresholdDays: existingSettings.dueSoonThresholdDays ?? 7,
      });
    }
  }, [existingSettings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const data = { ...settings, repName: userName };
      if (existingSettings?.id) {
        return base44.entities.NotificationSettings.update(existingSettings.id, data);
      } else {
        return base44.entities.NotificationSettings.create(data);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries(["notificationSettings", userName]);
    },
  });

  const runNowMutation = useMutation({
    mutationFn: () => base44.functions.invoke("generateLoanerNotifications", {}),
  });

  const toggle = (key) => setSettings(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8">
        <div className="flex items-center gap-3 mb-6">
          <div className="p-2 rounded-lg bg-blue-100">
            <Bell className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Notification Settings</h1>
            <p className="text-sm text-gray-500">Configure how you get alerted about your loaners</p>
          </div>
        </div>

        {isLoading ? (
          <div className="space-y-4">
            {[1,2,3].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 divide-y divide-gray-100">
            {/* Overdue */}
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="font-medium text-gray-900">Overdue Alerts</p>
                <p className="text-sm text-gray-500">Notify when a loaner is past its return date</p>
              </div>
              <Switch
                checked={settings.notifyOverdue}
                onCheckedChange={() => toggle("notifyOverdue")}
              />
            </div>

            {/* Due Soon */}
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="font-medium text-gray-900">Due Soon Alerts</p>
                <p className="text-sm text-gray-500">Notify when a loaner is approaching its due date</p>
              </div>
              <Switch
                checked={settings.notifyDueSoon}
                onCheckedChange={() => toggle("notifyDueSoon")}
              />
            </div>

            {/* Due Soon Threshold */}
            {settings.notifyDueSoon && (
              <div className="flex items-center justify-between px-5 py-4 bg-gray-50">
                <Label className="text-sm text-gray-700">Alert me this many days before due date</Label>
                <select
                  value={settings.dueSoonThresholdDays}
                  onChange={e => setSettings(prev => ({ ...prev, dueSoonThresholdDays: parseInt(e.target.value) }))}
                  className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm bg-white"
                >
                  {[3, 5, 7, 10, 14].map(d => (
                    <option key={d} value={d}>{d} days</option>
                  ))}
                </select>
              </div>
            )}

            {/* Fines */}
            <div className="flex items-center justify-between px-5 py-4">
              <div>
                <p className="font-medium text-gray-900">Fine Alerts</p>
                <p className="text-sm text-gray-500">Notify when a fine is incurred on a loaner</p>
              </div>
              <Switch
                checked={settings.notifyFines}
                onCheckedChange={() => toggle("notifyFines")}
              />
            </div>
          </div>
        )}

        <div className="flex gap-3 mt-6">
          <Button
            className="flex-1 gap-2"
            onClick={() => saveMutation.mutate()}
            disabled={saveMutation.isPending || isLoading}
          >
            <Save className="w-4 h-4" />
            {saveMutation.isPending ? "Saving..." : "Save Settings"}
          </Button>
          {user?.role === "admin" && (
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => runNowMutation.mutate()}
              disabled={runNowMutation.isPending}
            >
              <RefreshCw className={`w-4 h-4 ${runNowMutation.isPending ? "animate-spin" : ""}`} />
              {runNowMutation.isPending ? "Running..." : "Run Now"}
            </Button>
          )}
        </div>

        {saveMutation.isSuccess && (
          <p className="text-center text-sm text-green-600 mt-3">Settings saved!</p>
        )}
        {runNowMutation.isSuccess && (
          <p className="text-center text-sm text-green-600 mt-3">
            Notifications generated: {runNowMutation.data?.data?.created ?? 0} new alerts
          </p>
        )}

        <div className="mt-8 bg-blue-50 rounded-xl px-5 py-4 border border-blue-100">
          <div className="flex items-center gap-2 mb-1">
            <Settings className="w-4 h-4 text-blue-500" />
            <p className="text-sm font-medium text-blue-800">How it works</p>
          </div>
          <p className="text-xs text-blue-700 leading-relaxed">
            The system checks your loaners daily and generates in-app notifications based on these settings.
            Notifications appear in the bell icon in your navigation. Duplicate alerts are suppressed — you'll only get one per loaner per status until you mark it as read.
          </p>
        </div>
      </div>
    </div>
  );
}