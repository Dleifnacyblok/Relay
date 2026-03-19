import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";
import {
  AlertTriangle,
  Search,
  ShoppingBag,
  User,
  Upload,
  Package,
  FileText,
  ChevronRight,
  X,
  CalendarDays,
  TrendingUp,
  Download,
} from "lucide-react";
import { computeLoanerData, formatCurrency } from "@/components/loaners/loanerUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { useState } from "react";
import NotificationCenter from "@/components/notifications/NotificationCenter";
import ESCExportDialog from "@/components/dashboard/ESCExportDialog";

const NavCard = ({ icon: Icon, title, description, page, badge, badgeColor }) => (
  <Link
    to={createPageUrl(page)}
    className="flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:border-blue-100 transition-all group"
  >
    <div className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${badgeColor ? badgeColor.bg : "bg-gray-50"}`}>
      <Icon className={`w-5 h-5 ${badgeColor ? badgeColor.icon : "text-gray-500"}`} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <p className="text-sm font-semibold text-gray-900">{title}</p>
        {badge != null && (
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${badgeColor ? badgeColor.badge : "bg-gray-100 text-gray-600"}`}>
            {badge}
          </span>
        )}
      </div>
      <p className="text-xs text-gray-400 mt-0.5 truncate">{description}</p>
    </div>
    <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-blue-400 transition-colors shrink-0" />
  </Link>
);

