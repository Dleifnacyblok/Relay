import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { HandshakeIcon, MapPin, User, Package, Pencil, Check, X, Trash2, Loader2, Camera, Plus } from "lucide-react";
import BidDialog from "./BidDialog";

const statusColors = {
  available: "bg-green-100 text-green-800",
  pending: "bg-yellow-100 text-yellow-800",
  sold: "bg-slate-100 text-slate-600",
};

export default function MarketplaceItemCard({ item, user, isOwner }) {
  const [showBidDialog, setShowBidDialog] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editData, setEditData] = useState({});
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const queryClient = useQueryClient();

  const updateMutation = useMutation({
    mutationFn: (data) => base44.entities.MarketplaceItem.update(item.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["marketplaceItems"] });
      setEditing(false);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => base44.entities.MarketplaceItem.delete(item.id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["marketplaceItems"] }),
  });

  const startEdit = () => {
    setEditData({
      partNumber: item.partNumber,
      partName: item.partName || "",
      quantity: item.quantity,
      location: item.location || "",
      notes: item.notes || "",
      photoUrl: item.photoUrl || "",
    });
    setEditing(true);
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingPhoto(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setEditData(d => ({ ...d, photoUrl: file_url }));
    setUploadingPhoto(false);
  };

  const hasBid = (item.bids || []).some(b => b.bidderEmail === user?.email);

  return (
    <>
      <Card className="p-5 flex flex-col gap-3">
        {/* Header */}
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            {editing ? (
              <div className="space-y-2">
                <Input
                  value={editData.partName}
                  onChange={e => setEditData(d => ({ ...d, partName: e.target.value }))}
                  placeholder="Part name"
                  className="text-sm h-8"
                />
                <Input
                  value={editData.partNumber}
                  onChange={e => setEditData(d => ({ ...d, partNumber: e.target.value }))}
                  placeholder="Part number"
                  className="text-xs h-7 text-slate-500"
                />
              </div>
            ) : (
              <>
                <p className="font-semibold text-slate-900 truncate">
                  {item.partName || item.partNumber}
                </p>
                {item.partName && (
                  <p className="text-xs text-slate-500">Part #: {item.partNumber}</p>
                )}
              </>
            )}
          </div>
          <Badge className={statusColors[item.status] || statusColors.available}>
            {item.status || "available"}
          </Badge>
        </div>

        {/* Photo */}
        {item.photoUrl && !editing && (
          <img src={item.photoUrl} alt="Part" className="w-full h-32 object-cover rounded-lg border border-slate-100" />
        )}

        {/* Details */}
        <div className="flex flex-wrap gap-3 text-sm text-slate-600">
          {editing ? (
            <div className="w-full space-y-2">
              <div className="flex items-center gap-2">
                <Label className="w-20 text-xs shrink-0">Qty</Label>
                <Input
                  type="number"
                  min={1}
                  value={editData.quantity}
                  onChange={e => setEditData(d => ({ ...d, quantity: e.target.value }))}
                  className="h-7 text-sm"
                />
              </div>
              <div className="flex items-center gap-2">
                <Label className="w-20 text-xs shrink-0">Location</Label>
                <Input
                  value={editData.location}
                  onChange={e => setEditData(d => ({ ...d, location: e.target.value }))}
                  placeholder="Territory"
                  className="h-7 text-sm"
                />
              </div>
              <Textarea
                value={editData.notes}
                onChange={e => setEditData(d => ({ ...d, notes: e.target.value }))}
                placeholder="Notes"
                rows={2}
                className="text-sm"
              />
            </div>
          ) : (
            <>
              <span className="flex items-center gap-1">
                <Package className="w-3.5 h-3.5 text-slate-400" />
                Qty: {item.quantity}
              </span>
              {item.repName && (
                <span className="flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-400" />
                  {item.repName}
                </span>
              )}
              {item.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-slate-400" />
                  {item.location}
                </span>
              )}
            </>
          )}
        </div>

        {!editing && item.notes && (
          <p className="text-xs text-slate-500 border-t border-slate-100 pt-2">{item.notes}</p>
        )}

        {/* Bids count */}
        {!editing && (item.bids || []).length > 0 && (
          <p className="text-xs text-indigo-600 font-medium">
            {item.bids.length} request{item.bids.length !== 1 ? "s" : ""} received
          </p>
        )}

        {/* Actions */}
        {isOwner ? (
          editing ? (
            <div className="flex gap-2 pt-1">
              <Button
                size="sm"
                className="flex-1 bg-green-600 hover:bg-green-700 h-8"
                disabled={updateMutation.isPending}
                onClick={() => updateMutation.mutate(editData)}
              >
                {updateMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Check className="w-3.5 h-3.5" /> Save</>}
              </Button>
              <Button size="sm" variant="outline" className="h-8" onClick={() => setEditing(false)}>
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          ) : (
            <div className="flex gap-2 pt-1">
              <Button size="sm" variant="outline" className="flex-1 h-8" onClick={startEdit}>
                <Pencil className="w-3.5 h-3.5 mr-1" /> Edit
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-red-600 hover:bg-red-50 border-red-200"
                disabled={deleteMutation.isPending}
                onClick={() => deleteMutation.mutate()}
              >
                {deleteMutation.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
              </Button>
            </div>
          )
        ) : (
          <Button
            size="sm"
            className={`w-full h-8 ${hasBid ? "bg-slate-100 text-slate-500 hover:bg-slate-100" : "bg-indigo-600 hover:bg-indigo-700"}`}
            disabled={hasBid || item.status === "sold"}
            onClick={() => setShowBidDialog(true)}
          >
            <HandshakeIcon className="w-3.5 h-3.5 mr-1.5" />
            {hasBid ? "Request Sent" : item.status === "sold" ? "Sold" : "Request Item"}
          </Button>
        )}
      </Card>

      <BidDialog
        open={showBidDialog}
        onOpenChange={setShowBidDialog}
        item={item}
        user={user}
      />
    </>
  );
}