import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Trash2, Search, AlertCircle } from "lucide-react";
import { format } from "date-fns";

export default function LookForSection({ lookForItems, marketplaceItems, missingParts, user }) {
  const queryClient = useQueryClient();

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.LookForItem.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lookForItems"] }),
  });

  // For each look-for item, check if any marketplace listing matches by part number
  const getMatches = (lookFor) => {
    const matches = [];
    const pn = (lookFor.partNumber || "").toLowerCase().trim();
    const pname = (lookFor.partName || "").toLowerCase().trim();

    // Check marketplace listings (exclude own listings)
    (marketplaceItems || []).forEach(item => {
      if (item.created_by === user?.email) return;
      if (item.status === "sold") return;
      const itemPn = (item.partNumber || "").toLowerCase().trim();
      const itemName = (item.partName || "").toLowerCase().trim();
      if ((pn && itemPn && itemPn.includes(pn)) || (pn && itemPn && pn.includes(itemPn))) {
        matches.push({ type: "listing", item });
      } else if (pname && itemName && (itemName.includes(pname) || pname.includes(itemName))) {
        matches.push({ type: "listing", item });
      }
    });

    // Check missing parts under their own name
    (missingParts || []).forEach(part => {
      if ((part.repName || "").toLowerCase() !== (user?.full_name || "").toLowerCase()) return;
      if (part.status !== "missing") return;
      const partPn = (part.partNumber || "").toLowerCase().trim();
      const partName2 = (part.partName || "").toLowerCase().trim();
      if ((pn && partPn && (partPn.includes(pn) || pn.includes(partPn)))) {
        matches.push({ type: "missing_part", item: part });
      } else if (pname && partName2 && (partName2.includes(pname) || pname.includes(partName2))) {
        matches.push({ type: "missing_part", item: part });
      }
    });

    return matches;
  };

  const myItems = (lookForItems || []).filter(i => i.created_by === user?.email && i.status === "active");

  if (myItems.length === 0) return null;

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <Search className="w-4 h-4 text-indigo-500" />
        <h2 className="text-sm font-semibold text-slate-700">My Look For List</h2>
        <span className="text-xs text-slate-400">({myItems.length})</span>
      </div>

      <div className="space-y-2">
        {myItems.map(lookFor => {
          const matches = getMatches(lookFor);
          return (
            <div key={lookFor.id} className={`rounded-xl border p-3 ${matches.length > 0 ? "border-amber-300 bg-amber-50" : "border-slate-200 bg-white"}`}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800">{lookFor.partNumber}</span>
                    {lookFor.partName && <span className="text-xs text-slate-500 truncate">{lookFor.partName}</span>}
                    {matches.length > 0 && (
                      <Badge className="bg-amber-100 text-amber-800 border-amber-300 text-xs gap-1">
                        <AlertCircle className="w-3 h-3" /> {matches.length} match{matches.length > 1 ? "es" : ""}
                      </Badge>
                    )}
                  </div>

                  {matches.length > 0 && (
                    <div className="mt-2 space-y-1.5">
                      {matches.map((m, idx) => (
                        <div key={idx} className="flex items-start gap-2 text-xs rounded-lg p-2 bg-white border border-amber-200">
                          {m.type === "listing" ? (
                            <>
                              <span className="font-medium text-green-700 shrink-0">Listed:</span>
                              <span className="text-slate-600">
                                {m.item.partName || m.item.partNumber} — {m.item.quantity} available
                                {m.item.repName ? ` by ${m.item.repName}` : ""}
                                {m.item.location ? ` (${m.item.location})` : ""}
                              </span>
                            </>
                          ) : (
                            <>
                              <span className="font-medium text-red-700 shrink-0">Missing Part:</span>
                              <span className="text-slate-600">
                                {m.item.partName || m.item.partNumber} — reported {m.item.missingDate ? format(new Date(m.item.missingDate), "MMM d") : ""}
                              </span>
                            </>
                          )}
                        </div>
                      ))}
                    </div>
                  )}

                  {lookFor.notes && <p className="text-xs text-slate-400 mt-1">{lookFor.notes}</p>}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="shrink-0 h-7 w-7 text-slate-400 hover:text-red-500"
                  onClick={() => deleteMutation.mutate(lookFor.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}