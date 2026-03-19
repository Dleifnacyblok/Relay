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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Loader2, HandshakeIcon } from "lucide-react";

export default function BidDialog({ open, onOpenChange, item, user }) {
  const [message, setMessage] = useState("");
  const queryClient = useQueryClient();

  const bidMutation = useMutation({
    mutationFn: async () => {
      const existingBids = item.bids || [];
      const newBid = {
        bidderName: user?.full_name || "Unknown",
        bidderEmail: user?.email || "",
        message: message.trim(),
        timestamp: new Date().toISOString(),
      };
      await base44.entities.MarketplaceItem.update(item.id, {
        bids: [...existingBids, newBid],
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplaceItems"] });
      onOpenChange(false);
      setMessage("");
    },
    onError: () => {
      toast.error("Failed to send request. Please try again.");
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HandshakeIcon className="w-5 h-5 text-indigo-600" />
            Place a Request
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-1 mb-2 bg-slate-50 rounded-lg p-3">
          <p className="text-sm font-medium text-slate-800">{item?.partName || item?.partNumber}</p>
          {item?.partName && <p className="text-xs text-slate-500">Part #: {item?.partNumber}</p>}
          <p className="text-xs text-slate-500">Qty available: {item?.quantity}</p>
          {item?.repName && <p className="text-xs text-slate-500">Listed by: {item?.repName}</p>}
        </div>

        <div className="space-y-1.5">
          <Label>Message (optional)</Label>
          <Textarea
            placeholder="Add a note to your request..."
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={3}
          />
        </div>

        <div className="flex gap-3 mt-4">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            className="flex-1 bg-indigo-600 hover:bg-indigo-700"
            disabled={bidMutation.isPending}
            onClick={() => bidMutation.mutate()}
          >
            {bidMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Send Request"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}