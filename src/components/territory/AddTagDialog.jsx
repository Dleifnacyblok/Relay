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
import { Tag, Loader2 } from "lucide-react";

export default function AddTagDialog({ open, onOpenChange, set, knownLocations = [] }) {
  const [tag, setTag] = useState("");
  const [location, setLocation] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!open) return;
    setTag("");
    setLocation("");
    setError(null);
  }, [open, set]);

  const handleSave = async () => {
    const value = tag.trim();
    if (!value) {
      setError("Enter a tag number.");
      return;
    }
    if ((set?.tagNumbers || []).includes(value)) {
      setError("That tag is already on this set.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await base44.entities.ConsignedSet.update(set.id, {
        tagNumbers: [...(set?.tagNumbers || []), value],
        homeAccounts: [...(set?.homeAccounts || []), location.trim()],
      });
      await queryClient.invalidateQueries({ queryKey: ["consignedSets"] });
      onOpenChange(false);
    } catch (e) {
      setError(e?.message || "Could not add this tag.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Tag className="w-4 h-4 text-blue-600" />
            Add tag
          </DialogTitle>
          <DialogDescription>{set?.setName}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Tag / etch # *</label>
            <Input
              autoFocus
              value={tag}
              onChange={(e) => setTag(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleSave())}
              placeholder="e.g. 48211"
              className="font-mono"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-slate-600 mb-1 block">Location (account)</label>
            <Input
              value={location}
              list="add-tag-known-locations"
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Pick an account or type a new one"
            />
            <datalist id="add-tag-known-locations">
              {knownLocations.map((l) => (
                <option key={l} value={l} />
              ))}
            </datalist>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
            {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
            {saving ? "Adding…" : "Add tag"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}