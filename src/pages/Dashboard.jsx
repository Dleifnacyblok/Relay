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
  Layers,
  FileText,
  ChevronRight,
  TrendingUp,
  Download,
  BarChart2,
} from "lucide-react";
import { computeLoanerData, formatCurrency } from "@/components/loaners/loanerUtils";
import { Skeleton } from "@/components/ui/skeleton";
import { useState, useMemo } from "react";
import NotificationCenter from "@/components/notifications/NotificationCenter";
import ESCExportDialog from "@/components/dashboard/ESCExportDialog";
import RequestedNotificationsCard from "@/components/notifications/RequestedNotificationsCard";

const NavCard = ({ icon: Icon, title, description, page, badge, badgeColor, small }) => (
  <Link
    to={createPageUrl(page)}
    className={`flex items-center gap-3 px-4 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md hover:border-blue-100 transition-all group ${small ? "py-2.5 min-h-10" : "py-4 min-h-14"}`}
  >
    <div className={`rounded-xl flex items-center justify-center shrink-0 ${small ? "w-8 h-8" : "w-11 h-11"} ${badgeColor ? badgeColor.bg : "bg-gray-50"}`}>
      <Icon className={`${small ? "w-4 h-4" : "w-6 h-6"} ${badgeColor ? badgeColor.icon : "text-gray-500"}`} />
    </div>
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2">
        <p className={`font-semibold text-gray-900 ${small ? "text-xs" : "text-sm"}`}>{title}</p>
        {badge != null && (
          <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${badgeColor ? badgeColor.badge : "bg-gray-100 text-gray-600"}`}>
            {badge}
          </span>
        )}
      </div>
      {!small && <p className="text-xs text-gray-400 mt-0.5 truncate">{description}</p>}
    </div>
    <ChevronRight className={`${small ? "w-3 h-3" : "w-4 h-4"} text-gray-300 group-hover:text-blue-400 transition-colors shrink-0`} />
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

  const { data: iepSystems = [] } = useQuery({
    queryKey: ["iepSystemData"],
    queryFn: () => base44.entities.IEPSystemData.list(),
  });

  const navigate = useNavigate();
  const [escExportOpen, setEscExportOpen] = useState(false);

  const userName = user?.full_name || "";
  const computedLoaners = loaners.map(computeLoanerData);
  const activeLoaners = computedLoaners.filter(l =>
    l.returnStatus !== "sent_back" && l.returnStatus !== "received"
  );
  const overdueCount = activeLoaners.filter(l => l.risk_status === "Overdue").length;
  const dueSoonCount = activeLoaners.filter(l => l.risk_status === "Due Soon").length;
  const totalFineExposure = activeLoaners.reduce((sum, l) => sum + (l.fineAmount || 0), 0);
  const myLoanerCount = computedLoaners.filter(l =>
    l.returnStatus !== "sent_back" &&
    l.returnStatus !== "received" &&
    (l.repName?.toLowerCase() === userName.toLowerCase() ||
     l.associateSalesRep?.toLowerCase() === userName.toLowerCase() ||
     l.fieldSalesRep?.toLowerCase() === userName.toLowerCase())
  ).length;

  const avgEffPct = useMemo(() => {
    const vals = iepSystems.filter(s => s.effPct != null).map(s => s.effPct);
    return vals.length ? (vals.reduce((a, b) => a + b, 0) / vals.length) : null;
  }, [iepSystems]);

  const iepAbove = useMemo(() => iepSystems.filter(s => s.effPct != null && s.effPct >= 100).length, [iepSystems]);

  const myMissingCount = missingParts.filter(p =>
    p.repName?.toLowerCase() === userName.toLowerCase() &&
    p.status === "missing" &&
    p.returnStatus !== "sent_back" &&
    p.returnStatus !== "received"
  ).length;

  const isAdmin = user?.role === "admin" || user?.role === "manager";

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-lg mx-auto px-4 py-8">

        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <Link to={createPageUrl("Search")} className="w-10 h-10 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-center hover:border-blue-300 transition-colors">
            <Search className="w-5 h-5 text-gray-500" />
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

        {/* Requested Item Notifications */}
        <RequestedNotificationsCard userName={user?.full_name} />

        {/* Navigation Sections */}
        <div className="space-y-6">

          {/* My Account + sub-items */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">My Account</p>
            <div className="space-y-2">
              <NavCard
                icon={User}
                title="My Account"
                description="Profile and preferences"
                page="MyAccount"
                badgeColor={{ bg: "bg-gray-50", icon: "text-gray-500", badge: "" }}
              />
              {/* Sub-items */}
              <div className="pl-4 space-y-1.5">
                <NavCard
                  small
                  icon={Layers}
                  title="My Loaners"
                  description=""
                  page="MyLoaners"
                  badge={myLoanerCount > 0 ? myLoanerCount : null}
                  badgeColor={{ bg: "bg-purple-50", icon: "text-purple-400", badge: "bg-purple-100 text-purple-700" }}
                />
                <NavCard
                  small
                  icon={AlertTriangle}
                  title="Missing Parts"
                  description=""
                  page="MyMissingParts"
                  badge={myMissingCount > 0 ? myMissingCount : null}
                  badgeColor={{ bg: "bg-red-50", icon: "text-red-400", badge: "bg-red-100 text-red-700" }}
                />
                <NavCard
                  small
                  icon={FileText}
                  title="Track Log"
                  description=""
                  page="SendBackLog"
                  badgeColor={{ bg: "bg-orange-50", icon: "text-orange-400", badge: "" }}
                />
              </div>
            </div>
          </div>

          {/* IEP Dashboard Card */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">IEP Dashboard</p>
            <Link to={createPageUrl("IEPDashboard")} className="block bg-white border border-gray-100 rounded-2xl shadow-sm hover:shadow-md hover:border-indigo-100 transition-all group p-4">
              <div className="flex items-center gap-3 mb-3">
                <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-5 h-5 text-indigo-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">IEP Dashboard</p>
                  <p className="text-xs text-gray-400">System efficiency tracking</p>
                </div>
                <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors shrink-0" />
              </div>
              <div className="flex gap-2">
                <div className="flex-1 bg-indigo-50 rounded-lg px-2 py-1.5 text-center">
                  <p className="text-sm font-bold text-indigo-600">
                    {avgEffPct != null ? `${avgEffPct.toFixed(1)}%` : "95.3%"}
                  </p>
                  <p className="text-[10px] text-gray-500">Avg Eff %</p>
                </div>
                <div className="flex-1 bg-green-50 rounded-lg px-2 py-1.5 text-center">
                  <p className="text-sm font-bold text-green-600">{iepAbove}</p>
                  <p className="text-[10px] text-gray-500">At Target</p>
                </div>
                <div className="flex-1 bg-gray-50 rounded-lg px-2 py-1.5 text-center">
                  <p className="text-sm font-bold text-gray-700">{iepSystems.length}</p>
                  <p className="text-[10px] text-gray-500">Systems</p>
                </div>
              </div>
            </Link>
          </div>

          {/* Marketplace */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">Marketplace</p>
            <div className="space-y-2">
              <NavCard
                icon={ShoppingBag}
                title="Marketplace"
                description="Buy, sell, or find parts"
                page="Marketplace"
                badge={marketplaceItems.length > 0 ? marketplaceItems.length : null}
                badgeColor={{ bg: "bg-emerald-50", icon: "text-emerald-500", badge: "bg-emerald-100 text-emerald-700" }}
              />
            </div>
          </div>

          {/* Admin/Manager section */}
          {isAdmin && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2 px-1">Manager</p>
              <div className="space-y-2">
                <NavCard
                  icon={BarChart2}
                  title="Analytics"
                  description="Trends, overdue rates & missing parts"
                  page="Analytics"
                  badgeColor={{ bg: "bg-indigo-50", icon: "text-indigo-500", badge: "" }}
                />
                <button
                  onClick={() => setEscExportOpen(true)}
                  className="w-full flex items-center gap-3 px-4 py-4 min-h-14 bg-white border border-gray-100 rounded-xl shadow-sm hover:shadow-md hover:border-indigo-100 transition-all group text-left"
                >
                  <div className="w-11 h-11 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
                    <Download className="w-6 h-6 text-indigo-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-900">Export Reports</p>
                    <p className="text-xs text-gray-400 mt-0.5">Export loaners or missing parts to PDF</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-gray-300 group-hover:text-indigo-400 transition-colors shrink-0" />
                </button>
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

        {/* Quick Stats Bar */}
        {isLoading ? (
          <div className="flex gap-2 mt-6">
            {[1,2,3].map(i => <Skeleton key={i} className="flex-1 h-16 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-6">
            <div
              className={`rounded-xl p-3 text-center cursor-pointer active:scale-95 transition-transform ${overdueCount > 0 ? "bg-red-50 border border-red-200" : "bg-gray-100"}`}
              onClick={() => navigate('/Search?filter=overdue')}
            >
              <p className={`text-2xl font-black ${overdueCount > 0 ? "text-red-600" : "text-gray-700"}`}>{overdueCount}</p>
              <p className="text-xs font-semibold text-gray-500 leading-tight mt-0.5">Overdue</p>
            </div>
            <div
              className={`rounded-xl p-3 text-center cursor-pointer active:scale-95 transition-transform ${dueSoonCount > 0 ? "bg-amber-50" : "bg-gray-100"}`}
              onClick={() => navigate('/Search?filter=due_soon')}
            >
              <p className={`text-xl font-bold ${dueSoonCount > 0 ? "text-amber-600" : "text-gray-700"}`}>{dueSoonCount}</p>
              <p className="text-xs text-gray-500 leading-tight mt-0.5">Due Soon</p>
            </div>
            <div className={`rounded-xl p-3 text-center ${totalFineExposure > 0 ? "bg-red-50" : "bg-gray-100"}`}>
              <p className={`text-base font-bold ${totalFineExposure > 0 ? "text-red-600" : "text-gray-700"}`}>{formatCurrency(totalFineExposure)}</p>
              <p className="text-xs text-gray-500 leading-tight mt-0.5">Fines</p>
            </div>
          </div>
        )}

        <p className="text-center text-xs text-gray-300 mt-4 pb-8">
          {userName ? `Signed in as ${userName}` : ""}
        </p>

        <ESCExportDialog
          open={escExportOpen}
          onClose={() => setEscExportOpen(false)}
          loaners={computedLoaners}
          missingParts={missingParts}
        />

      </div>
    </div>
  );
}