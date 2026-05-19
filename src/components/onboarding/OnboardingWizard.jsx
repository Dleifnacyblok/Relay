import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Check, Mail, AlertCircle } from "lucide-react";

export default function OnboardingWizard({ user, onComplete }) {
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const normalizedEmail = (user?.email || "").toLowerCase().trim();

  const { data: invitations = [], isLoading } = useQuery({
    queryKey: ["pendingInvitation", normalizedEmail],
    queryFn: () =>
      base44.entities.RepInvitation.filter({
        email: normalizedEmail,
        status: "pending",
      }),
    enabled: !!normalizedEmail,
  });

  const invitation = invitations[0] || null;

  const handleConfirm = async () => {
    if (!invitation) return;
    setSaving(true);
    setError("");
    const now = new Date().toISOString();
    try {
      await base44.auth.updateMe({
        full_name: invitation.name,
        managedAccounts: Array.isArray(invitation.accounts) ? invitation.accounts : [],
        onboardingComplete: true,
      });
      await base44.entities.RepInvitation.update(invitation.id, {
        status: "accepted",
        acceptedAt: now,
      });
      await base44.entities.AuditLog.create({
        action: "invitation_accepted",
        actorEmail: normalizedEmail,
        actorName: invitation.name,
        targetEmail: invitation.email,
        targetName: invitation.name,
        details: {
          invitationId: invitation.id,
          accounts: invitation.accounts || [],
        },
        timestamp: now,
      });
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      onComplete();
    } catch (e) {
      setError(e?.message || "Failed to accept invitation. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleLogout = () => {
    base44.auth.logout();
  };

  const headerSubtitle = isLoading
    ? "Looking up your invitation..."
    : invitation
    ? "Your manager has set up your account"
    : "Account setup required";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden"
        style={{ maxHeight: "90vh" }}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-5">
          <h2 className="text-xl font-bold text-white">Welcome to Relay</h2>
          <p className="text-blue-100 text-sm mt-0.5">{headerSubtitle}</p>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-6">
          {isLoading && (
            <div className="flex items-center justify-center py-10">
              <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin" />
            </div>
          )}

          {!isLoading && invitation && (
            <div className="space-y-4">
              <p className="text-gray-600 text-sm">
                Please review the details below and confirm to continue.
              </p>
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Rep Name</p>
                  <span className="inline-block bg-blue-100 text-blue-700 font-semibold px-3 py-1 rounded-full text-sm">
                    {invitation.name}
                  </span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Email</p>
                  <p className="text-sm text-gray-700">{invitation.email}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold mb-2">
                    Accounts ({Array.isArray(invitation.accounts) ? invitation.accounts.length : 0})
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {(invitation.accounts || []).map((acc) => (
                      <span
                        key={acc}
                        className="bg-white border border-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs"
                      >
                        {acc}
                      </span>
                    ))}
                    {(!invitation.accounts || invitation.accounts.length === 0) && (
                      <span className="text-gray-400 text-sm">No accounts assigned yet</span>
                    )}
                  </div>
                </div>
              </div>
              <p className="text-xs text-gray-500">
                If anything looks wrong, contact your manager before confirming.
              </p>
              {error && (
                <div className="flex items-start gap-2 bg-red-50 text-red-700 rounded-lg px-3 py-2 text-sm">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <span>{error}</span>
                </div>
              )}
            </div>
          )}

          {!isLoading && !invitation && (
            <div className="text-center py-6 space-y-4">
              <div className="w-14 h-14 mx-auto rounded-full bg-amber-100 flex items-center justify-center">
                <Mail className="w-7 h-7 text-amber-600" />
              </div>
              <div>
                <h3 className="font-semibold text-lg text-gray-800 mb-1">
                  Your account hasn't been set up yet
                </h3>
                <p className="text-sm text-gray-600">
                  Please contact your manager and ask them to create an invitation for{" "}
                  <span className="font-semibold">{user?.email || "your email address"}</span>.
                </p>
              </div>
              <p className="text-xs text-gray-400">
                Once they do, sign out and sign back in to continue.
              </p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          {!isLoading && invitation && (
            <Button
              onClick={handleConfirm}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? (
                "Saving..."
              ) : (
                <>
                  Confirm and Continue
                  <Check className="w-4 h-4 ml-1" />
                </>
              )}
            </Button>
          )}
          {!isLoading && !invitation && (
            <Button variant="outline" onClick={handleLogout}>
              Sign Out
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
