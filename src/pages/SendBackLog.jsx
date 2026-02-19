import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Package, Clock, Image as ImageIcon, Share2, Check, ArrowRightLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { format, parseISO } from "date-fns";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function SendBackLog() {
  const [selectedPhotos, setSelectedPhotos] = useState([]);
  const [showPhotosDialog, setShowPhotosDialog] = useState(false);
  const [copiedLogId, setCopiedLogId] = useState(null);

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
  });

  const { data: logs = [], isLoading: logsLoading } = useQuery({
    queryKey: ["sendBackLogs", user?.full_name],
    queryFn: () => base44.entities.SendBackLog.filter({ repName: user?.full_name }),
    enabled: !!user?.full_name,
  });

  const { data: allLoaners = [] } = useQuery({
    queryKey: ["loaners"],
    queryFn: () => base44.entities.Loaners.list(),
  });

  const { data: allParts = [] } = useQuery({
    queryKey: ["missingParts"],
    queryFn: () => base44.entities.MissingPart.list(),
  });

  const isLoading = userLoading || logsLoading;

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      return format(parseISO(dateStr), "MMM d, yyyy");
    } catch {
      return dateStr;
    }
  };

  const getLoanerInfo = (loanerId) => {
    const loaner = allLoaners.find(l => l.id === loanerId);
    if (!loaner) return { name: "Unknown Loaner", etchId: null };
    return {
      name: loaner.setName,
      etchId: loaner.etchId
    };
  };

  const getPartInfo = (partId) => {
    const part = allParts.find(p => p.id === partId);
    if (!part) return { name: "Unknown Part", quantity: 1 };
    return {
      name: part.partName,
      quantity: part.missingQuantity || 1
    };
  };

  const sortedLogs = [...logs].sort((a, b) => 
    new Date(b.sentDate) - new Date(a.sentDate)
  );

  const handleViewPhotos = (photoUrls) => {
    setSelectedPhotos(photoUrls);
    setShowPhotosDialog(true);
  };

  const handleShare = async (log) => {
    let accountName = "";
    if (log.loanerIds && log.loanerIds.length > 0) {
      const firstLoaner = allLoaners.find(l => l.id === log.loanerIds[0]);
      if (firstLoaner) accountName = firstLoaner.accountName;
    }

    const lines = [];

    if (log.loanerIds && log.loanerIds.length > 0) {
      lines.push(`Rep Name: ${log.repName}`);
      lines.push(`Account: ${accountName || "N/A"}`);
      lines.push(`Date: ${formatDate(log.sentDate)}`);
      lines.push(`Tracking Number: ${log.trackingNumber}`);
      lines.push("");
      lines.push("Loaners:");
      log.loanerIds.forEach(loanerId => {
        const info = getLoanerInfo(loanerId);
        lines.push(`- ${info.name} (Etch ID: ${info.etchId || "N/A"})`);
      });
    } else if (log.missingPartIds && log.missingPartIds.length > 0) {
      lines.push(`Rep Name: ${log.repName}`);
      lines.push(`Date: ${formatDate(log.sentDate)}`);
      lines.push(`Tracking Number: ${log.trackingNumber}`);
      lines.push("");
      lines.push("Missing Parts:");
      log.missingPartIds.forEach(partId => {
        const part = allParts.find(p => p.id === partId);
        if (part) {
          lines.push(`- Part: ${part.partName}`);
          lines.push(`  Part Number: ${part.partNumber || "N/A"}`);
          lines.push(`  Qty: ${part.missingQuantity || 1}`);
          lines.push(`  From Loaner Set: ${part.loanerSetName || "N/A"}`);
        }
      });
    }

    if (log.notes) {
      lines.push("");
      lines.push(`Notes: ${log.notes}`);
    }

    const text = lines.join("\n");

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      // Fallback for mobile browsers
      const el = document.createElement("textarea");
      el.value = text;
      el.style.position = "fixed";
      el.style.opacity = "0";
      document.body.appendChild(el);
      el.focus();
      el.select();
      document.execCommand("copy");
      document.body.removeChild(el);
    }

    setCopiedLogId(log.id);
    setTimeout(() => setCopiedLogId(null), 3000);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-green-100">
              <Clock className="w-5 h-5 text-green-600" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              Track Log
            </h1>
          </div>
          <p className="text-slate-500 ml-12">
            History of items you've sent back with tracking information
          </p>
        </div>

        {/* Stats */}
        {!isLoading && sortedLogs.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-sm">
              <span className="text-slate-500">Total Shipments:</span>
              <span className="font-semibold text-slate-900">{sortedLogs.length}</span>
            </div>
          </div>
        )}

        {/* Log List */}
        <div className="space-y-4">
          {isLoading ? (
            <div className="space-y-4">
              {[1, 2, 3].map(i => (
                <Skeleton key={i} className="h-32 rounded-lg" />
              ))}
            </div>
          ) : sortedLogs.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                <Package className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-slate-600 font-medium">No tracking records</p>
              <p className="text-sm text-slate-500 mt-1">
                Items you send back will appear here with tracking information
              </p>
            </Card>
          ) : (
            sortedLogs.map((log) => (
              <Card key={log.id} className="p-6">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-semibold text-slate-900">
                        Tracking: {log.trackingNumber}
                      </h3>
                    </div>
                    <p className="text-sm text-slate-500">
                      Sent on {formatDate(log.sentDate)}
                    </p>
                  </div>
                  <Badge className="bg-green-100 text-green-800 border-green-200">
                    Sent Back
                  </Badge>
                </div>

                {/* Items */}
                <div className="space-y-3">
                  {log.loanerIds && log.loanerIds.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-slate-700 mb-2">
                        Loaners ({log.loanerIds.length})
                      </p>
                      <div className="bg-slate-50 rounded-lg p-3 space-y-1">
                        {log.loanerIds.map((loanerId, idx) => {
                          const loanerInfo = getLoanerInfo(loanerId);
                          return (
                            <div key={idx} className="text-sm text-slate-600">
                              • {loanerInfo.name} {loanerInfo.etchId && <span className="text-slate-500">(Etch: {loanerInfo.etchId})</span>}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {log.missingPartIds && log.missingPartIds.length > 0 && (
                    <div>
                      <p className="text-sm font-medium text-slate-700 mb-2">
                        Missing Parts ({log.missingPartIds.length})
                      </p>
                      <div className="bg-slate-50 rounded-lg p-3 space-y-1">
                        {log.missingPartIds.map((partId, idx) => {
                          const partInfo = getPartInfo(partId);
                          return (
                            <div key={idx} className="text-sm text-slate-600">
                              • {partInfo.name} <span className="text-slate-500">(Qty: {partInfo.quantity})</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>

                {/* Notes */}
                {log.notes && (
                  <div className="mt-4 pt-4 border-t border-slate-200">
                    <p className="text-sm font-medium text-slate-700 mb-1">Notes</p>
                    <p className="text-sm text-slate-600">{log.notes}</p>
                  </div>
                )}

                {/* Actions */}
                <div className="mt-4 flex gap-2">
                  {log.photoUrls && log.photoUrls.length > 0 && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewPhotos(log.photoUrls)}
                      className="gap-2"
                    >
                      <ImageIcon className="w-4 h-4" />
                      View Photos ({log.photoUrls.length})
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleShare(log)}
                    className={`gap-2 transition-colors ${copiedLogId === log.id ? "bg-green-50 border-green-300 text-green-700" : ""}`}
                  >
                    {copiedLogId === log.id ? (
                      <>
                        <Check className="w-4 h-4" />
                        Copied to Clipboard!
                      </>
                    ) : (
                      <>
                        <Share2 className="w-4 h-4" />
                        Share
                      </>
                    )}
                  </Button>
                </div>
              </Card>
            ))
          )}
        </div>

        {/* Photos Dialog */}
        <Dialog open={showPhotosDialog} onOpenChange={setShowPhotosDialog}>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Shipment Photos</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 mt-4">
              {selectedPhotos.map((url, idx) => (
                <div key={idx} className="bg-slate-50 rounded-lg overflow-hidden">
                  <img 
                    src={url} 
                    alt={`Shipment photo ${idx + 1}`}
                    className="w-full h-auto"
                  />
                </div>
              ))}
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}