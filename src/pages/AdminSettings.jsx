import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Pencil, Trash2, Check, X } from "lucide-react";

const EMPTY = { accountName: "", assignedRep: "", backupRep: "" };

export default function AdminSettings() {
  const qc = useQueryClient();
  const [editingId, setEditingId] = useState(null);
  const [editRow, setEditRow] = useState(EMPTY);
  const [newRow, setNewRow] = useState(EMPTY);
  const [showNewRow, setShowNewRow] = useState(false);

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["repAccountAssignments"],
    queryFn: () => base44.entities.RepAccountAssignment.list("accountName"),
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
    setEditRow({ accountName: row.accountName, assignedRep: row.assignedRep || "", backupRep: row.backupRep || "" });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Admin Settings</h1>
        <p className="text-sm text-gray-500 mt-1">Manage rep–account assignments used across the app.</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-800">Rep–Account Assignments</h2>
          <Button size="sm" onClick={() => { setShowNewRow(true); setNewRow(EMPTY); }} className="gap-1.5">
            <Plus className="w-4 h-4" /> Add Row
          </Button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left px-5 py-3 font-semibold text-gray-600 w-1/3">Hospital Account</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600 w-1/3">Assigned Rep</th>
                <th className="text-left px-5 py-3 font-semibold text-gray-600 w-1/3">Backup Rep</th>
                <th className="px-3 py-3 w-24"></th>
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr><td colSpan={4} className="text-center py-8 text-gray-400">Loading...</td></tr>
              )}

              {/* New row form */}
              {showNewRow && (
                <tr className="bg-blue-50 border-b border-blue-100">
                  <td className="px-3 py-2">
                    <Input value={newRow.accountName} onChange={e => setNewRow(p => ({...p, accountName: e.target.value}))} placeholder="Account name" className="h-8 text-sm" autoFocus />
                  </td>
                  <td className="px-3 py-2">
                    <Input value={newRow.assignedRep} onChange={e => setNewRow(p => ({...p, assignedRep: e.target.value}))} placeholder="Assigned rep" className="h-8 text-sm" />
                  </td>
                  <td className="px-3 py-2">
                    <Input value={newRow.backupRep} onChange={e => setNewRow(p => ({...p, backupRep: e.target.value}))} placeholder="Backup rep" className="h-8 text-sm" />
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
                <tr key={row.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  {editingId === row.id ? (
                    <>
                      <td className="px-3 py-2"><Input value={editRow.accountName} onChange={e => setEditRow(p => ({...p, accountName: e.target.value}))} className="h-8 text-sm" autoFocus /></td>
                      <td className="px-3 py-2"><Input value={editRow.assignedRep} onChange={e => setEditRow(p => ({...p, assignedRep: e.target.value}))} className="h-8 text-sm" /></td>
                      <td className="px-3 py-2"><Input value={editRow.backupRep} onChange={e => setEditRow(p => ({...p, backupRep: e.target.value}))} className="h-8 text-sm" /></td>
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
                      <td className="px-5 py-3 text-gray-700">{row.assignedRep || <span className="text-gray-300">—</span>}</td>
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
                <tr><td colSpan={4} className="text-center py-10 text-gray-400 text-sm">No assignments yet. Click "Add Row" to get started.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}