export default function Dashboard() {
  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
  });

  const { data: loaners = [], isLoading } = useQuery({
    queryKey: ["loaners"],
    queryFn: () => base44.entities.Loaners.list(),
  });

  const { data: missingParts = [] } = useQuery({
    queryKey: ["missingParts"],
    queryFn: () => base44.entities.MissingPart.list(),
  });

  const { data: marketplaceItems = [] } = useQuery({
    queryKey: ["marketplaceItems"],
    queryFn: () => base44.entities.MarketplaceItem.filter({ status: "available" }),
  });

  const navigate = useNavigate();
  const [escExportOpen, setEscExportOpen] = useState(false);

  const userName = user?.full_name || "";
  const computedLoaners = loaners.map(computeLoanerData);
  const overdueCount = computedLoaners.filter(l => l.risk_status === "Overdue").length;
  const dueSoonCount = computedLoaners.filter(l => l.risk_status === "Due Soon").length;
  const totalFineExposure = computedLoaners.reduce((sum, l) => sum + (l.fineAmount || 0), 0);
  const myLoanerCount = computedLoaners.filter(l =>
    l.returnStatus !== "sent_back" &&
    l.returnStatus !== "received" &&
    (l.repName?.toLowerCase() === userName.toLowerCase() ||
     l.associateSalesRep?.toLowerCase() === userName.toLowerCase() ||
     l.fieldSalesRep?.toLowerCase() === userName.toLowerCase())
  ).length;
  const myMissingCount = missingParts.filter(p => 
    p.repName?.toLowerCase() === userName.toLowerCase() && 
    p.status === "missing" &&
    p.returnStatus !== "sent_back" &&
    p.returnStatus !== "received"
  ).length;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8">

        {/* Header: calendar | logo+title | notifications */}
        <div className="flex items-center justify-between mb-4">
          <Link to={createPageUrl("SendBackLog")} className="w-10 h-10 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:border-blue-300 transition-colors">
            <CalendarDays className="w-5 h-5 text-gray-500" />
          </Link>

          <div className="flex flex-col items-center">
            <div style={{
              width: '52px', height: '52px', borderRadius: '14px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.10)', backgroundColor: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
              border: '1.5px solid rgba(0,0,0,0.06)'
            }}>
              <img
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/698fe9d012ce3a450807fc7e/9d5cf87f9_IMG_3258.jpg"
                alt="Relay Logo"
                className="object-contain w-full h-full"
              />
            </div>
            <h1 className="font-semibold mt-1" style={{ color: "#000000", fontSize: "22px", letterSpacing: "-0.04em", fontFamily: "system-ui, -apple-system, sans-serif" }}>
              Relay
            </h1>
            <p className="text-[10px] font-light" style={{ color: "#9CA3AF", letterSpacing: "0.15em", textTransform: "uppercase" }}>
              Loaner Operations
            </p>
          </div>

          <div className="w-10 h-10 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center">
            <NotificationCenter userName={user?.full_name} />
          </div>
        </div>

        {/* Navigation Sections */}
        <div className="space-y-6">
          {/* Search & Overview */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">Search & Overview</p>
            <div className="space-y-2">
              <NavCard
                icon={Search}
                title="Search"
                description="Look up any loaner set or rep"
                page="Search"
                badgeColor={{ bg: "bg-blue-50", icon: "text-blue-500", badge: "" }}
              />
            </div>
          </div>

          {/* My Account */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">My Account</p>
            <div className="space-y-2">
              <NavCard
                icon={User}
                title="My Loaners"
                description="Sets currently assigned to you"
                page="MyLoaners"
                badge={myLoanerCount > 0 ? myLoanerCount : null}
                badgeColor={{ bg: "bg-purple-50", icon: "text-purple-500", badge: "bg-purple-100 text-purple-700" }}
              />
              <NavCard
                icon={AlertTriangle}
                title="My Missing Parts"
                description="Parts you owe or need to return"
                page="MyMissingParts"
                badge={myMissingCount > 0 ? myMissingCount : null}
                badgeColor={{ bg: "bg-red-50", icon: "text-red-500", badge: "bg-red-100 text-red-700" }}
              />
              <NavCard
                icon={User}
                title="My Account"
                description="Profile and preferences"
                page="MyAccount"
                badgeColor={{ bg: "bg-gray-50", icon: "text-gray-500", badge: "" }}
              />
            </div>
          </div>

          {/* Marketplace & Logs */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">Marketplace & Logs</p>
            <div className="space-y-2">
              <NavCard
                icon={ShoppingBag}
                title="Marketplace"
                description="Buy, sell, or find parts"
                page="Marketplace"
                badge={marketplaceItems.length > 0 ? marketplaceItems.length : null}
                badgeColor={{ bg: "bg-emerald-50", icon: "text-emerald-500", badge: "bg-emerald-100 text-emerald-700" }}
              />
              <NavCard
                icon={FileText}
                title="Track Log"
                description="Shipment and send-back history"
                page="SendBackLog"
                badgeColor={{ bg: "bg-orange-50", icon: "text-orange-500", badge: "" }}
              />
            </div>
          </div>

          {/* Admin */}
          {user?.role === "admin" && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">Admin</p>
              <div className="space-y-2">
                <NavCard
                  icon={TrendingUp}
                  title="Analytics"
                  description="Trends, overdue rates & missing parts"
                  page="Analytics"
                  badgeColor={{ bg: "bg-indigo-50", icon: "text-indigo-500", badge: "" }}
                />
                <NavCard
                  icon={Upload}
                  title="Import Data"
                  description="Upload loaner spreadsheets"
                  page="ImportData"
                  badgeColor={{ bg: "bg-slate-50", icon: "text-slate-500", badge: "" }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ESC Dashboard */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">ESC Overview</p>
            <div className="space-y-2">
            <Link to={createPageUrl("AllLoanersUnfiltered")} className="block bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-100 transition-all group p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                  <Package className="w-5 h-5 text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">ESC Dashboard</p>
                  <p className="text-xs text-gray-400">Full loaner board with all reps</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors shrink-0" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1 bg-red-50 rounded-lg px-2 py-1.5 text-center">
                  <p className="text-sm font-bold text-red-600">{overdueCount}</p>
                  <p className="text-[10px] text-gray-500">Overdue</p>
                </div>
                <div className="flex-1 bg-amber-50 rounded-lg px-2 py-1.5 text-center">
                  <p className="text-sm font-bold text-amber-600">{dueSoonCount}</p>
                  <p className="text-[10px] text-gray-500">Due Soon</p>
                </div>
                <div className="flex-1 bg-gray-50 rounded-lg px-2 py-1.5 text-center">
                  <p className="text-sm font-bold text-gray-700">{computedLoaners.length}</p>
                  <p className="text-[10px] text-gray-500">Total</p>
                </div>
              </div>
            </Link>
            <button
              onClick={() => setEscExportOpen(true)}
              className="w-full flex items-center gap-4 p-4 bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-100 transition-all group text-left"
            >
              <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                <Download className="w-5 h-5 text-indigo-500" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Export Reports</p>
                <p className="text-xs text-gray-400 mt-0.5">Export loaners or missing parts to PDF</p>
              </div>
              <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors shrink-0" />
            </button>
            </div>
          </div>

          <ESCExportDialog
            open={escExportOpen}
            onClose={() => setEscExportOpen(false)}
            loaners={computedLoaners}
            missingParts={missingParts}
          />

        {/* Quick Stats Bar */}
        {isLoading ? (
          <div className="flex gap-2 mt-6">
            {[1,2,3].map(i => <Skeleton key={i} className="flex-1 h-16 rounded-xl" />)}
          </div>
        ) : (
          <div className="flex gap-2 mt-6">
            <div
              className={`flex-1 rounded-xl p-3 text-center cursor-pointer active:scale-95 transition-transform ${overdueCount > 0 ? "bg-red-50" : "bg-gray-100"}`}
              onClick={() => navigate('/Search?filter=overdue')}
            >
              <p className={`text-xl font-bold ${overdueCount > 0 ? "text-red-600" : "text-gray-700"}`}>{overdueCount}</p>
              <p className="text-xs text-gray-500 leading-tight mt-0.5">Overdue</p>
            </div>
            <div
              className={`flex-1 rounded-xl p-3 text-center cursor-pointer active:scale-95 transition-transform ${dueSoonCount > 0 ? "bg-amber-50" : "bg-gray-100"}`}
              onClick={() => navigate('/Search?filter=due_soon')}
            >
              <p className={`text-xl font-bold ${dueSoonCount > 0 ? "text-amber-600" : "text-gray-700"}`}>{dueSoonCount}</p>
              <p className="text-xs text-gray-500 leading-tight mt-0.5">Due Soon</p>
            </div>
            <div className={`flex-1 rounded-xl p-3 text-center ${totalFineExposure > 0 ? "bg-red-50" : "bg-gray-100"}`}>
              <p className={`text-base font-bold ${totalFineExposure > 0 ? "text-red-600" : "text-gray-700"}`}>{formatCurrency(totalFineExposure)}</p>
              <p className="text-xs text-gray-500 leading-tight mt-0.5">Fines</p>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-300 mt-4">
          {userName ? `Signed in as ${userName}` : ""}
        </p>
      </div>
    </div>
  );
}