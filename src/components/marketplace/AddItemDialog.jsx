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
import { Textarea } from "@/components/ui/textarea";
import { Camera, Loader2, X, ScanLine, Type } from "lucide-react";

export default function AddItemDialog({ open, onOpenChange, user }) {
  const [partNumber, setPartNumber] = useState("");
  const [partName, setPartName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [repName, setRepName] = useState(user?.full_name || "");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState(null);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [scanningPart, setScanningPart] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [inputMode, setInputMode] = useState("scan"); // "scan" | "manual"

  const queryClient = useQueryClient();

  const handlePhotoCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    setScanError(null);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setPhotoUrl(file_url);

    // Auto-scan the part number from the image
    setScanningPart(true);
    try {
      const res = await base44.functions.invoke("identifyPartNumber", { imageUrl: file_url });
      const detected = res.data?.partNumber;
      if (detected) {
        setPartNumber(detected);
      } else {
        setScanError("Couldn't detect a part number — please enter it manually.");
        setInputMode("manual");
      }
    } catch {
      setScanError("Scan failed — please enter part number manually.");
      setInputMode("manual");
    } finally {
      setScanningPart(false);
      setUploadingPhoto(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: () =>
      base44.entities.MarketplaceItem.create({
        partNumber: partNumber.trim(),
        partName: partName.trim(),
        quantity: Number(quantity),
        repName: repName.trim() || user?.full_name || "",
        location: location.trim(),
        notes: notes.trim(),
        photoUrl,
        status: "available",
        bids: [],
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplaceItems"] });
      onOpenChange(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setPartNumber("");
    setPartName("");
    setQuantity(1);
    setRepName(user?.full_name || "");
    setLocation("");
    setNotes("");
    setPhotoUrl(null);
    setScanError(null);
    setInputMode("scan");
  };

  const canSubmit = partNumber.trim() && quantity >= 1;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>List an Item</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Photo / Scan */}
          <div className="space-y-2">
            <Label>Part Photo (used to scan part number)</Label>
            <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed border-slate-200 rounded-lg p-4 hover:border-indigo-300 transition-colors">
              {uploadingPhoto || scanningPart ? (
                <Loader2 className="w-4 h-4 animate-spin text-slate-400" />
              ) : (
                <Camera className="w-4 h-4 text-slate-400" />
              )}
              <span className="text-sm text-slate-500">
                {scanningPart ? "Reading part number..." : uploadingPhoto ? "Uploading..." : "Take or upload a photo"}
              </span>
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoCapture}
                disabled={uploadingPhoto || scanningPart}
              />
            </label>
            {photoUrl && (
              <div className="relative inline-block">
                <img src={photoUrl} alt="Part" className="h-24 rounded-lg object-cover border" />
                <button onClick={() => setPhotoUrl(null)} className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5">
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            )}
            {scanError && <p className="text-xs text-amber-600">{scanError}</p>}
          </div>

          {/* Input Mode Toggle */}
          <div className="flex gap-2">
            <button
              onClick={() => setInputMode("scan")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${inputMode === "scan" ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "bg-white border-slate-200 text-slate-600"}`}
            >
              <ScanLine className="w-3 h-3" /> Scanned
            </button>
            <button
              onClick={() => setInputMode("manual")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${inputMode === "manual" ? "bg-indigo-50 border-indigo-300 text-indigo-700" : "bg-white border-slate-200 text-slate-600"}`}
            >
              <Type className="w-3 h-3" /> Manual Entry
            </button>
          </div>

          {/* Part Number */}
          <div className="space-y-1.5">
            <Label>Part Number <span className="text-red-500">*</span></Label>
            <Input
              placeholder="e.g. REF-12345"
              value={partNumber}
              onChange={e => setPartNumber(e.target.value)}
            />
          </div>

          {/* Part Name */}
          <div className="space-y-1.5">
            <Label>Part Name / Description</Label>
            <Input
              placeholder="e.g. Tibial Tray, Size 3"
              value={partName}
              onChange={e => setPartName(e.target.value)}
            />
          </div>

          {/* Quantity */}
          <div className="space-y-1.5">
            <Label>Quantity <span className="text-red-500">*</span></Label>
            <Input
              type="number"
              min={1}
              value={quantity}
              onChange={e => setQuantity(e.target.value)}
            />
          </div>

          {/* Rep Name */}
          <div className="space-y-1.5">
            <Label>Your Name (optional)</Label>
            <Input
              placeholder="Rep name"
              value={repName}
              onChange={e => setRepName(e.target.value)}
            />
          </div>

          {/* Location */}
          <div className="space-y-1.5">
            <Label>Location / Territory (optional)</Label>
            <Input
              placeholder="e.g. Detroit, MI"
              value={location}
              onChange={e => setLocation(e.target.value)}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea
              placeholder="Condition, expiration date, etc."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
            />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            className="flex-1 bg-indigo-600 hover:bg-indigo-700"
            disabled={!canSubmit || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "List Item"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}