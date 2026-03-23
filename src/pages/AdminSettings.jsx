import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Trash2, X, Plus, UserPlus, ChevronDown, ChevronUp } from "lucide-react";

// ── SUFFIX → REP AUTO-MATCH ──────────────────────────────────
const SUFFIX_MAP = {
  "GB":  ["Graham Brown"],
  "JR":  ["Joshua Raptis"],
  "SM":  ["Sara Marion"],
  "RB":  ["Reid Butcher"],
  "RB1": ["Reid Butcher", "Grant Ellis", "Zachary Kuta", "Preston Swigart", "Madison Raak"],
  "JD":  ["John DeLeon"],
  "EM1": ["Hunter Mills"],
};

function getSuffix(name = "") {
  const m = name.match(/[-–]\s*([A-Z0-9]+)\s*$/);
  return m ? m[1].toUpperCase() : null;
}

function autoMatchReps(accountName, userNames) {
  const suffix = getSuffix(accountName);
  if (!suffix || !SUFFIX_MAP[suffix]) return [];
  return SUFFIX_MAP[suffix].filter(n => userNames.includes(n));
}

// ── MAIN COMPONENT ───────────────────────────────────────────
export default function AdminSettings() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("assignments");

  // ── Tab 1 state
  const [search, setSearch] = useState("");
  const [pendingSaves, setPendingSaves] = useState({});

  // ── Tab 2 state
  const [repSearch, setRepSearch] = useState("");
  const [newRepName, setNewRepName] = useState("");
  const [expandedRep, setExpandedRep] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null); // { user, accounts }

  const invalidate = () => qc.invalidateQueries({ queryKey: ["repAccountAssignments"] });

  // ── DATA ─────────────────────────────────────────────────────
  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["repAccountAssignments"],
    queryFn: () => base44.entities.RepAccountAssignment.list(),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["allUsers"],
    queryFn: () => base44.entities.User.list(),
  });

  const userNames = useMemo(
    () => allUsers.map(u => u.full_name).filter(Boolean).sort(),
    [allUsers]
  );

  // ── MUTATIONS ─────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.RepAccountAssignment.update(id, data),
    onSuccess: invalidate,
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.RepAccountAssignment.create(data),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.RepAccountAssignment.delete(id),
    onSuccess: invalidate,
  });

  // ── TAB 1 HELPERS ─────────────────────────────────────────────
  function getAssignedReps(row) {
    return row.assignedReps || (row.assignedRep ? [row.assignedRep] : []);
  }

  function saveRow(row, updatedFields) {
    setPendingSaves(p => ({ ...p, [row.id]: true }));
    updateMutation.mutate(
      { id: row.id, data: { ...row, ...updatedFields } },
      { onSettled: () => setPendingSaves(p => ({ ...p, [row.id]: false })) }
    );
  }

  function addRepToRow(row, repName) {
    const current = getAssignedReps(row);
    if (current.includes(repName)) return;
    saveRow(row, { assignedReps: [...current, repName] });
  }

  function removeRepFromRow(row, repName) {
    const updated = getAssignedReps(row).filter(r => r !== repName);
    saveRow(row, { assignedReps: updated });
  }

  function setBackupRep(row, repName) {
    saveRow(row, { backupRep: repName });
  }

  // ── TAB 2 HELPERS ─────────────────────────────────────────────
  function getRepAccounts(repName) {
    return assignments.filter(a =>
      getAssignedReps(a).includes(repName) || a.backupRep === repName
    );
  }

  function handleAddRepToSystem() {
    if (!newRepName.trim()) return;
    createMutation.mutate({
      accountName: `[New Rep] ${newRepName.trim()}`,
      assignedReps: [newRepName.trim()],
      backupRep: "",
    });
    setNewRepName("");
  }

  async function handleRemoveRep(repName) {
    const affected = getRepAccounts(repName);
    for (const row of affected) {
      const updatedAssigned = getAssignedReps(row).filter(r => r !== repName);
      const updatedBackup = row.backupRep === repName ? "" : row.backupRep;
      await base44.entities.RepAccountAssignment.update(row.id, {
        ...row,
        assignedReps: updatedAssigned,
        backupRep: updatedBackup,
      });
    }
    invalidate();
    setConfirmRemove(null);
  }

  // ── DERIVED DATA ──────────────────────────────────────────────
  const filteredAssignments = useMemo(() =>
    assignments.filter(a =>
      a.accountName?.toLowerCase().includes(search.toLowerCase())
    ),
    [assignments, search]
  );

  const allRepNames = useMemo(() => {
    const fromAssignments = assignments.flatMap(a => [
      ...getAssignedReps(a),
      a.backupRep,
    ]).filter(Boolean);
    return [...new Set([...userNames, ...fromAssignments])].sort();
  }, [userNames, assignments]);

  const filteredReps = useMemo(() =>
    allRepNames
      .filter(name => name.toLowerCase().includes(repSearch.toLowerCase()))
      .sort((a, b) => getRepAccounts(b).length - getRepAccounts(a).length),
    [allRepNames, repSearch, assignments]
  );

  // ── RENDER ────────────────────────────────────────────────────
  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto pb-16">
      <h1 className="text-2xl font-bold mb-1">Admin Settings</h1>
      <p className="text-gray-500 mb-6 text-sm">Manage rep–account assignments. Changes save automatically.</p>

      {/* TABS */}
      <div className="flex gap-0 mb-6 border-b border-gray-200">
        {[
          { key: "assignments", label: "Rep–Account Assignments" },
          { key: "reps", label: "Rep Management" },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors min-h-[44px] ${
              activeTab === tab.key
                ? "border-black text-black"
                : "border-transparent text-gray-400 hover:text-gray-600"
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ══════════════════════════════════════════════════════
          TAB 1 — REP–ACCOUNT ASSIGNMENTS
      ══════════════════════════════════════════════════════ */}
      {activeTab === "assignments" && (
        <div>
          <Input
            placeholder="🔍 Search accounts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="mb-4 text-base"
          />

          {isLoading ? (
            <div className="text-center py-12 text-gray-400">Loading assignments...</div>
          ) : (
            <div className="bg-white rounded-xl shadow overflow-hidden border border-gray-100">
              {/* Header */}
              <div className="grid grid-cols-12 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b">
                <div className="col-span-4">Hospital Account</div>
                <div className="col-span-5">Assigned Reps</div>
                <div className="col-span-3">Backup Rep</div>
              </div>

              {filteredAssignments.length === 0 && (
                <div className="px-4 py-8 text-center text-gray-400 text-sm">No accounts found.</div>
              )}

              {filteredAssignments.map(row => {
                const assignedReps = getAssignedReps(row);
                const autoMatched = autoMatchReps(row.accountName, userNames);
                const hasAutoSuggestion = autoMatched.some(r => !assignedReps.includes(r));
                const unassigned = allRepNames.filter(r => !assignedReps.includes(r));
                const isSaving = pendingSaves[row.id];

                return (
                  <div key={row.id} className="grid grid-cols-12 px-4 py-4 border-b last:border-0 hover:bg-gray-50 items-start gap-2">

                    {/* Account Name */}
                    <div className="col-span-4">
                      <p className="font-medium text-sm text-gray-800 leading-tight">{row.accountName}</p>
                      {hasAutoSuggestion && (
                        <button
                          onClick={() => autoMatched.forEach(r => addRepToRow(row, r))}
                          className="text-xs text-blue-500 hover:text-blue-700 mt-1"
                        >
                          ✨ Auto-assign {autoMatched.join(", ")}
                        </button>
                      )}
                      {isSaving && <span className="text-xs text-gray-400 mt-1 block">Saving...</span>}
                    </div>

                    {/* Assigned Reps */}
                    <div className="col-span-5">
                      <div className="flex flex-wrap gap-1 mb-2">
                        {assignedReps.length === 0 ? (
                          <span className="text-xs text-orange-400 font-medium">⚠ No rep assigned</span>
                        ) : (
                          assignedReps.map(repName => (
                            <span
                              key={repName}
                              className="inline-flex items-center bg-blue-50 text-blue-700 border border-blue-200 text-xs px-2 py-1 rounded-full"
                            >
                              {repName}
                              <button
                                onClick={() => removeRepFromRow(row, repName)}
                                className="ml-1 text-blue-400 hover:text-red-500 font-bold leading-none"
                              >
                                <X size={10} />
                              </button>
                            </span>
                          ))
                        )}
                      </div>
                      <select
                        onChange={e => {
                          if (e.target.value) addRepToRow(row, e.target.value);
                          e.target.value = "";
                        }}
                        defaultValue=""
                        className="text-xs border border-gray-200 rounded-md px-2 py-1.5 text-gray-600 w-full bg-white min-h-[36px]"
                      >
                        <option value="" disabled>+ Add rep...</option>
                        {unassigned.map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>

                    {/* Backup Rep */}
                    <div className="col-span-3">
                      <select
                        value={row.backupRep || ""}
                        onChange={e => setBackupRep(row, e.target.value)}
                        className="text-xs border border-gray-200 rounded-md px-2 py-1.5 text-gray-600 w-full bg-white min-h-[36px]"
                      >
                        <option value="">None</option>
                        {allRepNames.map(name => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          TAB 2 — REP MANAGEMENT
      ══════════════════════════════════════════════════════ */}
      {activeTab === "reps" && (
        <div>
          {/* Add New Rep */}
          <div className="bg-white rounded-xl shadow border border-gray-100 p-4 mb-6 flex gap-3 items-center">
            <Input
              placeholder="Full name (e.g. Graham Brown)"
              value={newRepName}
              onChange={e => setNewRepName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && handleAddRepToSystem()}
              className="flex-1 text-base"
            />
            <Button
              onClick={handleAddRepToSystem}
              disabled={!newRepName.trim()}
              className="min-h-[44px] px-4 whitespace-nowrap"
            >
              <UserPlus size={15} className="mr-1" /> Add Rep
            </Button>
          </div>

          {/* Search */}
          <Input
            placeholder="🔍 Search reps..."
            value={repSearch}
            onChange={e => setRepSearch(e.target.value)}
            className="mb-4 text-base"
          />

          {/* Rep List */}
          <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
            <div className="grid grid-cols-12 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b">
              <div className="col-span-5">Rep Name</div>
              <div className="col-span-5">Accounts</div>
              <div className="col-span-2 text-right">Remove</div>
            </div>

            {filteredReps.length === 0 && (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">No reps found.</div>
            )}

            {filteredReps.map(repName => {
              const repAccounts = getRepAccounts(repName);
              const isExpanded = expandedRep === repName;

              return (
                <div key={repName} className="border-b last:border-0">
                  <div className="grid grid-cols-12 px-4 py-4 items-center hover:bg-gray-50 min-h-[56px]">

                    {/* Name */}
                    <div className="col-span-5">
                      <p className="font-medium text-sm text-gray-800">{repName}</p>
                    </div>

                    {/* Account count + expand */}
                    <div className="col-span-5">
                      <button
                        onClick={() => setExpandedRep(isExpanded ? null : repName)}
                        className="flex items-center gap-1 text-xs text-blue-600 hover:underline min-h-[44px]"
                      >
                        <span className="font-bold text-gray-700">{repAccounts.length}</span>
                        &nbsp;account{repAccounts.length !== 1 ? "s" : ""}
                        {isExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                      </button>
                    </div>

                    {/* Remove */}
                    <div className="col-span-2 text-right">
                      <button
                        onClick={() => setConfirmRemove({ repName, accounts: repAccounts })}
                        className="text-xs text-red-500 hover:text-red-700 border border-red-200 rounded px-2 py-1.5 hover:bg-red-50 min-h-[36px]"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  </div>

                  {/* Expanded account list */}
                  {isExpanded && (
                    <div className="px-6 pb-4 bg-gray-50 border-t border-gray-100">
                      {repAccounts.length === 0 ? (
                        <p className="text-xs text-gray-400 italic pt-2">Not assigned to any accounts.</p>
                      ) : (
                        <ul className="space-y-1 pt-2">
                          {repAccounts.map(row => (
                            <li key={row.id} className="text-xs text-gray-600 flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 inline-block flex-shrink-0" />
                              {row.accountName}
                              {row.backupRep === repName && (
                                <span className="text-gray-400 italic">(backup)</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── CONFIRM REMOVE DIALOG ─────────────────────────────── */}
      {confirmRemove && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h2 className="font-bold text-lg mb-2">Remove {confirmRemove.repName}?</h2>
            <p className="text-sm text-gray-600 mb-3">
              This will remove them from{" "}
              <span className="font-semibold">{confirmRemove.accounts.length} account{confirmRemove.accounts.length !== 1 ? "s" : ""}</span>:
            </p>
            {confirmRemove.accounts.length > 0 && (
              <ul className="text-xs text-gray-500 mb-4 max-h-40 overflow-y-auto space-y-1 border rounded p-2 bg-gray-50">
                {confirmRemove.accounts.map(a => (
                  <li key={a.id} className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-red-400 inline-block flex-shrink-0" />
                    {a.accountName}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex gap-3 justify-end">
              <Button
                variant="outline"
                onClick={() => setConfirmRemove(null)}
                className="min-h-[44px]"
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => handleRemoveRep(confirmRemove.repName)}
                className="min-h-[44px]"
              >
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}