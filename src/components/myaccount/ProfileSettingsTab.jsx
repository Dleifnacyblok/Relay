import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Check, X, Plus, Pencil } from "lucide-react";
import { useRef } from "react";
import { toast } from "sonner";

export default function ProfileSettingsTab({ user, managedAccounts, assignedAccountNames, allAssignments, loaners = [], onAccountClick }) {
  const queryClient = useQueryClient();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const [savingName, setSavingName] = useState(false);
  const [showAddAccount, setShowAddAccount] = useState(false);
  const [addAccountSearch, setAddAccountSearch] = useState("");
  const addAccountRef = useRef(null);

  const accountSearchResults = addAccountSearch.trim()
    ? [...new Set(allAssignments.map(a => a.accountName).filter(Boolean))]
        .filter(name =>
          name.toLowerCase().includes(addAccountSearch.toLowerCase()) &&
          !managedAccounts.includes(name)
        )
        .sort()
        .slice(0, 10)
    : [];

  const handleSaveName = async () => {
    const trimmed = nameInput.trim();
    if (!trimmed || trimmed === user?.full_name) { setEditingName(false); return; }
    setSavingName(true);
    await base44.auth.updateMe({ full_name: trimmed });
    queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    setSavingName(false);
    setEditingName(false);
    toast.success("Name updated");
  };

  const handleAddAccount = async (accountName) => {
    const updated = [...managedAccounts, accountName];
    await base44.auth.updateMe({ managedAccounts: updated });
    queryClient.invalidateQueries({ queryKey: ["currentUser"] });
    setAddAccountSearch("");
    setShowAddAccount(false);
  };

  const handleRemoveAccount = async (accountName) => {
    const updated = managedAccounts.filter(a => a !== accountName);
    await base44.auth.updateMe({ managedAccounts: updated });
    queryClient.invalidateQueries({ queryKey: ["currentUser"] });
  };

  return (
    <div className="space-y-4">
      {/* Name */}
      <Card className="p-5 bg-white border-slate-200">
        <p className="text-xs text-slate-400 uppercase font-semibold mb-2">Display Name</p>
        {editingName ? (
          <div className="flex items-center gap-2">
            <Input
              autoFocus
              value={nameInput}
              onChange={e => setNameInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter") handleSaveName(); if (e.key === "Escape") setEditingName(false); }}
              className="h-9 text-sm"
            />
            <Button size="sm" onClick={handleSaveName} disabled={savingName} className="gap-1 px-3">
              <Check className="w-3.5 h-3.5" />
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditingName(false)}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <p className="text-base font-medium text-slate-800">{user?.full_name}</p>
            <button
              onClick={() => { setNameInput(user?.full_name || ""); setEditingName(true); }}
              className="text-slate-300 hover:text-blue-500 transition-colors"
            >
              <Pencil size={13} />
            </button>
          </div>
        )}
        <p className="text-xs text-slate-400 mt-1">{user?.email}</p>
      </Card>

      {/* Managed Accounts */}
      <Card className="p-5 bg-white border-slate-200">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs text-slate-400 uppercase font-semibold">My Accounts</p>
          <div className="relative" ref={addAccountRef}>
            <button
              onClick={() => { setShowAddAccount(v => !v); setAddAccountSearch(""); }}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 border border-blue-200 hover:border-blue-400 rounded-full px-3 py-1.5 transition-colors"
            >
              <Plus className="w-3 h-3" /> Add
            </button>
            {showAddAccount && (
              <div className="absolute right-0 top-8 z-50 w-72 bg-white border border-slate-200 rounded-xl shadow-lg p-2">
                <Input
                  autoFocus
                  placeholder="Search accounts..."
                  value={addAccountSearch}
                  onChange={e => setAddAccountSearch(e.target.value)}
                  className="mb-2"
                />
                {accountSearchResults.length === 0 && addAccountSearch.trim() && (
                  <p className="text-xs text-slate-400 text-center py-3">No matches found</p>
                )}
                {accountSearchResults.length === 0 && !addAccountSearch.trim() && (
                  <p className="text-xs text-slate-400 text-center py-3">Start typing to search</p>
                )}
                {accountSearchResults.map(name => (
                  <button
                    key={name}
                    onClick={() => handleAddAccount(name)}
                    className="w-full text-left text-sm px-3 py-2.5 rounded-lg hover:bg-blue-50 text-slate-700 hover:text-blue-700 transition-colors"
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {(managedAccounts.length === 0 && assignedAccountNames.length === 0) ? (
          <p className="text-xs text-slate-400">No accounts added yet.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {assignedAccountNames.map(acc => (
              <span key={acc} className="inline-flex items-center gap-1 bg-green-50 text-green-700 border border-green-200 text-xs font-medium px-3 py-1 rounded-full">
                {acc}
              </span>
            ))}
            {managedAccounts.map(acc => (
              <span key={acc} className="inline-flex items-center gap-1 bg-blue-50 text-blue-700 border border-blue-200 text-xs font-medium px-3 py-1 rounded-full">
                {acc}
                <button onClick={() => handleRemoveAccount(acc)} className="ml-1 text-blue-400 hover:text-red-500 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}