import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, User, Building2, ChevronRight, Check, Plus, X } from "lucide-react";

export default function OnboardingWizard({ user, onComplete }) {
  const [step, setStep] = useState(1);
  const [displayName, setDisplayName] = useState(user?.full_name || "");
  const [selectedAccounts, setSelectedAccounts] = useState([]);
  const [customAccount, setCustomAccount] = useState("");
  const [saving, setSaving] = useState(false);

  const queryClient = useQueryClient();

  // Fetch all loaners to suggest accounts
  const { data: loaners = [] } = useQuery({
    queryKey: ["allLoanersForOnboarding"],
    queryFn: () => base44.entities.Loaners.list(),
  });

  // Suggest accounts based on name matching in repName / associateSalesRep / fieldSalesRep
  const suggestedAccounts = useMemo(() => {
    if (!displayName.trim()) return [];
    const nameLower = displayName.trim().toLowerCase();
    const matched = loaners
      .filter(l => {
        const rep = (l.repName || "").toLowerCase();
        const assoc = (l.associateSalesRep || "").toLowerCase();
        const field = (l.fieldSalesRep || "").toLowerCase();
        return rep.includes(nameLower) || assoc.includes(nameLower) || field.includes(nameLower)
          || nameLower.includes(rep.split(" ")[0]) || nameLower.includes(assoc.split(" ")[0]);
      })
      .map(l => l.accountName)
      .filter(Boolean);
    return [...new Set(matched)].sort();
  }, [loaners, displayName]);

  const toggleAccount = (acct) => {
    setSelectedAccounts(prev =>
      prev.includes(acct) ? prev.filter(a => a !== acct) : [...prev, acct]
    );
  };

  const addCustomAccount = () => {
    const trimmed = customAccount.trim();
    if (trimmed && !selectedAccounts.includes(trimmed)) {
      setSelectedAccounts(prev => [...parev, trimmed]);
    }
    setCustomAccount("");
  };

  const handleFinish = async () => {
    setSaving(true);
    await base44.auth.updateMe({
      displayName,
      managedAccounts: selectedAccounts,
      onboardingComplete: true,
    });
    queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    setSaving(false);
    onComplete();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <Card className="w-full max-w-lg bg-white rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-5 text-white">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-9 h-9 rounded-full bg-white/20 flex items-center justify-center">
              <span className="text-white font-bold text-base">{user?.full_name?.charAt(0) || "R"}</span>
            </div>
            <div>
              <h2 className="font-semibold text-lg leading-tight">Welcome to Relay</h2>
              <p className="text-blue-100 text-xs">Let's set up your account</p>
            </div>
          </div>
          {/* Step indicators */}
          <div className="flex items-center gap-2 mt-4">
            {[1, 2, 3].map(s => (
              <div key={s} className={`flex items-center gap-2`}>
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                  step > s ? "bg-white text-blue-600" : step === s ? "bg-white/30 text-white border-2 border-white" : "bg-white/10 text-white/50"
                }`}>
                  {step > s ? <Check className="w-3 h-3" /> : s}
                </div>
                {s < 3 && <div className={`h-0.5 w-8 rounded-full ${step > s ? "bg-white" : "bg-white/20"}`} />}
              </div>
            ))}
            <span className="text-blue-100 text-xs ml-2">Step {step} of 3</span>
          </div>
        </div>

        <div className="p-6">
          {/* Step 1: Name confirmation */}
          {step === 1 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <User className="w-5 h-5 text-blue-500" />
                <h3 className="font-semibold text-slate-800">Confirm Your Name</h3>
              </div>
              <p className="text-sm text-slate-500 mb-4">
                This is how your name appears in the system. It's used to match loaners and records to you — make sure it matches exactly.
              </p>
              <div className="mb-2">
                <label className="text-xs font-medium text-slate-500 mb-1 block">Display Name</label>
                <Input
                  value={displayName}
                  onChange={e => setDisplayName(e.target.value)}
                  placeholder="Your full name"
                  className="text-base"
                />
              </div>
              <p className="text-xs text-slate-400 mt-2">Account registered as: <span className="font-medium text-slate-600">{user?.full_name}</span></p>
            </div>
          )}

          {/* Step 2: Account selection */}
          {step === 2 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Building2 className="w-5 h-5 text-blue-500" />
                <h3 className="font-semibold text-slate-800">Your Accounts</h3>
              </div>
              <p className="text-sm text-slate-500 mb-4">
                Select the hospital accounts you're responsible for. We've suggested some based on your loaner history.
              </p>

              {suggestedAccounts.length > 0 && (
                <div className="mb-4">
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Suggested from your history</p>
                  <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto">
                    {suggestedAccounts.map(acct => (
                      <button
                        key={acct}
                        onClick={() => toggleAccount(acct)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm border transition-all ${
                          selectedAccounts.includes(acct)
                            ? "bg-blue-600 text-white border-blue-600"
                            : "bg-white text-slate-700 border-slate-200 hover:border-blue-300"
                        }`}
                      >
                        {selectedAccounts.includes(acct) && <Check className="w-3 h-3" />}
                        {acct}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="mb-3">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Add account manually</p>
                <div className="flex gap-2">
                  <Input
                    value={customAccount}
                    onChange={e => setCustomAccount(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addCustomAccount()}
                    placeholder="Type account name..."
                    className="text-sm"
                  />
                  <Button variant="outline" size="icon" onClick={addCustomAccount}><Plus className="w-4 h-4" /></Button>
                </div>
              </div>

              {selectedAccounts.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Selected ({selectedAccounts.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedAccounts.map(acct => (
                      <Badge key={acct} variant="secondary" className="flex items-center gap-1 pr-1">
                        {acct}
                        <button onClick={() => toggleAccount(acct)} className="ml-1 hover:text-red-500">
                          <X className="w-3 h-3" />
                        </button>
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Confirm */}
          {step === 3 && (
            <div className="text-center py-4">
              <CheckCircle2 className="w-14 h-14 text-green-500 mx-auto mb-4" />
              <h3 className="font-semibold text-slate-800 text-lg mb-2">You're all set!</h3>
              <p className="text-sm text-slate-500 mb-5">Here's a summary of your profile setup:</p>
              <div className="text-left space-y-3 bg-slate-50 rounded-xl p-4 mb-2">
                <div>
                  <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide">Name in System</p>
                  <p className="font-medium text-slate-800">{displayName}</p>
                </div>
                <div>
                  <p className="text-xs text-slate-400 uppercase font-semibold tracking-wide">Managed Accounts ({selectedAccounts.length})</p>
                  {selectedAccounts.length === 0
                    ? <p className="text-sm text-slate-400 italic">None selected</p>
                    : <p className="text-sm text-slate-700">{selectedAccounts.join(", ")}</p>
                  }
                </div>
              </div>
              <p className="text-xs text-slate-400">You can update this anytime from My Account.</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 pb-6 flex justify-between items-center">
          {step > 1
            ? <Button variant="ghost" onClick={() => setStep(s => s - 1)} className="text-slate-500">Back</Button>
            : <div />
          }
          {step < 3
            ? <Button
                onClick={() => setStep(s => s + 1)}
                disabled={step === 1 && !displayName.trim()}
                className="bg-blue-600 hover:bg-blue-700 text-white gap-2"
              >
                Continue <ChevronRight className="w-4 h-4" />
              </Button>
            : <Button
                onClick={handleFinish}
                disabled={saving}
                className="bg-green-600 hover:bg-green-700 text-white gap-2"
              >
                {saving ? "Saving..." : "Complete Setup"}
              </Button>
          }
        </div>
      </Card>
    </div>
  );
}