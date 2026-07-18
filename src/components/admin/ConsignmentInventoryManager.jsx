import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  X,
  Trash2,
  Plus,
  Package,
  MapPin,
  Loader2,
  ChevronDown,
  ChevronUp,
  Pencil,
  Check,
} from "lucide-react";

const MANUFACTURERS = ["Globus", "Nuvasive"];

export default function ConsignmentInventoryManager() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [expandedSet, setExpandedSet] = useState(null);
  const [savingSets, setSavingSets] = useState({});
  const [editingSetName, setEditingSetName] = useState(null);
  const [addingSet, setAddingSet] = useState(false);
  const [newSet, setNewSet] = useState({ setName: "", setId: "", manufacturer: "Globus", notes: "" });
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [addingTagFor, setAddingTagFor] = useState(null);
  const [newTagValue, setNewTagValue] = useState("");
  const [newLocationInput, setNewLocationInput] = useState(null); // { setId, tagIdx }
  const [newLocationText, setNewLocationText] = useState("");

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["consignedSets"] });
    qc.invalidateQueries({ queryKey: ["repAccountAssignments"] });
  };

  const { data: consignedSets = [], isLoading: loadingSets } = useQuery({
    queryKey: ["consignedSets"],
    queryFn: () => base44.entities.ConsignedSet.list(),
  });

  const { data: assignments = [] } = useQuery({
    queryKey: ["repAccountAssignments"],
    queryFn: () => base44.entities.RepAccountAssignment.list(),
  });

  // Build the account list from both RepAccountAssignment and existing homeAccounts
  const accountOptions = useMemo(() => {
    const fromAssignments = assignments
      .filter((a) => !a.accountName?.startsWith("__rep_placeholder__"))
      .map((a) => a.accountName)
      .filter(Boolean);
    const fromSets = consignedSets.flatMap((cs) => cs.homeAccounts || []).filter(Boolean);
    return [...new Set([...fromAssignments, ...fromSets])].sort();
  }, [assignments, consignedSets]);

  const setSaving = (id, val) => setSavingSets((p) => ({ ...p, [id]: val }));

  // ── Set-level mutations ──
  const updateSet = async (cs, updatedFields) => {
    setSaving(cs.id, true);
    try {
      await base44.entities.ConsignedSet.update(cs.id, { ...cs, ...updatedFields });
      invalidate();
    } catch (e) {
      console.error("Failed to update set:", e);
    } finally {
      setSaving(cs.id, false);
    }
  };

  const createSet = async (data) => {
    try {
      await base44.entities.ConsignedSet.create({
        ...data,
        tagNumbers: [],
        homeAccounts: [],
      });
      invalidate();
      setAddingSet(false);
      setNewSet({ setName: "", setId: "", manufacturer: "Globus", notes: "" });
    } catch (e) {
      console.error("Failed to create set:", e);
    }
  };

  const deleteSet = async (id) => {
    try {
      await base44.entities.ConsignedSet.delete(id);
      invalidate();
      setConfirmDelete(null);
    } catch (e) {
      console.error("Failed to delete set:", e);
    }
  };

  // ── Tag-level helpers ──
  const updateTagLocation = (cs, tagIdx, newLocation) => {
    const homeAccounts = [...(cs.homeAccounts || [])];
    while (homeAccounts.length < (cs.tagNumbers || []).length) homeAccounts.push("");
    homeAccounts[tagIdx] = newLocation;
    updateSet(cs, { homeAccounts });
  };

  const addTagToSet = (cs, tagNumber) => {
    const tagNumbers = [...(cs.tagNumbers || []), tagNumber];
    const homeAccounts = [...(cs.homeAccounts || [])];
    while (homeAccounts.length < tagNumbers.length - 1) homeAccounts.push("");
    homeAccounts.push("");
    updateSet(cs, { tagNumbers, homeAccounts });
    setAddingTagFor(null);
    setNewTagValue("");
  };

  const removeTagFromSet = (cs, tagIdx) => {
    const tagNumbers = (cs.tagNumbers || []).filter((_, i) => i !== tagIdx);
    const homeAccounts = (cs.homeAccounts || []).filter((_, i) => i !== tagIdx);
    updateSet(cs, { tagNumbers, homeAccounts });
  };

  const addNewLocation = (cs, tagIdx, newLocationName) => {
    if (!newLocationName.trim()) return;
    updateTagLocation(cs, tagIdx, newLocationName.trim());
    setNewLocationInput(null);
    setNewLocationText("");
  };

  // ── Filtering ──
  const filteredSets = useMemo(() => {
    return consignedSets.filter((cs) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        cs.setName?.toLowerCase().includes(q) ||
        cs.setId?.toLowerCase().includes(q) ||
        (cs.tagNumbers || []).some((t) => t?.toLowerCase().includes(q))
      );
    });
  }, [consignedSets, search]);

  return (
    <div>
      {/* Header row */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Input
          placeholder="🔍 Search sets, IDs, or tag #s..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="text-base flex-1"
        />
        <Button onClick={() => setAddingSet(true)} className="min-h-[44px] whitespace-nowrap">
          <Plus size={16} className="mr-1" /> Add Set
        </Button>
      </div>

      {/* Add Set Form */}
      {addingSet && (
        <div className="bg-white border border-blue-200 rounded-xl p-4 mb-4 shadow-sm">
          <h3 className="font-semibold text-sm mb-3">New Consignment Set</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Set Name *</label>
              <Input
                autoFocus
                value={newSet.setName}
                onChange={(e) => setNewSet({ ...newSet, setName: e.target.value })}
                placeholder="e.g. CREO MIS IMPLANT SET"
                className="text-base"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Set ID</label>
              <Input
                value={newSet.setId}
                onChange={(e) => setNewSet({ ...newSet, setId: e.target.value })}
                placeholder="e.g. 9134.9001"
                className="text-base"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Manufacturer</label>
              <select
                value={newSet.manufacturer}
                onChange={(e) => setNewSet({ ...newSet, manufacturer: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-base bg-white min-h-[44px]"
              >
                {MANUFACTURERS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-600 mb-1 block">Notes</label>
              <Input
                value={newSet.notes}
                onChange={(e) => setNewSet({ ...newSet, notes: e.target.value })}
                placeholder="e.g. Use Loaner Tag"
                className="text-base"
              />
            </div>
          </div>
          <div className="flex gap-2 justify-end">
            <Button variant="outline" onClick={() => setAddingSet(false)} className="min-h-[44px]">Cancel</Button>
            <Button
              onClick={() => createSet(newSet)}
              disabled={!newSet.setName.trim()}
              className="min-h-[44px]"
            >
              <Check size={15} className="mr-1" /> Create Set
            </Button>
          </div>
        </div>
      )}

      {/* Loading */}
      {loadingSets && (
        <div className="text-center py-12 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
          Loading consignment sets...
        </div>
      )}

      {/* Sets List */}
      {!loadingSets && filteredSets.length === 0 && (
        <div className="text-center py-12 text-gray-400 text-sm">
          {consignedSets.length === 0 ? "No consignment sets yet. Click 'Add Set' to create one." : "No sets match your search."}
        </div>
      )}

      <div className="space-y-3">
        {filteredSets.map((cs) => {
          const isExpanded = expandedSet === cs.id;
          const isSaving = savingSets[cs.id];
          const isEditingName = editingSetName?.id === cs.id;
          const tags = cs.tagNumbers || [];
          const homeAccounts = cs.homeAccounts || [];

          return (
            <div key={cs.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden">
              {/* Set Header */}
              <div className="p-4 flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <button
                    onClick={() => setExpandedSet(isExpanded ? null : cs.id)}
                    className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                  >
                    {isExpanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
                  </button>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      {isEditingName ? (
                        <div className="flex items-center gap-1">
                          <Input
                            autoFocus
                            value={editingSetName.setName}
                            onChange={(e) => setEditingSetName({ ...editingSetName, setName: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { updateSet(cs, { setName: editingSetName.setName }); setEditingSetName(null); }
                              if (e.key === "Escape") setEditingSetName(null);
                            }}
                            className="text-sm h-8 px-2"
                          />
                          <button
                            onClick={() => { updateSet(cs, { setName: editingSetName.setName }); setEditingSetName(null); }}
                            className="text-green-600 hover:text-green-800"
                          >
                            <Check size={14} />
                          </button>
                          <button onClick={() => setEditingSetName(null)} className="text-gray-400 hover:text-gray-600">
                            <X size={14} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-semibold text-sm text-gray-800 truncate">{cs.setName}</h3>
                          <button
                            onClick={() => setEditingSetName({ id: cs.id, setName: cs.setName })}
                            className="text-gray-300 hover:text-blue-500 transition-colors"
                            title="Edit set name"
                          >
                            <Pencil size={12} />
                          </button>
                        </div>
                      )}
                      {cs.setId && <span className="text-xs text-gray-400 font-mono">{cs.setId}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1 flex-wrap">
                      {cs.manufacturer && (
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full border ${
                          cs.manufacturer === "Globus"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-purple-50 text-purple-700 border-purple-200"
                        }`}>
                          {cs.manufacturer}
                        </span>
                      )}
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <Package size={11} /> {tags.length} tag{tags.length !== 1 ? "s" : ""}
                      </span>
                      {cs.notes && <span className="text-xs text-gray-400 italic truncate">{cs.notes}</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {isSaving && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                  <button
                    onClick={() => setConfirmDelete(cs)}
                    className="text-xs text-red-500 hover:text-red-700 border border-red-200 rounded px-2 py-1.5 hover:bg-red-50 transition-colors"
                    title="Delete set"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>

              {/* Expanded: Tags with editable locations */}
              {isExpanded && (
                <div className="border-t border-gray-50 px-4 pb-4 pt-3">
                  {tags.length === 0 && (
                    <p className="text-xs text-gray-400 italic py-2">No tags added yet. Use "Add Tag" below.</p>
                  )}
                  {tags.map((tag, idx) => {
                    const location = homeAccounts[idx] || "";
                    const isAddingLocation = newLocationInput?.setId === cs.id && newLocationInput?.tagIdx === idx;

                    return (
                      <div key={idx} className="flex flex-wrap items-center gap-2 py-2 border-b last:border-0">
                        <span className="font-mono text-sm text-gray-700 font-medium min-w-[80px]">{tag}</span>
                        <MapPin size={12} className="text-gray-400" />
                        {isAddingLocation ? (
                          <div className="flex items-center gap-1 flex-1">
                            <Input
                              autoFocus
                              placeholder="Enter new location name..."
                              value={newLocationText}
                              onChange={(e) => setNewLocationText(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") addNewLocation(cs, idx, newLocationText);
                                if (e.key === "Escape") { setNewLocationInput(null); setNewLocationText(""); }
                              }}
                              className="text-sm h-8 flex-1 max-w-xs"
                            />
                            <button
                              onClick={() => addNewLocation(cs, idx, newLocationText)}
                              className="text-green-600 hover:text-green-800"
                            >
                              <Check size={14} />
                            </button>
                            <button onClick={() => { setNewLocationInput(null); setNewLocationText(""); }} className="text-gray-400 hover:text-gray-600">
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <select
                            value={location}
                            onChange={(e) => {
                              if (e.target.value === "__add_new__") {
                                setNewLocationInput({ setId: cs.id, tagIdx: idx });
                              } else {
                                updateTagLocation(cs, idx, e.target.value);
                              }
                            }}
                            className="text-xs border border-gray-200 rounded-lg px-3 py-1.5 text-gray-600 bg-white min-h-[36px] flex-1 max-w-xs"
                          >
                            <option value="">— Select location —</option>
                            {accountOptions.map((acc) => (
                              <option key={acc} value={acc}>{acc}</option>
                            ))}
                            <option value="__add_new__">+ Add new location...</option>
                          </select>
                        )}
                        <button
                          onClick={() => removeTagFromSet(cs, idx)}
                          className="text-red-400 hover:text-red-600 ml-auto"
                          title="Remove tag"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    );
                  })}

                  {/* Add Tag */}
                  {addingTagFor === cs.id ? (
                    <div className="flex items-center gap-2 mt-3">
                      <Input
                        autoFocus
                        placeholder="Enter tag / etch number..."
                        value={newTagValue}
                        onChange={(e) => setNewTagValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && newTagValue.trim()) addTagToSet(cs, newTagValue.trim());
                          if (e.key === "Escape") { setAddingTagFor(null); setNewTagValue(""); }
                        }}
                        className="text-sm h-8 flex-1 max-w-xs"
                      />
                      <Button
                        size="sm"
                        onClick={() => newTagValue.trim() && addTagToSet(cs, newTagValue.trim())}
                        className="min-h-[36px]"
                      >
                        <Check size={14} className="mr-1" /> Add
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => { setAddingTagFor(null); setNewTagValue(""); }} className="min-h-[36px]">
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() => setAddingTagFor(cs.id)}
                      className="text-xs text-blue-600 hover:text-blue-800 font-medium mt-3 flex items-center gap-1"
                    >
                      <Plus size={14} /> Add Tag
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Delete Confirmation */}
      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl max-w-sm w-full p-6">
            <h2 className="font-bold text-lg mb-2">Delete Set?</h2>
            <p className="text-sm text-gray-600 mb-4">
              This will permanently delete <span className="font-semibold">{confirmDelete.setName}</span> and all its tracked tags. This cannot be undone.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={() => setConfirmDelete(null)} className="min-h-[44px]">Cancel</Button>
              <Button variant="destructive" onClick={() => deleteSet(confirmDelete.id)} className="min-h-[44px]">Delete</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}