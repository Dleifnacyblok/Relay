import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, Package } from "lucide-react";
import { toast } from "sonner";

export default function SendBackDialog({ open, onOpenChange, selectedLoaners, selectedParts, userName, onSuccess }) {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  const sendBackMutation = useMutation({
    mutationFn: async () => {
      const loanerIds = selectedLoaners.map(l => l.id);
      const partIds = selectedParts.map(p => p.id);

      // Create send back log
      await base44.entities.SendBackLog.create({
        repName: userName,
        trackingNumber,
        sentDate: new Date().toISOString().slice(0, 10),
        loanerIds,
        missingPartIds: partIds,
        notes
      });

      // Update loaner statuses
      for (const loaner of selectedLoaners) {
        await base44.entities.Loaners.update(loaner.id, {
          returnStatus: "sent_back"
        });
      }

      // Update missing part statuses
      for (const part of selectedParts) {
        await base44.entities.MissingPart.update(part.id, {
          returnStatus: "sent_back"
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["myLoaners"] });
      queryClient.invalidateQueries({ queryKey: ["myMissingParts"] });
      queryClient.invalidateQueries({ queryKey: ["sendBackLogs"] });
      toast.success("Items marked as sent back");
      setTrackingNumber("");
      setNotes("");
      onSuccess();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Failed to send back items");
      console.error(error);
    }
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!trackingNumber.trim()) {
      toast.error("Please enter a tracking number");
      return;
    }
    sendBackMutation.mutate();
  };

  const totalItems = selectedLoaners.length + selectedParts.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Send Back Items</DialogTitle>
          <DialogDescription>
            Enter tracking number for {totalItems} item{totalItems !== 1 ? 's' : ''}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {/* Summary */}
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              {selectedLoaners.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Package className="w-4 h-4 text-slate-500" />
                  <span className="font-medium">{selectedLoaners.length}</span>
                  <span className="text-slate-600">loaner{selectedLoaners.length !== 1 ? 's' : ''}</span>
                </div>
              )}
              {selectedParts.length > 0 && (
                <div className="flex items-center gap-2 text-sm">
                  <Package className="w-4 h-4 text-slate-500" />
                  <span className="font-medium">{selectedParts.length}</span>
                  <span className="text-slate-600">missing part{selectedParts.length !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>

            {/* Tracking Number */}
            <div className="space-y-2">
              <Label htmlFor="tracking">Tracking Number *</Label>
              <Input
                id="tracking"
                value={trackingNumber}
                onChange={(e) => setTrackingNumber(e.target.value)}
                placeholder="Enter tracking number"
                required
              />
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any additional details..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={sendBackMutation.isPending}>
              {sendBackMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Sending...
                </>
              ) : (
                "Confirm Send Back"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}