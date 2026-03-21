import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { AlertCircle, Package, Send, Edit2, Trash2, Download, Search, X } from "lucide-react";
import ExportMissingPartsPDF from "@/components/missingparts/ExportMissingPartsPDF";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import SendBackDialog from "@/components/sendback/SendBackDialog";
import { formatCurrency } from "@/components/loaners/loanerUtils";
import { format, parseISO } from "date-fns";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export default function MyMissingParts() {
  const [selectedIds, setSelectedIds] = useState([]);
  const [showSendBack, setShowSendBack] = useState(false);
  const [editingPart, setEditingPart] = useState(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [partToDelete, setPartToDelete] = useState(null);
  const [showExportPDF, setShowExportPDF] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const queryClient = useQueryClient();

  const { data: user, isLoading: userLoading } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
  });

  const { data: missingParts = [], isLoading: partsLoading } = useQuery({
    queryKey: ["missingParts"],
    queryFn: () => base44.entities.MissingPart.list(),
  });

  const isLoading = userLoading || partsLoading;
  const userName = user?.full_name || "";

  const myParts = useMemo(() => {
    const parts = missingParts.filter(p =>
      p.repName?.toLowerCase() === userName.toLowerCase() &&
      p.returnStatus !== "sent_back" && p.returnStatus !== "received"
    );
    // Sort: missing first, then found, then paid
    return [...parts].sort((a, b) => {
      const order = { missing: 0, found: 1, paid: 2 };
      return (order[a.status] ?? 0) - (order[b.status] ?? 0);
    });
  }, [missingParts, userName]);

  const filteredParts = useMemo(() => {
    if (!searchQuery.trim()) return myParts;
    const q = searchQuery.toLowerCase();
    return myParts.filter(p =>
      p.partName?.toLowerCase().includes(q) ||
      p.partNumber?.toLowerCase().includes(q) ||
      p.loanerSetName?.toLowerCase().includes(q) ||
      p.etchId?.toLowerCase().includes(q)
    );
  }, [myParts, searchQuery]);

  const selectedParts = filteredParts.filter(p => selectedIds.includes(p.id));

  const handleSelectAll = () => {
    if (selectedIds.length === filteredParts.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredParts.map(p => p.id));
    }
  };

  const handleSelectOne = (id) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const activeParts = myParts.filter(p => p.status === "missing");
  const totalFines = activeParts.reduce((sum, p) => sum + (p.fineAmount || 0), 0);

  const formatDate = (dateStr) => {
    if (!dateStr) return "—";
    try {
      return format(parseISO(dateStr), "MMM d, yyyy");
    } catch {
      return dateStr;
    }
  };

  const statusColors = {
    missing: "bg-red-100 text-red-800 border-red-200",
    found: "bg-green-100 text-green-800 border-green-200",
    paid: "bg-blue-100 text-blue-800 border-blue-200"
  };

  const updatePartMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.MissingPart.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries(["missingParts"]);
      setShowEditDialog(false);
      setEditingPart(null);
    },
  });

  const deletePartMutation = useMutation({
    mutationFn: (id) => base44.entities.MissingPart.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries(["missingParts"]);
      setShowDeleteDialog(false);
      setPartToDelete(null);
    },
  });

  const handleEdit = (part) => {
    setEditingPart({ ...part });
    setShowEditDialog(true);
  };

  const handleDelete = (part) => {
    setPartToDelete(part);
    setShowDeleteDialog(true);
  };

  const handleSaveEdit = () => {
    if (!editingPart) return;
    updatePartMutation.mutate({
      id: editingPart.id,
      data: {
        partName: editingPart.partName,
        partNumber: editingPart.partNumber,
        missingQuantity: editingPart.missingQuantity,
        fineAmount: editingPart.fineAmount,
        status: editingPart.status,
      },
    });
  };

  const confirmDelete = () => {
    if (!partToDelete) return;
    deletePartMutation.mutate(partToDelete.id);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      {/* Sticky search bar */}
      <div className="sticky top-0 z-30 bg-white border-b border-slate-200 px-4 py-3">
        <div className="max-w-7xl mx-auto relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
          <Input
            placeholder="Search parts..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 pr-10 h-11 text-base bg-white"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute right-0 top-0 h-11 w-11 flex items-center justify-center text-slate-400 hover:text-slate-600">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        {/* Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-1">
            <div className="p-2 rounded-lg bg-orange-100">
              <AlertCircle className="w-5 h-5 text-orange-600" />
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              My Missing Parts
            </h1>
          </div>
          <p className="text-slate-500 ml-12">
            {userName ? `Missing parts assigned to you` : "Loading..."}
          </p>
        </div>
        {!isLoading && myParts.length > 0 && (
          <div className="flex justify-end mb-2">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => setShowExportPDF(true)}>
              <Download className="w-4 h-4" />
              Export PDF
            </Button>
          </div>
        )}

        {/* Quick Stats */}
        {!isLoading && myParts.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-sm">
              <span className="text-slate-500">Total:</span>
              <span className="font-semibold text-slate-900">{myParts.length}</span>
            </div>
            {activeParts.length > 0 && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-full text-sm">
                <span className="w-2 h-2 rounded-full bg-red-500" />
                <span className="font-semibold text-red-700">{activeParts.length} Missing</span>
              </div>
            )}
            {totalFines > 0 && (
              <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-red-50 border border-red-200 rounded-full text-sm">
                <span className="text-slate-500">Total Fines:</span>
                <span className="font-bold text-red-700">{formatCurrency(totalFines)}</span>
              </div>
            )}
          </div>
        )}

        {/* Actions Bar */}
        {!isLoading && filteredParts.length > 0 && (
          <div className="bg-white rounded-lg border border-slate-200 p-4 mb-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Checkbox
                checked={selectedIds.length > 0 && selectedIds.length === filteredParts.length}
                onCheckedChange={handleSelectAll}
              />
              <span className="text-sm text-slate-600">
                {selectedIds.length > 0 
                  ? `${selectedIds.length} selected`
                  : "Select all"
                }
              </span>
            </div>
            <Button
              disabled={selectedIds.length === 0}
              onClick={() => setShowSendBack(true)}
              className="gap-2"
            >
              <Send className="w-4 h-4" />
              Send Back
            </Button>
          </div>
        )}

        {/* Table */}
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-6 space-y-4">
              {[1, 2, 3, 4].map(i => (
                <Skeleton key={i} className="h-16 rounded-lg" />
              ))}
            </div>
          ) : filteredParts.length === 0 ? (
            <div className="p-12 text-center">
              <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
                <Package className="w-6 h-6 text-slate-400" />
              </div>
              <p className="text-slate-600 font-medium">No missing parts</p>
              <p className="text-sm text-slate-500 mt-1">
                You have no missing parts recorded in the system
              </p>
            </div>
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden divide-y divide-slate-100">
                {filteredParts.map((part) => (
                  <div
                    key={part.id}
                    className="px-4 py-4 min-h-14"
                  >
                    <div className="flex items-start gap-3 mb-3">
                      <Checkbox
                        checked={selectedIds.includes(part.id)}
                        onCheckedChange={() => handleSelectOne(part.id)}
                      />
                      <div className="flex-1 min-w-0">
                        <h3 className="font-bold text-gray-900">{part.partName}</h3>
                        {part.partNumber && (
                          <p className="text-xs text-gray-500 mt-0.5">
                            Part #: {part.partNumber}
                          </p>
                        )}
                      </div>
                      <Badge className={statusColors[part.status] || statusColors.missing}>
                        {part.status}
                      </Badge>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      {part.loanerSetName && (
                        <div>
                          <span className="text-gray-500">Loaner:</span>
                          <p className="font-medium text-gray-900 truncate">{part.loanerSetName}</p>
                        </div>
                      )}
                      {part.etchId && (
                        <div>
                          <span className="text-gray-500">Etch ID:</span>
                          <p className="font-medium text-gray-900">{part.etchId}</p>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-500">Date:</span>
                        <p className="font-medium text-gray-900">{formatDate(part.missingDate)}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Quantity:</span>
                        <p className="font-medium text-gray-900">{part.missingQuantity || 1}</p>
                      </div>
                      <div>
                        <span className="text-gray-500">Charge:</span>
                        <p className="font-semibold text-red-600">
                          {part.fineAmount > 0 ? formatCurrency(part.fineAmount) : '$0'}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Desktop Table View */}
              <div className="hidden md:block">
                <Table>
                  <TableHeader>
                    <TableRow className="border-gray-200 hover:bg-transparent">
                      <TableHead className="w-12"></TableHead>
                      <TableHead className="font-semibold text-gray-600">Part Name</TableHead>
                      <TableHead className="font-semibold text-gray-600">Part Number</TableHead>
                      <TableHead className="font-semibold text-gray-600">Loaner</TableHead>
                      <TableHead className="font-semibold text-gray-600">Etch ID</TableHead>
                      <TableHead className="font-semibold text-gray-600">Date Missing</TableHead>
                      <TableHead className="font-semibold text-gray-600">Quantity</TableHead>
                      <TableHead className="font-semibold text-gray-600">Status</TableHead>
                      <TableHead className="font-semibold text-gray-600 text-right">Charge</TableHead>
                      <TableHead className="font-semibold text-gray-600 text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredParts.map((part) => (
                      <TableRow 
                        key={part.id} 
                        className="border-gray-200 hover:bg-gray-50 transition-colors"
                      >
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.includes(part.id)}
                            onCheckedChange={() => handleSelectOne(part.id)}
                          />
                        </TableCell>
                        <TableCell className="font-medium text-gray-900">{part.partName}</TableCell>
                        <TableCell className="text-gray-600">{part.partNumber || "—"}</TableCell>
                        <TableCell className="text-gray-900">{part.loanerSetName || "—"}</TableCell>
                        <TableCell className="text-gray-600">{part.etchId || "—"}</TableCell>
                        <TableCell className="text-gray-900">{formatDate(part.missingDate)}</TableCell>
                        <TableCell className="text-gray-900">{part.missingQuantity || 1}</TableCell>
                        <TableCell>
                          <Badge className={statusColors[part.status] || statusColors.missing}>
                            {part.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          {part.fineAmount > 0 ? (
                            <span className="font-semibold text-red-600">
                              {formatCurrency(part.fineAmount)}
                            </span>
                          ) : (
                            <span className="text-gray-400">—</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(part)}
                            >
                              <Edit2 className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(part)}
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </>
          )}
        </div>
      </div>

      <ExportMissingPartsPDF
        open={showExportPDF}
        onClose={() => setShowExportPDF(false)}
        parts={myParts}
        userName={userName}
      />

      <SendBackDialog
        open={showSendBack}
        onOpenChange={setShowSendBack}
        selectedLoaners={[]}
        selectedParts={selectedParts}
        userName={userName}
        onSuccess={() => setSelectedIds([])}
      />

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Missing Part</DialogTitle>
            <DialogDescription>Update the details of this missing part</DialogDescription>
          </DialogHeader>
          {editingPart && (
            <div className="space-y-4 py-4">
              <div>
                <Label>Part Name</Label>
                <Input
                  className="text-base"
                  value={editingPart.partName}
                  onChange={(e) => setEditingPart({ ...editingPart, partName: e.target.value })}
                />
              </div>
              <div>
                <Label>Part Number</Label>
                <Input
                  className="text-base"
                  value={editingPart.partNumber || ""}
                  onChange={(e) => setEditingPart({ ...editingPart, partNumber: e.target.value })}
                />
              </div>
              <div>
                <Label>Quantity</Label>
                <Input
                  type="number"
                  className="text-base"
                  value={editingPart.missingQuantity || 1}
                  onChange={(e) => setEditingPart({ ...editingPart, missingQuantity: parseInt(e.target.value) || 1 })}
                />
              </div>
              <div>
                <Label>Fine Amount ($)</Label>
                <Input
                  type="number"
                  className="text-base"
                  value={editingPart.fineAmount || 0}
                  onChange={(e) => setEditingPart({ ...editingPart, fineAmount: parseFloat(e.target.value) || 0 })}
                />
              </div>
              <div>
                <Label>Status</Label>
                <select
                  value={editingPart.status}
                  onChange={(e) => setEditingPart({ ...editingPart, status: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-200 rounded-lg"
                >
                  <option value="missing">Missing</option>
                  <option value="found">Found</option>
                  <option value="paid">Paid</option>
                </select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit} disabled={updatePartMutation.isPending}>
              {updatePartMutation.isPending ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Missing Part?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{partToDelete?.partName}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-red-600 hover:bg-red-700"
              disabled={deletePartMutation.isPending}
            >
              {deletePartMutation.isPending ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}