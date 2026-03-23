import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Plus, ShoppingBag, Telescope } from "lucide-react";
import AddItemDialog from "@/components/marketplace/AddItemDialog";
import MarketplaceItemCard from "@/components/marketplace/MarketplaceItemCard";
import LookForDialog from "@/components/marketplace/LookForDialog";
import LookForSection from "@/components/marketplace/LookForSection";

export default function Marketplace() {
  const [search, setSearch] = useState("");
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [showLookForDialog, setShowLookForDialog] = useState(false);

  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
  });

  const { data: items = [], isLoading } = useQuery({
    queryKey: ["marketplaceItems"],
    queryFn: () => base44.entities.MarketplaceItem.list("-created_date"),
  });

  const { data: lookForItems = [] } = useQuery({
    queryKey: ["lookForItems"],
    queryFn: () => base44.entities.LookForItem.list("-created_date"),
  });

  const { data: missingParts = [] } = useQuery({
    queryKey: ["missingParts"],
    queryFn: () => base44.entities.MissingPart.list(),
  });

  const filtered = items.filter(item => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (item.partNumber || "").toLowerCase().includes(q) ||
      (item.partName || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 pb-24">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="p-2 rounded-lg bg-indigo-100">
                <ShoppingBag className="w-5 h-5 text-indigo-600" />
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                Marketplace
              </h1>
            </div>
            <p className="text-slate-500 ml-12">
              Loose inventory available across the territory
            </p>
          </div>
          <div className="flex gap-2 shrink-0">
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => setShowLookForDialog(true)}
            >
              <Telescope className="w-4 h-4" />
              <span className="hidden sm:inline">Look For</span>
            </Button>
            <Button
              className="bg-indigo-600 hover:bg-indigo-700 gap-2"
              onClick={() => setShowAddDialog(true)}
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">List Item</span>
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <Input
            placeholder="Search by part name or number..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-9 bg-white"
          />
        </div>

        {/* Look For Section */}
        <div data-tour="marketplace-looking-for">
        <LookForSection
          lookForItems={lookForItems}
          marketplaceItems={items}
          missingParts={missingParts}
          user={user}
        />
        </div>

        {/* Stats */}
        {!isLoading && items.length > 0 && (
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-sm">
              <span className="text-slate-500">Total Listings:</span>
              <span className="font-semibold text-slate-900">{items.length}</span>
            </div>
            <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-slate-200 rounded-full text-sm">
              <span className="text-slate-500">Available:</span>
              <span className="font-semibold text-green-700">{items.filter(i => i.status === "available" || !i.status).length}</span>
            </div>
          </div>
        )}

        {/* Grid */}
        {isLoading ? (
          <div data-tour="marketplace-list" className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16">
            <div className="w-14 h-14 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
              <ShoppingBag className="w-7 h-7 text-slate-400" />
            </div>
            <p className="text-slate-600 font-medium">
              {search ? "No items match your search" : "No items listed yet"}
            </p>
            <p className="text-sm text-slate-500 mt-1">
              {search ? "Try a different search term" : "Be the first to list loose inventory"}
            </p>
            {!search && (
              <Button
                className="mt-4 bg-indigo-600 hover:bg-indigo-700"
                onClick={() => setShowAddDialog(true)}
              >
                <Plus className="w-4 h-4 mr-2" /> List an Item
              </Button>
            )}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map(item => (
              <MarketplaceItemCard
                key={item.id}
                item={item}
                user={user}
                isOwner={item.created_by === user?.email}
              />
            ))}
          </div>
        )}
      </div>

      <AddItemDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        user={user}
      />
      <LookForDialog
        open={showLookForDialog}
        onOpenChange={setShowLookForDialog}
        user={user}
      />
    </div>
  );
}