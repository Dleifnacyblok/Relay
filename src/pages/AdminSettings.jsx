import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Check, X, Wand2 } from "lucide-react";

const EMPTY = { accountName: "", assignedReps: [], backupRep: "" };

export default function AdminSettings() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [editRow, setEditRow] = useState(EMPTY);
  const [newRow, setNewRow] = useState(EMPTY);
  const [showNewRow, setShowNewRow] = useState(false);

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["repAccountAssignments"],
    queryFn: () => base44.entities.RepAccountAssignment.list(),
  });

  const { data: loaners = [] } = useQuery({
    queryKey: ["loaners"],
    queryFn: () => base44.entities.Loaners.list(),
  });

  const { data: allUsers = [] } = useQuery({
    queryKey: ["allUsers"],
    queryFn: () => base44.entities.User.list(),
  });

  const invalidate = () => qc.invalidateQueries({ queryKey: ["repAccountAssignments"] });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.RepAccountAssignment.create(data),
    onSuccess: () => { invalidate(); setNewRow(EMPTY); setShowNewRow(false); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.RepAccountAssignment.update(id, data),
    onSuccess: () => { invalidate(); setEditingId(null); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.RepAccountAssignment.delete(id),
    onSuccess: invalidate,
  });

  const startEdit = (row) => {
    setEditingId(row.id);
    setEditRow({
      accountName: row.accountName,
      assignedReps: row.assignedReps || (row.assignedRep ? [row.assignedRep] : []),
      backupRep: row.backupRep || "",
    });
  };

  const existingAccountNames = new Set(assignments.map(a => a.accountName?.toLowerCase().trim()));

  const unassignedAccounts = useMemo(() => {
    const accounts = [...new Set(loaners.map(l => l.accountName).filter(Boolean))].sort();
    return accounts.filter(a => !existingAccountNames.has(a.toLowerCase().trim()));
  }, [loaners, assignments]);

  const repOptions = useMemo(() => {
    const fromUsers = allUsers.map(u => u.full_name).filter(Boolean);
    const fromLoaners = loaners.flatMap(l => [l.repName, l.associateSalesRep, l.fieldSalesRep]).filter(Boolean);
    return [...new Set([...fromUsers, ...fromLoaners])].sort();
  }, [allUsers, loaners]);

  const handleAutoPopulate = async () => {
    for (const accountName of unassignedAccounts) {
      await base44.entities.RepAccountAssignment.create({ accountName, assignedReps: [], backupRep: "" });
    }
    invalidate();
  };

  // Multi-rep selector component
  const RepSelector = ({ selectedReps, onChange }) => {
    const available = repOptions.filter(r => !selectedReps.includes(r));
    return (
      <div className="space-y-1">
        {selectedReps.map((rep, idx) => (
          <div key={idx} className="flex items-center gap-1">
            <select
              value={rep}
              onChange={e => {
                const updated = [...selectedReps];
                updated[idx] = e.target.value;
                onChange(updated);
              }}
              className="flex-1 border border-slate-200 rounded-lg px-2 py-1 text-sm text-slate-700 bg-white focus:outline-none focus:border-indigo-400 h-7"
            >
              <option value={rep}>{rep}</option>
              {available.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
            <button
              onClick={() => onChange(selectedReps.filter((_, i) => i !== idx))}
              className="text-gray-400 hover:text-red-500 transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {available.length > 0 && (
          <select
            value=""
            onChange={e => { if (e.target.value) onChange([...selectedReps, e.target.value]); }}
            className="w-full border border-dashed border-slate-300 rounded-lg px-2 py-1 text-sm text-slate-400 bg-white focus:outline-none focus:border-indigo-400 h-7"
          >
            <option value="">+ Add rep...</option>
            {available.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        )}
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage rep–account assignments used across the app.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <div>
            <h2 className="font-semibold text-gray-800">Rep–Account Assignments</h2>
            {unassignedAccounts.length > 0 && (
              <p className="text-xs text-amber-600 mt-0.5">{unassignedAccounts.length} account{unassignedAccounts.length !== 1 ? "s" : ""} from your loaner data don't have a rep assigned yet</p>
            )}
          </div>
          <div className="flex gap-2">
            {unassignedAccounts.length > 0 && (
              <Button size="sm" variant="outline" onClick={handleAutoPopulate} className="gap-1.5 text-amber-600 border-amber-300 hover:bg-amber-50">
                <Wand2 className="w-4 h-4" /> Auto-populate {unassignedAccounts.length} accounts
              </Button>
            )}
            <Button size="sm" onClick={() => { setShowNewRow(true); setNewRow(EMPTY); }} className="gap-1.5">
              <Plus className="w-4 h-4" /> Add Row
            </Button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 font-semibold text-gray-600 w-1/3">Hospital Account</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600 w-1/3">Assigned Reps</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600 w-1/3">Backup Rep</th>
                <th className="px-3 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={4} className="text-center py-8 text-gray-400">Loading...</td></tr>
              )}

              {showNewRow && (
                <tr className="bg-blue-50 border-b border-blue-100">
                  <td className="px-3 py-2">
                    <Input value={newRow.accountName} onChange={e => setNewRow(p => ({ ...p, accountName: e.target.value }))} placeholder="Account name" className="h-8 text-sm" autoFocus />
                  </td>
                  <td className="px-3 py-2">
                    <RepSelector selectedReps={newRow.assignedReps} onChange={v => setNewRow(p => ({ ...p, assignedReps: v }))} />
                  </td>
                  <td className="px-3 py-2">
                    <select
                      value={newRow.backupRep}
                      onChange={e => setNewRow(p => ({ ...p, backupRep: e.target.value }))}
                      className="w-full border border-slate-200 rounded-lg px-2 py-1 text-sm text-slate-700 bg-white focus:outline-none focus:border-indigo-400 h-7"
                    >
                      <option value="">— Backup Rep (optional) —</option>
                      {repOptions.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex gap-1 justify-end">
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => newRow.accountName && createMutation.mutate(newRow)}>
                        <Check className="w-4 h-4" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400" onClick={() => setShowNewRow(false)}>
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              )}

              {assignments.map((row) => (
                <tr key={row.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${!(row.assignedReps?.length || row.assignedRep) ? "bg-amber-50/40" : ""}`}>
                  {editingId === row.id ? (
                    <>
                      <td className="px-3 py-2"><Input value={editRow.accountName} onChange={e => setEditRow(p => ({ ...p, accountName: e.target.value }))} className="h-8 text-sm" autoFocus /></td>
                      <td className="px-3 py-2"><RepSelector selectedReps={editRow.assignedReps} onChange={v => setEditRow(p => ({ ...p, assignedReps: v }))} /></td>
                      <td className="px-3 py-2">
                        <select
                          value={editRow.backupRep}
                          onChange={e => setEditRow(p => ({ ...p, backupRep: e.target.value }))}
                          className="w-full border border-slate-200 rounded-lg px-2 py-1 text-sm text-slate-700 bg-white focus:outline-none focus:border-indigo-400 h-7"
                        >
                          <option value="">— Backup Rep (optional) —</option>
                          {repOptions.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={() => updateMutation.mutate({ id: row.id, data: editRow })}>
                            <Check className="w-4 h-4" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400" onClick={() => setEditingId(null)}>
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-5 py-3 font-medium text-gray-900">{row.accountName}</td>
                      <td className="px-5 py-3">
                        {(row.assignedReps?.length || row.assignedRep) ? (
                          <div className="flex flex-wrap gap-1">
                            {(row.assignedReps?.length ? row.assignedReps : [row.assignedRep]).map((rep, i) => (
                              <span key={i} className="text-xs bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full">{rep}</span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-amber-600 text-xs font-medium">⚠ No rep assigned</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-gray-700">{row.backupRep || <span className="text-gray-300">—</span>}</td>
                      <td className="px-3 py-3">
                        <div className="flex gap-1 justify-end">
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-blue-600" onClick={() => startEdit(row)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-gray-400 hover:text-red-600" onClick={() => deleteMutation.mutate(row.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </td>
                    </>
                  )}
                </tr>
              ))}

              {!isLoading && assignments.length === 0 && !showNewRow && (
                <tr><td colSpan={4} className="text-center py-10 text-gray-400 text-sm">No assignments yet. Click "Auto-populate" to pull in all accounts from your loaner data, or click "Add Row" to add manually.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}