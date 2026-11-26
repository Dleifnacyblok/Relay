import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MapPin, Trash2, ChevronRight, AlertTriangle } from "lucide-react";

export default function TagActionsDialog({
  open,
  onOpenChange,
  set,
  tagIndex,
  onEditLocations,
  onRemove,
}) {
  const [confirming, setConfirming] = useState(false);

  useEffect(() => {
    setConfirming(false);
  }, [open, tagIndex, set]);

  const tag = tagIndex != null ? (set?.tagNumbers || [])[tagIndex] : null;
  const location = tagIndex != null ? (set?.homeAccounts || [])[tagIndex] : "";

  const changeLocation = () => {
    onOpenChange(false);
    onEditLocations(set);
  };

  const removeTag = () => {
    onOpenChange(false);
    onRemove(set, tagIndex);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="font-mono text-base">{tag}</DialogTitle>
          <DialogDescription>
            {set?.setName}
            {location ? ` · ${location}` : " · no location set"}
          </DialogDescription>
        </DialogHeader>

        {confirming ? (
          <div className="space-y-3 py-1">
            <div className="flex items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-3">
              <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              <p className="text-xs text-red-700">
                Remove tag <span className="font-mono font-semibold">{tag}</span> from this set? The loaner
                record itself is not deleted.
              </p>
            </div>
            <DialogFooter className="gap-2">
              <Button variant="outline" onClick={() => setConfirming(false)}>
                Cancel
              </Button>
              <Button onClick={removeTag} className="bg-red-600 hover:bg-red-700">
                Remove tag
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-2 py-1">
            <button
              onClick={changeLocation}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-left"
            >
              <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-blue-600 bg-blue-50">
                <MapPin className="w-4 h-4" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-slate-800">Change location</span>
                <span className="block text-xs text-slate-500">Place this tag at its account</span>
              </span>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </button>

            <button
              onClick={() => setConfirming(true)}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-left"
            >
              <span className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 text-red-600 bg-red-50">
                <Trash2 className="w-4 h-4" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-slate-800">Remove tag</span>
                <span className="block text-xs text-slate-500">Take this tag off the set</span>
              </span>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}