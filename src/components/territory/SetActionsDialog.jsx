import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { MapPin, Pencil, Trash2, ChevronRight } from "lucide-react";

export default function SetActionsDialog({ set, open, onOpenChange, onEditLocations, onEditSet, onRemove }) {
  const run = (fn) => {
    onOpenChange(false);
    fn(set);
  };

  const actions = [
    {
      label: "Change locations",
      hint: "Place each tag at its account",
      icon: MapPin,
      color: "text-blue-600 bg-blue-50",
      onClick: () => run(onEditLocations),
    },
    {
      label: "Edit set",
      hint: "Rename the set or change its tags",
      icon: Pencil,
      color: "text-slate-600 bg-slate-100",
      onClick: () => run(onEditSet),
    },
    {
      label: "Remove set",
      hint: "Delete this set and its tracked tags",
      icon: Trash2,
      color: "text-red-600 bg-red-50",
      onClick: () => run(onRemove),
    },
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">{set?.setName}</DialogTitle>
          <DialogDescription>
            {(set?.tagNumbers || []).length} tags tracked{set?.setId ? ` · ${set.setId}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-2 py-1">
          {actions.map(({ label, hint, icon: Icon, color, onClick }) => (
            <button
              key={label}
              onClick={onClick}
              className="w-full flex items-center gap-3 p-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-left"
            >
              <span className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${color}`}>
                <Icon className="w-4 h-4" />
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-slate-800">{label}</span>
                <span className="block text-xs text-slate-500">{hint}</span>
              </span>
              <ChevronRight className="w-4 h-4 text-slate-300" />
            </button>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}