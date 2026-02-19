import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowRightLeft, Loader2 } from "lucide-react";

export default function TransferDialog({ open, onOpenChange, selectedLoaners, onSuccess }) {
  const [transferTo, setTransferTo] = useState("");
  const [requestNumber, setRequestNumber] = useState("");
  const [isOverdue, setIsOverdue] = useState(null);
  const queryClient = useQueryClient();

  const transferMutation = useMutation({
    mutationFn: async () => {
      for (const loaner of selectedLoaners) {
        await base44.entities.Loaners.update(loaner.id, {
          returnStatus: "transferred",
          notes: `Transferred to: ${transferTo} | Request #: ${requestNumber} | Overdue: ${isOverdue ? "Yes" : "No"}${loaner.notes ? ` | ${loaner.notes}` : ""}`,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loaners"] });
      onOpenChange(false);
      onSuccess?.();
      setTransferTo("");
      setRequestNumber("");
      setIsOverdue(null);
    },
  });

  const canSubmit = transferTo.trim() && requestNumber.trim() && isOverdue !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ArrowRightLeft className="w-5 h-5 text-blue-600" />
            Transfer Loaners
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-1 mb-4 bg-slate-50 rounded-lg p-3">
          <p className="text-sm font-medium text-slate-700">Transferring {selectedLoaners.length} set{selectedLoaners.length !== 1 ? "s" : ""}:</p>
          {selectedLoaners.map(l => (
            <p key={l.id} className="text-sm text-slate-600">• {l.setName} {l.etchId && <span className="text-slate-400">(Etch: {l.etchId})</span>}</p>
          ))}
        </div>

        <div className="space-y-5">
          {/* Q1 */}
          <div className="space-y-1.5">
            <Label>1. Who are these getting transferred to? <span className="text-red-500">*</span></Label>
            <Input
              placeholder="Enter name..."
              value={transferTo}
              onChange={e => setTransferTo(e.target.value)}
            />
          </div>

          {/* Q2 */}
          <div className="space-y-1.5">
            <Label>2. What is the request number? <span className="text-red-500">*</span></Label>
            <Input
              placeholder="Enter request #..."
              value={requestNumber}
              onChange={e => setRequestNumber(e.target.value)}
            />
          </div>

          {/* Q3 */}
          <div className="space-y-2">
            <Label>3. Are these loaners overdue? <span className="text-red-500">*</span></Label>
            <div className="flex gap-3">
              <button
                onClick={() => setIsOverdue(true)}
                className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  isOverdue === true
                    ? "bg-red-50 border-red-400 text-red-700"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                Yes
              </button>
              <button
                onClick={() => setIsOverdue(false)}
                className={`flex-1 py-2.5 rounded-lg border text-sm font-medium transition-colors ${
                  isOverdue === false
                    ? "bg-green-50 border-green-400 text-green-700"
                    : "bg-white border-slate-200 text-slate-600 hover:border-slate-300"
                }`}
              >
                No
              </button>
            </div>
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="flex-1 bg-blue-600 hover:bg-blue-700"
            disabled={!canSubmit || transferMutation.isPending}
            onClick={() => transferMutation.mutate()}
          >
            {transferMutation.isPending ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Transferring...
              </>
            ) : (
              <>
                <ArrowRightLeft className="w-4 h-4" />
                Confirm Transfer
              </>
            )}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}