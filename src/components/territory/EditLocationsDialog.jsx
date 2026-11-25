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
import { MapPin, Loader2 } from "lucide-react";

const OTHER = "__other__";

export default function EditLocationsDialog({ set, open, onOpenChange, knownLocations = [] }) {
  const [values, setValues] = useState({});
  const [custom, setCustom] = useState({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const queryClient = useQueryClient();

  const tags = set?.tagNumbers || [];

  useEffect(() => {
    if (!open || !set) return;
    const v = {};
    const c = {};
    (set.tagNumbers || []).forEach((tag, i) => {
      const loc = ((set.homeAccounts || [])[i] || "").trim();
      v[tag] = loc;
      c[tag] = !!loc && !knownLocations.includes(loc);
    });
    setValues(v);
    setCustom(c);
    setError(null);
  }, [open, set, knownLocations]);

  const setValue = (tag, val) => setValues((p) => ({ ...p, [tag]: val }));

  const handleSelect = (tag, val) => {
    if (val === OTHER) {
      setCustom((p) => ({ ...p, [tag]: true }));
      setValue(tag, "");
      return;
    }
    setCustom((p) => ({ ...p, [tag]: false }));
    setValue(tag, val);
  };

  const handleSave = async () => {
    if (!set) return;
    setSaving(true);
    setError(null);
    try {
      const homeAccounts = tags.map((t) => (values[t] || "").trim());
      await base44.entities.ConsignedSet.update(set.id, { homeAccounts });
      await queryClient.invalidateQueries({ queryKey: ["consignedSets"] });
      onOpenChange(false);
    } catch (e) {
      setError(e?.message || "Could not save locations.");
    } finally {
      setSaving(false);
    }
  };

  const filled = tags.filter((t) => (values[t] || "").trim()).length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <MapPin className="w-4 h-4 text-blue-600" />
            Account locations
          </DialogTitle>
          <DialogDescription>
            {set?.setName} — where each tag sits in the territory. {filled} of {tags.length} set.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-1">
          {tags.length === 0 && (
            <p className="text-sm text-slate-500">This set has no tags to place yet.</p>
          )}
          {tags.map((tag) => {
            const value = values[tag] || "";
            const isCustom = custom[tag] || (!!value && !knownLocations.includes(value));
            return (
              <div key={tag}>
                <div className="flex items-center justify-between mb-1">
                  <span className="font-mono text-sm font-semibold text-slate-700">{tag}</span>
                  {value && (
                    <button
                      onClick={() => {
                        setValue(tag, "");
                        setCustom((p) => ({ ...p, [tag]: false }));
                      }}
                      className="text-xs text-slate-400 hover:text-red-600"
                    >
                      Clear
                    </button>
                  )}
                </div>
                <select
                  value={isCustom ? OTHER : value}
                  onChange={(e) => handleSelect(tag, e.target.value)}
                  className="w-full h-10 rounded-md border border-input bg-background px-3 text-base"
                >
                  <option value="">No location</option>
                  {knownLocations.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                  <option value={OTHER}>+ New location…</option>
                </select>
                {isCustom && (
                  <Input
                    value={value}
                    onChange={(e) => setValue(tag, e.target.value)}
                    placeholder="Account name, e.g. U of M"
                    className="mt-2"
                  />
                )}
              </div>
            );
          })}
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancel
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || tags.length === 0}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving…
              </>
            ) : (
              "Save locations"
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}