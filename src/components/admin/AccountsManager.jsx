import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Plus, X, Trash2, Pencil, Check, Building2 } from "lucide-react";
import { getAssignedReps, getHiddenReps, HIDDEN_REP_PREFIX, REP_PLACEHOLDER_PREFIX } from "@/lib/accounts";

export default function AccountsManager() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [editing, setEditing] = useState(null); // { id, name }
  const [confirmRemove, setConfirmRemove] = useState(null);
  const [error, setError] = useState("");

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["repAccountAssignments"],
    queryFn: () => base44.entities.RepAccountAssignment.list(),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["allUsers"],
    queryFn: () => base44.entities.User.list(),
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["repAccountAssignments"] });
    qc.invalidateQueries({ queryKey: ["loaners"] });
    qc.invalidateQueries({ queryKey: ["allLoaners"] });
  };

  const accounts = useMemo(
    () =>
      assignments.filter(
        (a) =>
          !a.accountName?.startsWith(REP_PLACEHOLDER_PREFIX) &&
          !a.accountName?.startsWith(HIDDEN_REP_PREFIX)
      ),
    [assignments]
  );

  const repNames = useMemo(() => {
    const hidden = getHiddenReps(assignments);
    return [
      ...new Set([
        ...users.map((u) => u.full_name).filter(Boolean),
        ...assignments.flatMap((a) => getAssignedReps(a)),
      ]),
    ]
      .filter((n) => !hidden.includes(n))
      .sort();
  }, [users, assignments]);

  const filtered = useMemo(
    () =>
      accounts
        .filter((a) => (a.accountName || "").toLowerCase().includes(search.toLowerCase()))
        .sort((a, b) => (a.accountName || "").localeCompare(b.accountName || "")),
    [accounts, search]
  );

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    if (accounts.some((a) => (a.accountName || "").toLowerCase() === name.toLowerCase())) {
      setError("That account is already on the list.");
      return;
    }
    setError("");
    await base44.entities.RepAccountAssignment.create({ accountName: name, assignedReps: [] });
    invalidate();
    setNewName("");
    setAdding(false);
  };

  const saveAccount = async (id, data) => {
    await base44.entities.RepAccountAssignment.update(id, data);
    invalidate();
  };

  const handleRename = async () => {
    const name = editing.name.trim();
    if (!name) return;
    if (
      accounts.some(
        (a) => a.id !== editing.id && (a.accountName || "").toLowerCase() === name.toLowerCase()
      )
    ) {
      setError("That account is already on the list.");
      return;
    }
    setError("");
    await saveAccount(editing.id, { accountName: name });
    setEditing(null);
  };

  const handleRemove = async () => {
    await base44.entities.RepAccountAssignment.delete(confirmRemove.id);
    invalidate();
    setConfirmRemove(null);
  };

  return (
    <div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Input
          placeholder="🔍 Search accounts..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-base flex-1"
        />
        <Button onClick={() => setAdding(true)} className="min-h-[44px] shrink-0">
          <Plus size={15} className="mr-1" /> Add account
        </Button>
      </div>

      {adding && (
        <div className="flex gap-2 items-center bg-white border border-blue-200 rounded-xl p-3 shadow-sm mb-4">
          <Input
            autoFocus
            placeholder="Account name (e.g. Mercy Hospital - GB)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleAdd();
              if (e.key === "Escape") {
                setAdding(false);
                setNewName("");
                setError("");
              }
            }}
            className="flex-1 text-base"
          />
          <Button onClick={handleAdd} disabled={!newName.trim()} className="min-h-[44px]">
            <Check size={15} className="mr-1" /> Add
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              setAdding(false);
              setNewName("");
              setError("");
            }}
            className="min-h-[44px]"
          >
            Cancel
          </Button>
        </div>
      )}

      {error && <p className="text-sm text-red-600 mb-3">{error}</p>}

      {isLoading ? (
        <div className="text-center py-12 text-gray-400">Loading...</div>
      ) : filtered.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-10 text-center">
          <div className="w-11 h-11 rounded-lg bg-blue-50 flex items-center justify-center mx-auto mb-3">
            <Building2 className="w-5 h-5 text-blue-600" />
          </div>
          <p className="text-sm text-gray-500">
            {search ? "No accounts match your search." : "No accounts yet. Add your first account to get started."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((row) => {
            const assignedReps = getAssignedReps(row);
            const unassigned = repNames.filter((r) => !assignedReps.includes(r));
            const isEditing = editing?.id === row.id;

            return (
              <div key={row.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex-1 min-w-0">
                    {isEditing ? (
                      <div className="flex items-center gap-1">
                        <Input
                          autoFocus
                          value={editing.name}
                          onChange={(e) => setEditing((p) => ({ ...p, name: e.target.value }))}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleRename();
                            if (e.key === "Escape") setEditing(null);
                          }}
                          className="text-sm h-9"
                        />
                        <button onClick={handleRename} className="text-green-600 hover:text-green-800 p-1">
                          <Check size={15} />
                        </button>
                        <button onClick={() => setEditing(null)} className="text-gray-400 hover:text-gray-600 p-1">
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <p className="font-semibold text-sm text-gray-800">{row.accountName}</p>
                        <button
                          onClick={() => {
                            setError("");
                            setEditing({ id: row.id, name: row.accountName || "" });
                          }}
                          className="text-gray-300 hover:text-blue-500 transition-colors"
                          title="Edit account name"
                        >
                          <Pencil size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                  <button
                    onClick={() => setConfirmRemove(row)}
                    className="text-xs text-red-500 hover:text-red-700 border border-red-200 rounded px-2 py-1.5 hover:bg-red-50 min-h-[36px] shrink-0"
                    title="Remove account"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <div className="flex flex-wrap gap-1.5 mb-3">
                  {assignedReps.length === 0 ? (
                    <span className="text-xs text-orange-400 font-medium">⚠ No rep assigned</span>
                  ) : (
                    assignedReps.map((repName) => (
                      <span
                        key={repName}
                        className="inline-flex items-center bg-blue-50 text-blue-700 border border-blue-200 text-xs px-2.5 py-1 rounded-full"
                      >
                        {repName}
                        <button
                          onClick={() => saveAccount(row.id, { assignedReps: assignedReps.filter((r) => r !== repName) })}
                          className="ml-1.5 text-blue-300 hover:text-red-500"
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                <select
                  onChange={(e) => {
                    if (e.target.value) saveAccount(row.id, { assignedReps: [...assignedReps, e.target.value] });
                    e.target.value = "";
                  }}
                  defaultValue=""
                  className="text-xs border border-gray-200 rounded-lg px-3 py-2 text-gray-500 bg-white w-full md:w-auto min-h-[36px]"
                >
                  <option value="" disabled>
                    + Add rep...
                  </option>
                  {unassigned.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>
            );
          })}
        </div>
      )}

      {confirmRemove && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h2 className="font-bold text-lg mb-2">Remove {confirmRemove.accountName}?</h2>
            <p className="text-sm text-gray-600 mb-4">
              This removes the account and its rep assignments from the app. Loaner and consignment records are not deleted.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setConfirmRemove(null)} className="min-h-[44px]">
                Cancel
              </Button>
              <Button variant="destructive" onClick={handleRemove} className="min-h-[44px]">
                Remove
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}