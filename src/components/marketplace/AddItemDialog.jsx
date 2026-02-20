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
import { Camera, Loader2, X, Sparkles, Check, Pencil, CalendarIcon } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";

export default function AddItemDialog({ open, onOpenChange, user }) {
  const [partNumber, setPartNumber] = useState("");
  const [partName, setPartName] = useState("");
  const [quantity, setQuantity] = useState(1);
  const [repName, setRepName] = useState(user?.full_name || "");
  const [location, setLocation] = useState("");
  const [notes, setNotes] = useState("");
  const [photoUrl, setPhotoUrl] = useState(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState(null);
  const [lookingUpPartName, setLookingUpPartName] = useState(false);
  const [hasExpiration, setHasExpiration] = useState(null); // null | true | false
  const [expirationDate, setExpirationDate] = useState(null);

  // AI suggestion state
  const [aiSuggestion, setAiSuggestion] = useState(null); // { partName, confidence, reasoning }
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

      if (data?.partNumber) {
        setPartNumber(data.partNumber);
      }

      if (data?.partName) {
        setAiSuggestion({
          partName: data.partName,
          confidence: data.confidence ?? 0,
          reasoning: data.reasoning || "",
        });
        // Pre-fill but don't mark accepted yet — let user decide
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

  const acceptSuggestion = () => {
    setPartName(aiSuggestion.partName);
    setSuggestionAccepted(true);
    setEditingName(false);
  };

  const createMutation = useMutation({
    mutationFn: () =>
    base44.entities.MarketplaceItem.create({
      partNumber: partNumber.trim(),
      partName: partName.trim(),
      quantity: Number(quantity),
      repName: repName.trim() || user?.full_name || "",
      location: location.trim(),
      notes: notes.trim() + (expirationDate ? `\nExpires: ${format(expirationDate, "MMM d, yyyy")}` : ""),
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
    setAiSuggestion(null);
    setSuggestionAccepted(false);
    setEditingName(false);
    setScanning(false);
    setHasExpiration(null);
    setExpirationDate(null);
  };

  const canSubmit = partNumber.trim() && partName.trim() && quantity >= 1 && hasExpiration !== null && (hasExpiration === false || (hasExpiration === true && expirationDate));

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) resetForm(); }}>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>List an Item</DialogTitle>
        </DialogHeader>

        <div className="space-y-5">
          {/* Photo Capture */}
          <div className="space-y-2">
            <Label>Part Photo</Label>
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
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={handlePhotoCapture}
                disabled={scanning}
              />
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
            <Input
              placeholder="e.g. REF-12345"
              value={partNumber}
              onChange={e => setPartNumber(e.target.value)}
            />
          </div>

          {/* Part Name with AI Suggestion */}
          <div className="space-y-1.5">
            <Label>Part Name / Description <span className="text-red-500">*</span></Label>

            {/* AI Suggestion Card */}
            {aiSuggestion && !suggestionAccepted && !editingName && (
              <div className="rounded-lg border border-indigo-200 bg-indigo-50 p-3 space-y-2">
                <div className="flex items-start gap-2">
                  <Sparkles className="w-4 h-4 text-indigo-500 mt-0.5 shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-indigo-700 mb-0.5">AI Suggestion</p>
                    <p className="text-sm font-medium text-slate-800 truncate">{aiSuggestion.partName}</p>

                    {/* Confidence bar */}
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
                        <div
                          className={`h-1.5 rounded-full transition-all ${confidenceColor(aiSuggestion.confidence).bar}`}
                          style={{ width: `${aiSuggestion.confidence}%` }}
                        />
                      </div>
                    </div>

                    {aiSuggestion.reasoning && (
                      <p className="text-xs text-slate-500 mt-1.5 italic">{aiSuggestion.reasoning}</p>
                    )}
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  <Button size="sm" className="flex-1 h-7 bg-indigo-600 hover:bg-indigo-700 text-xs gap-1" onClick={acceptSuggestion}>
                    <Check className="w-3 h-3" /> Accept
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-xs gap-1" onClick={() => { setEditingName(true); }}>
                    <Pencil className="w-3 h-3" /> Edit
                  </Button>
                </div>
              </div>
            )}

            {/* Accepted state */}
            {suggestionAccepted && !editingName && (
              <div className="flex items-center gap-2 px-3 py-2 bg-green-50 border border-green-200 rounded-lg">
                <Check className="w-4 h-4 text-green-600 shrink-0" />
                <span className="text-sm text-green-800 flex-1 truncate">{partName}</span>
                <button onClick={() => { setSuggestionAccepted(false); setEditingName(true); }} className="text-xs text-slate-500 hover:text-slate-700 underline shrink-0">
                  Change
                </button>
              </div>
            )}

            {/* Manual input — shown when no suggestion, or editing */}
            {(!aiSuggestion || editingName) && (
              <Input
                placeholder="e.g. Tibial Tray, Size 3"
                value={partName}
                onChange={e => setPartName(e.target.value)}
                autoFocus={editingName}
              />
            )}
          </div>

          {/* Quantity */}
          <div className="space-y-1.5">
            <Label>Quantity <span className="text-red-500">*</span></Label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-1">
              {[...Array(25).keys()].map(i => {
                const val = i + 1;
                return (
                  <button
                    key={val}
                    type="button"
                    onClick={() => setQuantity(val)}
                    className={`w-10 h-10 rounded-lg border text-sm font-medium transition-colors shrink-0 ${quantity === val ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-200 text-slate-700 hover:border-indigo-300"}`}
                  >
                    {val}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setQuantity(26)}
                className={`px-3 h-10 rounded-lg border text-sm font-medium transition-colors shrink-0 ${quantity > 25 ? "bg-indigo-600 border-indigo-600 text-white" : "border-slate-200 text-slate-700 hover:border-indigo-300"}`}
              >
                25+
              </button>
            </div>
            {quantity > 25 && (
              <Input
                type="number"
                min={26}
                placeholder="Enter quantity"
                value={quantity}
                onChange={e => setQuantity(Number(e.target.value))}
                className="mt-2"
              />
            )}
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
              placeholder="Condition, etc."
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={2}
            />
          </div>

          {/* Expiration Date */}
          <div className="space-y-2">
            <Label>Does this item have an expiration date? <span className="text-red-500">*</span></Label>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => { setHasExpiration(true); }}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${hasExpiration === true ? "bg-indigo-50 border-indigo-400 text-indigo-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
              >
                Yes
              </button>
              <button
                type="button"
                onClick={() => { setHasExpiration(false); setExpirationDate(null); }}
                className={`flex-1 py-2 rounded-lg border text-sm font-medium transition-colors ${hasExpiration === false ? "bg-indigo-50 border-indigo-400 text-indigo-700" : "border-slate-200 text-slate-600 hover:border-slate-300"}`}
              >
                No
              </button>
            </div>

            {hasExpiration === true && (
              <div className="space-y-1.5">
                <Label>Expiration Date <span className="text-red-500">*</span></Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <button
                      type="button"
                      className={`w-full flex items-center gap-2 px-3 py-2 border rounded-md text-sm text-left transition-colors ${expirationDate ? "text-slate-900 border-slate-300" : "text-slate-400 border-slate-200"} hover:border-indigo-300`}
                    >
                      <CalendarIcon className="w-4 h-4 shrink-0 text-slate-400" />
                      {expirationDate ? format(expirationDate, "MMM d, yyyy") : "Select expiration date"}
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={expirationDate}
                      onSelect={setExpirationDate}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            )}
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