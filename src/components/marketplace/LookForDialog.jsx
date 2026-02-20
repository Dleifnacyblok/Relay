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
import { Camera, Loader2, X, Sparkles, Check, Pencil } from "lucide-react";

export default function LookForDialog({ open, onOpenChange, user }) {
  const [partNumber, setPartNumber] = useState("");
  const [partName, setPartName] = useState("");
  const [notes, setNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [aiSuggestion, setAiSuggestion] = useState(null);
  const [suggestionAccepted, setSuggestionAccepted] = useState(false);
  const [editingName, setEditingName] = useState(false);

  const queryClient = useQueryClient();

  const confidenceColor = (score) => {
    if (score >= 80) return { bar: "bg-green-500", text: "text-green-700", label: "High confidence" };
    if (score >= 50) return { bar: "bg-yellow-400", text: "text-yellow-700", label: "Medium confidence" };
    return { bar: "bg-red-400", text: "text-red-700", label: "Low confidence" };
  };

  const handlePhotoCapture = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setScanning(true);
    setScanError(null);
    setAiSuggestion(null);
    setSuggestionAccepted(false);

    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setPhotoUrl(file_url);

    try {
      const res = await base44.functions.invoke("identifyPartNumber", { imageUrl: file_url });
      const data = res.data;

      if (data?.partNumber) setPartNumber(data.partNumber);
      if (data?.partName) {
        setAiSuggestion({ partName: data.partName, confidence: data.confidence ?? 0, reasoning: data.reasoning || "" });
        setPartName(data.partName);
      }
      if (!data?.partNumber && !data?.partName) {
        setScanError("Couldn't detect part info — please enter manually.");
      }
    } catch {
      setScanError("Scan failed — please enter details manually.");
    } finally {
      setScanning(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: () =>
      base44.entities.LookForItem.create({
        partNumber: partNumber.trim(),
        partName: partName.trim(),
        repName: user?.full_name || "",
        notes: notes.trim(),
        photoUrl,
        status: "active",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["lookForItems"] });
      onOpenChange(false);
      resetForm();
    },
  });

  const resetForm = () => {
    setPartNumber("");
    setPartName("");
    setNotes("");
    setPhotoUrl(null);
    setScanError(null);
    setAiSuggestion(null);
    setSuggestionAccepted(false);
    setEditingName(false);
    setScanning(false);
  };

  const canSubmit = partNumber.trim() && !scanning;

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Looking For a Part</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-slate-500 -mt-2">
          Add a part you're looking for. You'll be notified if someone lists it or if it matches a missing part.
        </p>

        <div className="space-y-5">
          {/* Photo */}
          <div className="space-y-2">
            <Label>Part Photo (optional)</Label>
            <label className={`flex items-center gap-3 cursor-pointer border-2 border-dashed rounded-lg p-4 transition-colors ${scanning ? "border-indigo-300 bg-indigo-50" : "border-slate-200 hover:border-indigo-300"}`}>
              {scanning ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin text-indigo-500 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-indigo-700">Analyzing part...</p>
                    <p className="text-xs text-indigo-500">AI is reading part number & identifying the component</p>
                  </div>
                </>
              ) : (
                <>
                  <Camera className="w-5 h-5 text-slate-400 shrink-0" />
                  <div>
                    <p className="text-sm text-slate-600 font-medium">Take or upload a photo</p>
                    <p className="text-xs text-slate-400">AI will detect the part number and suggest a name</p>
                  </div>
                </>
              )}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoCapture} disabled={scanning} />
            </label>
            {photoUrl && (
              <div className="relative inline-block">
                <img src={photoUrl} alt="Part" className="h-28 rounded-lg object-cover border border-slate-200" />
                <button onClick={() => { setPhotoUrl(null); setAiSuggestion(null); setSuggestionAccepted(false); }}
                  className="absolute top-1 right-1 bg-black/60 rounded-full p-0.5">
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            )}
            {scanError && <p className="text-xs text-amber-600">{scanError}</p>}
          </div>

          {/* Part Number */}
          <div className="space-y-1.5">
            <Label>Part Number <span className="text-red-500">*</span></Label>
            <Input placeholder="e.g. REF-12345" value={partNumber} onChange={e => setPartNumber(e.target.value)} />
          </div>

          {/* Part Name with AI Suggestion */}
          <div className="space-y-1.5">
            <Label>Part Name / Description (optional)</Label>

            {aiSuggestion && !suggestionAccepted && !editingName && (
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-indigo-700 mb-0.5">AI Suggestion</p>
                    <p className="text-sm font-medium text-slate-800 truncate">{aiSuggestion.partName}</p>
                    <div className="mt-1.5 space-y-0.5">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-medium ${confidenceColor(aiSuggestion.confidence).text}`}>
                          {confidenceColor(aiSuggestion.confidence).label}
                        </span>
                        <span className={`text-xs font-bold ${confidenceColor(aiSuggestion.confidence).text}`}>
                          {aiSuggestion.confidence}%
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-1.5">
                        <div className={`h-1.5 rounded-full transition-all ${confidenceColor(aiSuggestion.confidence).bar}`}
                          style={{ width: `${aiSuggestion.confidence}%` }} />
                      </div>
                    </div>
                    {aiSuggestion.reasoning && <p className="text-xs text-slate-500 mt-1.5 italic">{aiSuggestion.reasoning}</p>}
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="flex-1 h-7 bg-indigo-600 hover:bg-indigo-700 text-xs gap-1"
                    onClick={() => { setPartName(aiSuggestion.partName); setSuggestionAccepted(true); setEditingName(false); }}>
                    <Check className="w-3 h-3" /> Accept
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1" onClick={() => setEditingName(true)}>
                    <Pencil className="w-3 h-3" /> Edit
                  </Button>
                </div>
              </div>
            )}

            {suggestionAccepted && !editingName && (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                <Check className="w-4 h-4 text-green-600 shrink-0" />
                <span className="text-sm text-green-800 flex-1 truncate">{partName}</span>
                <button onClick={() => { setSuggestionAccepted(false); setEditingName(true); }} className="text-xs text-slate-500 hover:text-slate-700 underline shrink-0">Change</button>
              </div>
            )}

            {(!aiSuggestion || editingName) && (
              <Input placeholder="e.g. Tibial Tray, Size 3" value={partName} onChange={e => setPartName(e.target.value)} autoFocus={editingName} />
            )}
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label>Notes (optional)</Label>
            <Textarea placeholder="Any details about what you need..." value={notes} onChange={e => setNotes(e.target.value)} rows={2} />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <Button variant="outline" className="flex-1" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button
            className="flex-1 bg-indigo-600 hover:bg-indigo-700"
            disabled={!canSubmit || createMutation.isPending}
            onClick={() => createMutation.mutate()}
          >
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add to Look For"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}