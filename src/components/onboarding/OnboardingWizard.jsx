import { useState, useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, Search, Plus, PlayCircle, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";
import AppTour from "./AppTour";

export default function OnboardingWizard({ user, onComplete }) {
  const queryClient = useQueryClient();
  const [step, setStep] = useState(1);
  const [search1, setSearch1] = useState("");
  const [search2, setSearch2] = useState("");
  const [selectedRepName, setSelectedRepName] = useState(user?.full_name || "");
  const [selectedAccounts, setSelectedAccounts] = useState(user?.managedAccounts || []);
  const [manualAccount, setManualAccount] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");

  const { data: assignments = [] } = useQuery({
    queryKey: ["repAccountAssignments"],
    queryFn: () => base44.entities.RepAccountAssignment.list(),
  });

  // Unique sorted rep names across all assignedReps arrays
  const repNames = [...new Set(
    assignments.flatMap(a => Array.isArray(a.assignedReps) ? a.assignedReps : (a.assignedRep ? [a.assignedRep] : []))
      .filter(Boolean)
  )].sort();

  // Accounts where selected rep is assigned
  const repAccounts = [...new Set(
    assignments
      .filter(a => {
        const reps = Array.isArray(a.assignedReps) ? a.assignedReps : (a.assignedRep ? [a.assignedRep] : []);
        return reps.includes(selectedRepName);
      })
      .map(a => a.accountName).filter(Boolean)
  )].sort();

  // Auto-init selectedRepName from user if it matches a rep
  useEffect(() => {
    if (assignments.length && user?.full_name && repNames.includes(user.full_name)) {
      setSelectedRepName(user.full_name);
    }
  }, [assignments.length]);

  // When rep changes, pre-select all accounts (or restore saved ones)
  useEffect(() => {
    if (selectedRepName) {
      const saved = user?.managedAccounts;
      if (saved && saved.length > 0) {
        setSelectedAccounts(saved);
      } else {
        setSelectedAccounts(repAccounts);
      }
    }
  }, [selectedRepName, assignments.length]);

  const filteredReps = search1.trim()
    ? repNames.filter(n => n.toLowerCase().includes(search1.toLowerCase()))
    : repNames;
  const filteredAccounts = repAccounts.filter(a => a.toLowerCase().includes(search2.toLowerCase()));

  const toggleAccount = (acc) => {
    setSelectedAccounts(prev =>
      prev.includes(acc) ? prev.filter(a => a !== acc) : [...prev, acc]
    );
  };

  const addManualAccount = () => {
    const trimmed = manualAccount.trim();
    if (!trimmed) return;
    setSelectedAccounts(prev => prev.includes(trimmed) ? prev : [...prev, trimmed]);
    setManualAccount("");
  };

  const handleSave = async () => {
    setSaving(true);
    setSaveError("");
    try {
      await base44.auth.updateMe({
        full_name: selectedRepName,
        managedAccounts: selectedAccounts,
        onboardingComplete: true,
      });
      queryClient.invalidateQueries({ queryKey: ["currentUser"] });
      setStep(4);
    } catch (e) {
      setSaveError(e.message || "Failed to save profile. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const [showTour, setShowTour] = useState(false);

  const steps = [
    { num: 1, label: "Match Your Name" },
    { num: 2, label: "Select Accounts" },
    { num: 3, label: "Confirm" },
    { num: 4, label: "App Tour" },
  ];

  if (showTour) {
    return <AppTour onFinish={onComplete} />;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col overflow-hidden" style={{ maxHeight: "90vh" }}>
        {/* Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-500 px-6 py-5">
          <h2 className="text-xl font-bold text-white">Set Up Your Rep Profile</h2>
          <p className="text-blue-100 text-sm mt-0.5">Let's get you configured in just a few steps</p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center px-6 py-4 border-b border-gray-100 gap-0">
          {steps.map((s, i) => (
            <div key={s.num} className="flex items-center flex-1">
              <div className="flex flex-col items-center">
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold",
                  step > s.num ? "bg-green-500 text-white" :
                  step === s.num ? "bg-blue-600 text-white" :
                  "bg-gray-200 text-gray-500"
                )}>
                  {step > s.num ? <Check className="w-4 h-4" /> : s.num}
                </div>
                <span className={cn("text-xs mt-1 font-medium whitespace-nowrap",
                  step === s.num ? "text-blue-600" : step > s.num ? "text-green-600" : "text-gray-400"
                )}>{s.label}</span>
              </div>
              {i < steps.length - 1 && (
                <div className={cn("flex-1 h-0.5 mx-2 mb-4", step > s.num ? "bg-green-400" : "bg-gray-200")} />
              )}
            </div>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 flex flex-col">

          {/* STEP 1 */}
          {step === 1 && (
            <div className="space-y-4">
              <p className="text-gray-600 text-sm">Type your name below or select it from the list.</p>
              <Input
                placeholder="Your name..."
                value={selectedRepName}
                onChange={e => {
                  setSelectedRepName(e.target.value);
                  setSearch1(e.target.value);
                }}
                autoFocus
              />
              {filteredReps.length > 0 && (
                <div className="border rounded-xl overflow-y-auto" style={{ maxHeight: "250px" }}>
                  {filteredReps.map(name => (
                    <button
                      key={name}
                      onClick={() => { setSelectedRepName(name); setSearch1(""); }}
                      className={cn(
                        "w-full text-left px-4 py-3 flex items-center justify-between transition-colors border-b last:border-b-0",
                        selectedRepName === name
                          ? "bg-blue-50 text-blue-700 font-medium"
                          : "hover:bg-gray-50 text-gray-700"
                      )}
                    >
                      <span>{name}</span>
                      {selectedRepName === name && <Check className="w-4 h-4 text-blue-600" />}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* STEP 2 */}
          {step === 2 && (
            <div className="space-y-4">
              <p className="text-gray-600 text-sm">
                Select accounts from the list, or type one manually and press Enter.
              </p>

              {/* Manual add input */}
              <div className="flex gap-2">
                <Input
                  placeholder="Type an account name and press Enter..."
                  value={manualAccount}
                  onChange={e => setManualAccount(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addManualAccount()}
                />
                <Button
                  variant="outline"
                  size="icon"
                  onClick={addManualAccount}
                  disabled={!manualAccount.trim()}
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>

              {/* Search + count row */}
              <div className="flex gap-2 items-center">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    className="pl-9"
                    placeholder="Search accounts..."
                    value={search2}
                    onChange={e => setSearch2(e.target.value)}
                  />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-500 font-medium">{selectedAccounts.length} selected</span>
                <div className="flex gap-2">
                  <button onClick={() => setSelectedAccounts([...new Set([...selectedAccounts, ...repAccounts])])} className="text-xs text-blue-600 hover:underline">Select All</button>
                  <span className="text-gray-300">|</span>
                  <button onClick={() => setSelectedAccounts([])} className="text-xs text-gray-500 hover:underline">Clear All</button>
                </div>
              </div>

              <div className="border rounded-xl overflow-y-auto" style={{ maxHeight: "220px" }}>
                {filteredAccounts.length === 0 && (
                  <p className="text-center text-gray-400 py-8 text-sm">No accounts found</p>
                )}
                {filteredAccounts.map(acc => (
                  <button
                    key={acc}
                    onClick={() => toggleAccount(acc)}
                    className={cn(
                      "w-full text-left px-4 py-3 flex items-center justify-between transition-colors border-b last:border-b-0",
                      selectedAccounts.includes(acc)
                        ? "bg-blue-50 text-blue-700 font-medium"
                        : "hover:bg-gray-50 text-gray-700"
                    )}
                  >
                    <span>{acc}</span>
                    {selectedAccounts.includes(acc) && <Check className="w-4 h-4 text-blue-600" />}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* STEP 3 */}
          {step === 3 && (
            <div className="space-y-4">
              <p className="text-gray-600 text-sm">Review your profile before saving.</p>
              <div className="bg-gray-50 rounded-xl p-4 space-y-3">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold mb-1">Rep Name</p>
                  <span className="inline-block bg-blue-100 text-blue-700 font-semibold px-3 py-1 rounded-full text-sm">{selectedRepName}</span>
                </div>
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold mb-2">Accounts ({selectedAccounts.length})</p>
                  <div className="flex flex-wrap gap-2">
                    {selectedAccounts.map(acc => (
                      <span key={acc} className="bg-white border border-gray-200 text-gray-700 px-2 py-0.5 rounded-full text-xs">{acc}</span>
                    ))}
                    {selectedAccounts.length === 0 && <span className="text-gray-400 text-sm">No accounts selected</span>}
                  </div>
                </div>
              </div>
              {saveError && (
                <p className="text-red-600 text-sm bg-red-50 rounded-lg px-4 py-2">{saveError}</p>
              )}
            </div>
          )}

          {/* STEP 4 — App Tour */}
          {step === 4 && (
            <div className="flex flex-col items-center text-center gap-6 py-4">
              <div className="w-16 h-16 rounded-full bg-blue-50 flex items-center justify-center">
                <PlayCircle className="w-9 h-9 text-blue-600" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">Take the App Tour</h3>
                <p className="text-gray-600 text-sm leading-relaxed max-w-xs">
                  Get a guided walkthrough of <strong>My Loaners</strong>, <strong>Missing Parts</strong>, <strong>Marketplace</strong>, <strong>Track Log</strong>, and <strong>My Account</strong>.
                </p>
              </div>
              <div className="flex flex-col gap-3 w-full max-w-xs">
                <Button
                  onClick={() => setShowTour(true)}
                  className="bg-blue-600 hover:bg-blue-700 text-white gap-2 w-full"
                >
                  <PlayCircle className="w-4 h-4" />
                  Start Interactive Tour
                </Button>
                <Button
                  variant="ghost"
                  onClick={onComplete}
                  className="text-gray-500 gap-2 w-full"
                >
                  <SkipForward className="w-4 h-4" />
                  Skip for Now
                </Button>
              </div>
              <p className="text-xs text-gray-400">You can revisit this tour anytime from <strong>My Account</strong>.</p>
            </div>
          )}
        </div>

        {/* Footer — hidden on step 4 */}
        {step < 4 && <div className="px-6 py-4 border-t border-gray-100 flex justify-between gap-3">
          {step > 1 && step < 4 ? (
            <Button variant="outline" onClick={() => setStep(s => s - 1)}>Back</Button>
          ) : <div />}

          {step < 3 && (
            <Button
              onClick={() => setStep(s => s + 1)}
              disabled={step === 1 ? !selectedRepName : selectedAccounts.length === 0}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              Continue
            </Button>
          )}

          {step === 3 && (
            <Button
              onClick={handleSave}
              disabled={saving}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              {saving ? "Saving..." : "Save & Continue →"}
            </Button>
          )}
        </div>}
      </div>
    </div>
  );
}