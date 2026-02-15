import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { HandCoins } from "lucide-react";
import { toast } from "sonner";

export default function RequestLoanerDialog({ loaner, currentUser }) {
  const [open, setOpen] = useState(false);
  const [formData, setFormData] = useState({
    reason: "",
    accountName: "",
    urgency: "medium",
  });
  const queryClient = useQueryClient();

  const requestMutation = useMutation({
    mutationFn: async (data) => {
      // Create the request
      await base44.entities.LoanerRequest.create({
        loanerId: loaner.id,
        requesterName: currentUser.full_name,
        currentHolderName: loaner.repName,
        reason: data.reason,
        accountName: data.accountName,
        urgency: data.urgency,
        status: "pending",
      });

      // Create notification for current holder
      await base44.entities.Notification.create({
        repName: loaner.repName,
        type: "loaner_request",
        severity: data.urgency === "high" ? "warning" : "info",
        title: "Loaner Request",
        message: `${currentUser.full_name} wants to use ${loaner.setName}`,
        relatedLoanerId: loaner.id,
      });
    },
    onSuccess: () => {
      toast.success("Request sent to " + loaner.repName);
      queryClient.invalidateQueries(["loanerRequests", loaner.id]);
      setOpen(false);
      setFormData({ reason: "", accountName: "", urgency: "medium" });
    },
    onError: () => {
      toast.error("Failed to send request");
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.accountName.trim()) {
      toast.error("Please enter an account name");
      return;
    }
    requestMutation.mutate(formData);
  };

  const isCurrentHolder = currentUser?.full_name?.toLowerCase() === loaner?.repName?.toLowerCase();

  if (isCurrentHolder) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="w-full sm:w-auto bg-blue-600 hover:bg-blue-700">
          <HandCoins className="w-4 h-4 mr-2" />
          Request This Loaner
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Request Loaner</DialogTitle>
            <DialogDescription>
              Send a request to {loaner.repName} to use {loaner.setName}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="accountName">Account Name *</Label>
              <Input
                id="accountName"
                placeholder="Where will you use this loaner?"
                value={formData.accountName}
                onChange={(e) => setFormData({ ...formData, accountName: e.target.value })}
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="urgency">Urgency</Label>
              <Select
                value={formData.urgency}
                onValueChange={(value) => setFormData({ ...formData, urgency: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="low">Low - Can wait</SelectItem>
                  <SelectItem value="medium">Medium - Within a week</SelectItem>
                  <SelectItem value="high">High - Urgent need</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="reason">Additional Notes (Optional)</Label>
              <Textarea
                id="reason"
                placeholder="Any additional details..."
                value={formData.reason}
                onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
                rows={3}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={requestMutation.isPending}>
              {requestMutation.isPending ? "Sending..." : "Send Request"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}