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
import { ArrowRightLeft, Loader2, Camera, X } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";

export default function TransferDialog({ open, onOpenChange, selectedLoaners, userName, onSuccess }) {
  const [transferTo, setTransferTo] = useState("");
  const [requestNumber, setRequestNumber] = useState("");
  const [isOverdue, setIsOverdue] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [uploadingPhotos, setUploadingPhotos] = useState(false);
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  const handlePhotoChange = async (e) => {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    setUploadingPhotos(true);
    const urls = [];
    for (const file of files) {
      const { file_url } = await base44.integrations.Core.UploadFile({ file });
      urls.push(file_url);
    }
    setPhotos(prev => [...prev, ...urls]);
    setUploadingPhotos(false);
  };

  const removePhoto = (idx) => setPhotos(prev => prev.filter((_, i) => i !== idx));

  const transferMutation = useMutation({
    mutationFn: async () => {
      const today = format(new Date(), "yyyy-MM-dd");
      const loanerIds = selectedLoaners.map(l => l.id);
      const notesStr = `Transfer to: ${transferTo} | Transferred by: ${userName} | Request #: ${requestNumber} | Overdue: ${isOverdue ? "Yes" : "No"}${notes ? ` | Notes: ${notes}` : ""}`;

      // Collect original repNames (for 3rd-party transfers)
      const originalRepNames = [...new Set(selectedLoaners.map(l => l.repName).filter(Boolean))];

      // Update each loaner's status
      for (const loaner of selectedLoaners) {
        await base44.entities.Loaners.update(loaner.id, {
          returnStatus: "transferred",
          notes: notesStr,
        });
      }

      // Create a SendBackLog entry for the person doing the transfer (initiator)
      await base44.entities.SendBackLog.create({
        repName: userName,
        sentDate: today,
        loanerIds,
        logType: "transfer",
        transferTo: transferTo.trim(),
        requestNumber,
        isOverdue,
        photoUrls: photos,
        notes: notesStr,
      });

      // Try to find matching Relay users and create logs for recipient + original holders
      try {
        const allUsers = await base44.entities.User.list();

        // Log for recipient
        const recipientUser = allUsers.find(u =>
          u.full_name?.toLowerCase().trim() === transferTo.toLowerCase().trim()
        );
        if (recipientUser) {
          await base44.entities.SendBackLog.create({
            repName: recipientUser.full_name,
            sentDate: today,
            loanerIds,
            logType: "transfer",
            transferTo: recipientUser.full_name,
            requestNumber,
            isOverdue,
            photoUrls: photos,
            notes: `Transferred to you from: ${userName} | Request #: ${requestNumber} | Overdue: ${isOverdue ? "Yes" : "No"}${notes ? ` | Notes: ${notes}` : ""}`,
            trackingNumber: "TRANSFER_IN",
          });
        }

        // Log for original rep(s) if the initiator is transferring someone else's loaner
        for (const origRepName of originalRepNames) {
          if (origRepName.toLowerCase().trim() === userName.toLowerCase().trim()) continue;
          if (origRepName.toLowerCase().trim() === transferTo.toLowerCase().trim()) continue;
          const origUser = allUsers.find(u =>
            u.full_name?.toLowerCase().trim() === origRepName.toLowerCase().trim()
          );
          if (origUser) {
            await base44.entities.SendBackLog.create({
              repName: origUser.full_name,
              sentDate: today,
              loanerIds: loanerIds.filter(id => selectedLoaners.find(l => l.id === id && l.repName?.toLowerCase().trim() === origRepName.toLowerCase().trim())),
              logType: "transfer",
              transferTo: transferTo.trim(),
              requestNumber,
              isOverdue,
              photoUrls: photos,
              notes: `Your loaner was transferred by ${userName} to ${transferTo} | Request #: ${requestNumber} | Overdue: ${isOverdue ? "Yes" : "No"}${notes ? ` | Notes: ${notes}` : ""}`,
              trackingNumber: "TRANSFER_NOTIFY",
            });
          }
        }
      } catch (_) {
        // Non-critical
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loaners"] });
      queryClient.invalidateQueries({ queryKey: ["sendBackLogs"] });
      onOpenChange(false);
      onSuccess?.();
      setTransferTo("");
      setRequestNumber("");
      setIsOverdue(null);
      setPhotos([]);
      setNotes("");
    },
  });

  const canSubmit = transferTo.trim() && requestNumber.trim() && isOverdue !== null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>4. Notes (optional)</Label>
            <Textarea
              placeholder="Any additional notes..."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          {/* Photos */}
          <div className="space-y-2">
            <Label>5. Add Photos (optional)</Label>
            <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed border-slate-200 rounded-lg p-3 hover:border-slate-300 transition-colors">
              {uploadingPhotos ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              ) : (
                <Camera className="w-4 h-4 text-slate-400" />
              )}
              <span className="text-sm text-slate-500">{uploadingPhotos ? "Uploading..." : "Take or upload photos"}</span>
              <input
                type="file"
                accept="image/*"
                multiple
                capture="environment"
                className="hidden"
                onChange={handlePhotoChange}
                disabled={uploadingPhotos}
              />
            </label>
            {photos.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {photos.map((url, idx) => (
                  <div key={idx} className="relative">
                    <img src={url} alt="" className="w-full h-20 object-cover rounded-lg" />
                    <button
                      onClick={() => removePhoto(idx)}
                      className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5"
                    >
                      <X className="w-3 h-3 text-white" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="flex-1 bg-blue-600 hover:bg-blue-700"
            disabled={!canSubmit || transferMutation.isPending || uploadingPhotos}
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