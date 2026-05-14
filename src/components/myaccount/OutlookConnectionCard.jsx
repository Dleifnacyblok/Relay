import { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Mail, CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";

const CONNECTOR_ID = "6a0648de4330cb0974dee775";

export default function OutlookConnectionCard() {
  const [connected, setConnected] = useState(false);
  const [checking, setChecking] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [disconnecting, setDisconnecting] = useState(false);

  const checkConnection = async () => {
    setChecking(true);
    try {
      // A ping to the backend will throw if no valid Outlook token exists
      await base44.functions.invoke("sendOutlookEmail", { subject: "__ping__", body: "__ping__" });
      setConnected(true);
    } catch {
      setConnected(false);
    } finally {
      setChecking(false);
    }
  };

  useEffect(() => {
    checkConnection();
  }, []);

  const handleConnect = async () => {
    setConnecting(true);
    try {
      const url = await base44.connectors.connectAppUser(CONNECTOR_ID);
      const popup = window.open(url, "_blank");
      const timer = setInterval(() => {
        if (!popup || popup.closed) {
          clearInterval(timer);
          setConnecting(false);
          checkConnection();
        }
      }, 500);
    } catch {
      toast.error("Failed to start Outlook connection");
      setConnecting(false);
    }
  };

  const handleDisconnect = async () => {
    setDisconnecting(true);
    try {
      await base44.connectors.disconnectAppUser(CONNECTOR_ID);
      setConnected(false);
      toast.success("Outlook disconnected");
    } catch {
      toast.error("Failed to disconnect Outlook");
    } finally {
      setDisconnecting(false);
    }
  };

  return (
    <Card className="p-5 bg-white border-slate-200">
      <p className="text-xs text-slate-400 uppercase font-semibold mb-3">Outlook Integration</p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center">
            <Mail className="w-4 h-4 text-blue-600" />
          </div>
          <div>
            <p className="text-sm font-medium text-slate-800">Outlook Email</p>
            {checking ? (
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <Loader2 className="w-3 h-3 animate-spin" /> Checking...
              </p>
            ) : connected ? (
              <p className="text-xs text-green-600 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Connected
              </p>
            ) : (
              <p className="text-xs text-slate-400 flex items-center gap-1">
                <XCircle className="w-3 h-3" /> Not connected
              </p>
            )}
          </div>
        </div>

        {!checking && (
          connected ? (
            <Button
              size="sm"
              variant="outline"
              onClick={handleDisconnect}
              disabled={disconnecting}
              className="text-red-600 border-red-200 hover:bg-red-50"
            >
              {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Disconnect"}
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={handleConnect}
              disabled={connecting}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {connecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Connect"}
            </Button>
          )
        )}
      </div>
      <p className="text-xs text-slate-400 mt-3">
        Connect your Outlook account to send tracking log emails directly from the app.
      </p>
    </Card>
  );
}