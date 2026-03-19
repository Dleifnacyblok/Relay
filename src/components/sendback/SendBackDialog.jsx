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
import { Loader2, Package, Camera, X, ScanLine } from "lucide-react";
import { toast } from "sonner";
import BarcodeScanner from "./BarcodeScanner";

export default function SendBackDialog({ open, onOpenChange, selectedLoaners, selectedParts, userName, onSuccess }) {
  const [trackingNumber, setTrackingNumber] = useState("");
  const [showScanner, setShowScanner] = useState(false);
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState([]);
  const [uploading, setUploading] = useState(false);
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
        notes,
        photoUrls: photos
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
      setPhotos([]);
      onSuccess();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error("Failed to send back items");
      console.error(error);
    }
  });

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    setUploading(true);
    try {
      const uploadedUrls = [];
      for (const file of files) {
        const { file_url } = await base44.integrations.Core.UploadFile({ file });
        uploadedUrls.push(file_url);
      }
      setPhotos([...photos, ...uploadedUrls]);
      toast.success(`${files.length} photo${files.length > 1 ? 's' : ''} uploaded`);
    } catch (error) {
      toast.error("Failed to upload photos");
      console.error(error);
    } finally {
      setUploading(false);
    }
  };

  const removePhoto = (index) => {
    setPhotos(photos.filter((_, i) => i !== index));
  };

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
              <div className="flex gap-2">
                <Input
                  id="tracking"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  placeholder="Enter or scan tracking number"
                  required
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowScanner(true)}
                  className="shrink-0 gap-1.5"
                >
                  <ScanLine className="w-4 h-4" />
                  Scan
                </Button>
              </div>
            </div>

            {showScanner && (
              <BarcodeScanner
                onScan={(result) => { setTrackingNumber(result); setShowScanner(false); }}
                onClose={() => setShowScanner(false)}
              />
            )}

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

            {/* Photos */}
            <div className="space-y-2">
              <Label>Photos (Optional)</Label>
              <div className="space-y-3">
                {photos.length > 0 && (
                  <div className="grid grid-cols-3 gap-2">
                    {photos.map((url, index) => (
                      <div key={index} className="relative group">
                        <img 
                          src={url} 
                          alt={`Photo ${index + 1}`}
                          className="w-full h-20 object-cover rounded-lg border border-slate-200"
                        />
                        <button
                          type="button"
                          onClick={() => removePhoto(index)}
                          className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div>
                  <input
                    type="file"
                    accept="image/*"
                            multiple
                    onChange={handlePhotoUpload}
                    className="hidden"
                    id="photo-upload"
                    disabled={uploading}
                  />
                  <label htmlFor="photo-upload">
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      disabled={uploading}
                      asChild
                    >
                      <span>
                        {uploading ? (
                          <>
                            <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                            Uploading...
                          </>
                        ) : (
                          <>
                            <Camera className="w-4 h-4 mr-2" />
                            Take or Add Photo
                          </>
                        )}
                      </span>
                    </Button>
                  </label>
                </div>
              </div>
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