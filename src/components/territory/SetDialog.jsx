import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus, X, Loader2, Package } from "lucide-react";

const MANUFACTURERS = ["Globus", "Nuvasive"];

export default function SetDialog({ open, onOpenChange, set = null, knownLocations = [] }) {
  const isEdit = !!set;
  const [form, setForm] = useState({ setName: "", setId: "", manufacturer: "Globus", notes: "" });
  const [tags, setTags] = useState([]);
  const [newTag, setNewTag] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) return;
    setForm({
      setName: set?.setName || "",
      setId: set?.setId || "",
      manufacturer: set?.manufacturer || "Globus",
      notes: set?.notes || "",
    });
    setTags(
      (set?.tagNumbers || []).map((tag, i) => ({ tag, location: (set?.homeAccounts || [])[i] || "" }))
    );
    setNewTag("");
    setError(null);
  }, [open, set]);

  const addTag = () => {
    const value = newTag.trim();
    if (!value) return;
    if (tags.some((t) => t.tag === value)) {
      setError("That tag is already on this set.");
      return;
    }
    setTags((p) => [...p, { tag: value, location: "" }]);
    setNewTag("");
    setError(null);
  };

  const handleSave = async () => {
    if (!form.setName.trim()) {
      setError("Set name is required.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        setName: form.setName.trim(),
        setId: form.setId.trim(),
        manufacturer: form.manufacturer,
        notes: form.notes.trim(),
        tagNumbers: tags.map((t) => t.tag),
        homeAccounts: tags.map((t) => t.location),
      };
      if (isEdit) {
        await base44.entities.ConsignedSet.update(set.id, payload);
      } else {
        await base44.entities.ConsignedSet.create(payload);
      }
      await queryClient.invalidateQueries({ queryKey: ["consignedSets"] });
      onOpenChange(false);
    } catch (e) {
      setError(e?.message || "Could not save this set.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Package className="w-4 h-4 text-blue-600" />
            {isEdit ? "Edit set" : "Add set"}
          </DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Rename the set, add or remove tags, and set where each tag sits."
              : "Add a consigned set with its tags and where each tag sits."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Set name *</label>
            <Input
              autoFocus
              value={form.setName}
              onChange={(e) => setForm({ ...form, setName: e.target.value })}
              placeholder="e.g. CREO MIS IMPLANT SET"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Set ID</label>
              <Input
                value={form.setId}
                onChange={(e) => setForm({ ...form, setId: e.target.value })}
                placeholder="e.g. 9134.9001"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">Manufacturer</label>
              <select
                value={form.manufacturer}
                onChange={(e) => setForm({ ...form, manufacturer: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 text-base"
              >
                {MANUFACTURERS.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Notes</label>
            <Input
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              placeholder="Optional, e.g. Use Loaner Tag"
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">
              Tags ({tags.length})
            </label>
            <div className="flex gap-2">
              <Input
                value={newTag}
                onChange={(e) => setNewTag(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
                placeholder="Tag / etch #"
                className="font-mono"
              />
              <Button type="button" variant="outline" onClick={addTag} className="shrink-0">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="space-y-2 mt-2">
                <datalist id="set-known-locations">
                  {knownLocations.map((l) => (
                    <option key={l} value={l} />
                  ))}
                </datalist>
                {tags.map((t, i) => (
                  <div key={t.tag} className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-slate-700 bg-slate-50 border border-slate-200 px-2 py-1.5 rounded-lg shrink-0 min-w-[72px] text-center">
                      {t.tag}
                    </span>
                    <Input
                      value={t.location}
                      list="set-known-locations"
                      onChange={(e) =>
                        setTags((p) => p.map((x, idx) => (idx === i ? { ...x, location: e.target.value } : x)))
                      }
                      placeholder="Location (account)"
                      className="h-9"
                    />
                    <button
                      type="button"
                      onClick={() => setTags((p) => p.filter((_, idx) => idx !== i))}
                      className="text-slate-400 hover:text-red-600 shrink-0"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {saving ? "Saving…" : isEdit ? "Save set" : "Add set"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}