import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { X, ChevronDown, ChevronUp, Trash2, UserPlus, Pencil, Check } from "lucide-react";
import { Button } from "@/components/ui/button";

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

function getAssignedReps(row) {
  if (Array.isArray(row.assignedReps)) return row.assignedReps;
  if (row.assignedRep) return [row.assignedRep];
  return [];
}

export default function AdminSettings() {
  const qc = useQueryClient();
  const [activeTab, setActiveTab] = useState("assignments");
  const [search, setSearch] = useState("");
  const [repSearch, setRepSearch] = useState("");
  const [newRepName, setNewRepName] = useState("");
  const [expandedRep, setExpandedRep] = useState(null);
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [savingRows, setSavingRows] = useState({});
  const [editingRep, setEditingRep] = useState(null); // { oldName, newName }
  const [addingRep, setAddingRep] = useState(false);

  const invalidate = () => qc.invalidateQueries({ queryKey: ["repAccountAssignments"] });

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

  const allRepNames = useMemo(() => {
    const fromAssignments = assignments.flatMap(a => getAssignedReps(a)).filter(Boolean);
    return [...new Set([...userNames, ...fromAssignments])].sort();
  }, [userNames, assignments]);

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.RepAccountAssignment.update(id, data),
    onSuccess: invalidate,
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.RepAccountAssignment.delete(id),
    onSuccess: invalidate,
  });

  function saveRow(row, updatedFields) {
    setSavingRows(p => ({ ...p, [row.id]: true }));
    updateMutation.mutate(
      { id: row.id, data: { ...row, ...updatedFields } },
      { onSettled: () => setSavingRows(p => ({ ...p, [row.id]: false })) }
    );
  }

  function addRep(row, repName) {
    const current = getAssignedReps(row);
    if (!repName || current.includes(repName)) return;
    saveRow(row, { assignedReps: [...current, repName] });
  }

  function removeRep(row, repName) {
    saveRow(row, { assignedReps: getAssignedReps(row).filter(r => r !== repName) });
  }

  function getRepAccounts(repName) {
    return assignments.filter(a => getAssignedReps(a).includes(repName));
  }

  async function handleRemoveRep(repName) {
    const affected = getRepAccounts(repName);
    for (const row of affected) {
      await base44.entities.RepAccountAssignment.update(row.id, {
        ...row,
        assignedReps: getAssignedReps(row).filter(r => r !== repName),
      });
    }
    invalidate();
    setConfirmRemove(null);
  }

  async function handleRenameRep(oldName, newName) {
    const trimmed = newName.trim();
    if (!trimmed || trimmed === oldName) { setEditingRep(null); return; }
    const affected = getRepAccounts(oldName);
    for (const row of affected) {
      const updated = getAssignedReps(row).map(r => r === oldName ? trimmed : r);
      await base44.entities.RepAccountAssignment.update(row.id, { ...row, assignedReps: updated });
    }
    // Also update any users whose full_name matches
    const matchingUser = allUsers.find(u => u.full_name === oldName);
    if (matchingUser) {
      await base44.entities.User.update(matchingUser.id, { full_name: trimmed });
      qc.invalidateQueries({ queryKey: ["allUsers"] });
    }
    invalidate();
    setEditingRep(null);
  }

  async function handleAddNewRep(name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    // Create a placeholder assignment so the rep appears in the system
    await base44.entities.RepAccountAssignment.create({
      accountName: `__rep_placeholder__${trimmed}`,
      assignedReps: [trimmed],
    });
    invalidate();
    setNewRepName("");
    setAddingRep(false);
  }

  const filteredAssignments = useMemo(() =>
    assignments.filter(a =>
      !a.accountName?.startsWith("__rep_placeholder__") &&
      a.accountName?.toLowerCase().includes(search.toLowerCase())
    ),
    [assignments, search]
  );

  const filteredReps = useMemo(() =>
    allRepNames
      .filter(n => n.toLowerCase().includes(repSearch.toLowerCase()))
      .sort((a, b) => getRepAccounts(b).length - getRepAccounts(a).length),
    [allRepNames, repSearch, assignments]
  );

  return (
    <div className="p-4 md:p-6 max-w-4xl mx-auto pb-16">
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

      {/* ══ TAB 1 — ASSIGNMENTS ══ */}
      {activeTab === "assignments" && (
        <div>
          <Input
            placeholder="🔍 Search accounts..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="mb-4 text-base"
          />

          {isLoading ? (
            <div className="text-center py-12 text-gray-400">Loading...</div>
          ) : (
            <div className="space-y-3">
              {filteredAssignments.length === 0 && (
                <div className="text-center py-8 text-gray-400 text-sm">No accounts found.</div>
              )}
              {filteredAssignments.map(row => {
                const assignedReps = getAssignedReps(row);
                const autoMatched = autoMatchReps(row.accountName, userNames);
                const hasAutoSuggestion = autoMatched.some(r => !assignedReps.includes(r));
                const unassigned = allRepNames.filter(r => !assignedReps.includes(r));
                const isSaving = savingRows[row.id];

                return (
                  <div key={row.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    {/* Account header */}
                    <div className="flex items-start justify-between mb-3">
                      <div>
                        <p className="font-semibold text-sm text-gray-800">{row.accountName}</p>
                        {hasAutoSuggestion && (
                          <button
                            onClick={() => autoMatched.forEach(r => addRep(row, r))}
                            className="text-xs text-blue-500 hover:text-blue-700 mt-0.5"
                          >
                            ✨ Auto-assign {autoMatched.join(", ")}
                          </button>
                        )}
                      </div>
                      {isSaving && <span className="text-xs text-gray-400">Saving...</span>}
                    </div>

                    {/* Assigned reps chips */}
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {assignedReps.length === 0 ? (
                        <span className="text-xs text-orange-400 font-medium">⚠ No rep assigned</span>
                      ) : (
                        assignedReps.map(repName => (
                          <span
                            key={repName}
                            className="inline-flex items-center bg-blue-50 text-blue-700 border border-blue-200 text-xs px-2.5 py-1 rounded-full"
                          >
                            {repName}
                            <button
                              onClick={() => removeRep(row, repName)}
                              className="ml-1.5 text-blue-300 hover:text-red-500"
                            >
                              <X size={11} />
                            </button>
                          </span>
                        ))
                      )}
                    </div>

                    {/* Add rep dropdown */}
                    <select
                      onChange={e => {
                        if (e.target.value) addRep(row, e.target.value);
                        e.target.value = "";
                      }}
                      defaultValue=""
                      className="text-xs border border-gray-200 rounded-lg px-3 py-2 text-gray-500 bg-white w-full md:w-auto min-h-[36px]"
                    >
                      <option value="" disabled>+ Add rep...</option>
                      {unassigned.map(name => (
                        <option key={name} value={name}>{name}</option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══ TAB 2 — REP MANAGEMENT ══ */}
      {activeTab === "reps" && (
        <div>
          {/* Add Rep */}
          <div className="mb-4">
            {addingRep ? (
              <div className="flex gap-2 items-center bg-white border border-blue-200 rounded-xl p-3 shadow-sm">
                <Input
                  autoFocus
                  placeholder="Full name (e.g. Graham Brown)"
                  value={newRepName}
                  onChange={e => setNewRepName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") handleAddNewRep(newRepName);
                    if (e.key === "Escape") { setAddingRep(false); setNewRepName(""); }
                  }}
                  className="flex-1 text-base"
                />
                <Button onClick={() => handleAddNewRep(newRepName)} disabled={!newRepName.trim()} className="min-h-[44px]">
                  <Check size={15} className="mr-1" /> Add
                </Button>
                <Button variant="outline" onClick={() => { setAddingRep(false); setNewRepName(""); }} className="min-h-[44px]">Cancel</Button>
              </div>
            ) : (
              <Button onClick={() => setAddingRep(true)} className="min-h-[44px]">
                <UserPlus size={15} className="mr-1" /> Add New Rep
              </Button>
            )}
          </div>

          <Input
            placeholder="🔍 Search reps..."
            value={repSearch}
            onChange={e => setRepSearch(e.target.value)}
            className="mb-4 text-base"
          />

          <div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
            <div className="grid grid-cols-12 bg-gray-50 px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide border-b">
              <div className="col-span-4">Rep Name</div>
              <div className="col-span-3">Role</div>
              <div className="col-span-3">Accounts</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            {filteredReps.length === 0 && (
              <div className="px-4 py-8 text-center text-gray-400 text-sm">No reps found.</div>
            )}

            {filteredReps.map(repName => {
              const repAccounts = getRepAccounts(repName).filter(a => !a.accountName?.startsWith("__rep_placeholder__"));
              const isExpanded = expandedRep === repName;
              const appUser = allUsers.find(u => u.full_name === repName);
              const isEditing = editingRep?.oldName === repName;

              return (
                <div key={repName} className="border-b last:border-0">
                  <div className="grid grid-cols-12 px-4 py-3 items-center hover:bg-gray-50 min-h-[56px]">
                    {/* Name — inline edit (only for non-app reps) */}
                    <div className="col-span-4">
                      {isEditing ? (
                        <div className="flex items-center gap-1">
                          <Input
                            autoFocus
                            value={editingRep.newName}
                            onChange={e => setEditingRep(r => ({ ...r, newName: e.target.value }))}
                            onKeyDown={e => {
                              if (e.key === "Enter") handleRenameRep(repName, editingRep.newName);
                              if (e.key === "Escape") setEditingRep(null);
                            }}
                            className="text-sm h-8 px-2"
                          />
                          <button onClick={() => handleRenameRep(repName, editingRep.newName)} className="text-green-600 hover:text-green-800">
                            <Check size={14} />
                          </button>
                          <button onClick={() => setEditingRep(null)} className="text-gray-400 hover:text-gray-600">
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <p className="font-medium text-sm text-gray-800">{repName}</p>
                          {/* Only allow renaming reps who are NOT app users */}
                          {!appUser ? (
                            <button
                              onClick={() => setEditingRep({ oldName: repName, newName: repName })}
                              className="text-gray-300 hover:text-blue-500 transition-colors"
                              title="Rename rep"
                            >
                              <Pencil size={12} />
                            </button>
                          ) : (
                            <span className="text-[10px] text-gray-400 italic" title="User must update their own name in My Account">
                              (user updates own name)
                            </span>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Role */}
                    <div className="col-span-3">
                      {appUser ? (
                        <span className={`inline-block text-xs font-semibold px-2 py-0.5 rounded-full ${
                          appUser.role === "admin" ? "bg-purple-100 text-purple-700" :
                          appUser.role === "manager" ? "bg-blue-100 text-blue-700" :
                          "bg-gray-100 text-gray-600"
                        }`}>
                          {appUser.role || "user"}
                        </span>
                      ) : (
                        <span className="text-xs text-gray-400 italic">Not in app</span>
                      )}
                    </div>

                    {/* Accounts */}
                    <div className="col-span-3">
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

      {/* CONFIRM REMOVE DIALOG */}
      {confirmRemove && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h2 className="font-bold text-lg mb-2">Remove {confirmRemove.repName}?</h2>
            <p className="text-sm text-gray-600 mb-3">
              This will remove them from{" "}
              <span className="font-semibold">{confirmRemove.accounts.length} account{confirmRemove.accounts.length !== 1 ? "s" : ""}</span>.
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
              <Button variant="outline" onClick={() => setConfirmRemove(null)} className="min-h-[44px]">Cancel</Button>
              <Button variant="destructive" onClick={() => handleRemoveRep(confirmRemove.repName)} className="min-h-[44px]">Remove</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}