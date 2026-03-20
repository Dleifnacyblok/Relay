import { Link, useLocation } from "react-router-dom";
import { useState, useEffect } from "react";
import { createPageUrl } from "@/utils";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { 
  User, 
  Search, 
  Upload,
  Menu,
  X,
  LogOut,
  AlertCircle,
  ShoppingBag,
  Home,
  FileText,
  TrendingUp,
  MapPin,
  CalendarDays,
  BookOpen,
  Settings,
} from "lucide-react";
import OnboardingWizard from "@/components/onboarding/OnboardingWizard";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import NotificationCenter from "@/components/notifications/NotificationCenter";

export default function Layout({ children, currentPageName }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
  });

  const isAdmin = user?.role === "admin" || user?.role === "manager";
  const isDashboard = currentPageName === "Dashboard";
  const showOnboarding = user && !user.onboardingComplete && user.role !== "admin" && user.role !== "manager";

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [location.pathname]);

  const navigation = [
    { name: "Search", page: "Search", icon: Search },
    { name: "Marketplace", page: "Marketplace", icon: ShoppingBag },
    { name: "My Loaners", page: "MyLoaners", icon: User },
    { name: "Missing ...", page: "MyMissingParts", icon: AlertCircle },
  ];

  const moreNavigation = [
    { name: "Territory", page: "TerritoryInventory", icon: MapPin },
    { name: "Calendar", page: "Calendar", icon: CalendarDays },
    { name: "Track Log", page: "SendBackLog", icon: FileText },
    { name: "My Account", page: "MyAccount", icon: User },
    { name: "App Guide", page: "RelayGuide", icon: BookOpen },
    ...(isAdmin ? [
      { name: "Analytics", page: "Analytics", icon: TrendingUp },
      { name: "Import", page: "ImportData", icon: Upload },
      { name: "Manager Settings", page: "AdminSettings", icon: Settings },
    ] : []),
  ];

  const isActive = (pageName) => {
    const pageUrl = createPageUrl(pageName);
    return location.pathname === pageUrl || location.pathname === pageUrl + "/";
  };

  const handleLogout = () => {
    base44.auth.logout();
  };

  // Desktop sidebar (always shown on lg+)
  const desktopSidebar = (
    <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
      <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
        <div className="flex items-center gap-4 px-6 py-6" style={{borderBottom: '1px solid rgba(0,0,0,0.06)'}}>
          <Link to={createPageUrl("Dashboard")}>
            <div style={{
              width: '60px', height: '60px', borderRadius: '12px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)', backgroundColor: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden'
            }}>
              <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/698fe9d012ce3a450807fc7e/9d5cf87f9_IMG_3258.jpg" 
                alt="Relay Logo" className="object-contain w-full h-full" />
            </div>
          </Link>
          <div>
            <h1 className="text-lg font-semibold text-black" style={{letterSpacing: '-0.03em'}}>Relay</h1>
            <p className="text-xs text-gray-500">Loaner Manager</p>
          </div>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-1">
          {[...navigation, ...moreNavigation].map((item) => {
            const Icon = item.icon;
            const active = isActive(item.page);
            return (
              <Link key={item.name} to={createPageUrl(item.page)}
                className={cn("flex items-center gap-3 px-4 py-3.5 rounded-lg text-base font-medium transition-all",
                  active ? "bg-blue-50 text-black border border-blue-200" : "text-gray-600 hover:bg-gray-50 hover:text-black")}>
                <Icon className={cn("w-5 h-5", active ? "text-blue-600" : "text-gray-500")} />
                {item.name}
              </Link>
            );
          })}
        </nav>
        <div className="p-4" style={{borderTop: '1px solid rgba(0,0,0,0.06)'}}>
          <div className="flex items-center gap-3 px-2 py-2">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
              <span className="text-sm font-medium text-white">{user?.full_name?.charAt(0) || "U"}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-black truncate">{user?.full_name || "User"}</p>
              <p className="text-xs text-gray-600 capitalize">{user?.role || "Rep"}</p>
            </div>
            <NotificationCenter userName={user?.full_name} />
            <Button variant="ghost" size="icon" className="text-gray-600 hover:text-black hover:bg-gray-100" onClick={handleLogout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
    </aside>
  );

  // Split navigation into left 2 and right 2, logo goes in the center
  const leftNav = navigation.slice(0, 2);
  const rightNav = navigation.slice(2, 4);

  const mobileBottomNav = (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-gray-100" style={{paddingBottom: 'env(safe-area-inset-bottom)'}}>
      <div className="flex items-end justify-around px-1 pt-2 pb-2">
        {/* Left 2 nav items */}
        {leftNav.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.page);
          return (
            <Link key={item.page} to={createPageUrl(item.page)}
              className={cn("flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors min-w-0",
                active ? "text-blue-600" : "text-gray-400")}>
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-[10px] font-medium leading-tight text-center truncate max-w-[52px]">{item.name}</span>
            </Link>
          );
        })}

        {/* Center Logo */}
        <Link to={createPageUrl("Dashboard")} className="flex flex-col items-center -mt-7">
          <div style={{
            width: '70px', height: '70px', borderRadius: '20px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.18)', backgroundColor: 'white',
            display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
            border: '2px solid rgba(0,0,0,0.06)'
          }}>
            <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/698fe9d012ce3a450807fc7e/9d5cf87f9_IMG_3258.jpg"
              alt="Home" className="object-contain w-full h-full" />
          </div>
          <span className="text-[9px] font-medium text-gray-400 mt-0.5">Home</span>
        </Link>

        {/* Right 2 nav items */}
        {rightNav.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.page);
          return (
            <Link key={item.page} to={createPageUrl(item.page)}
              className={cn("flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors min-w-0",
                active ? "text-blue-600" : "text-gray-400")}>
              <Icon className="w-5 h-5 shrink-0" />
              <span className="text-[10px] font-medium leading-tight text-center truncate max-w-[52px]">{item.name}</span>
            </Link>
          );
        })}

        {/* More menu trigger */}
        <div className="relative">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className={cn("flex flex-col items-center gap-0.5 px-3 py-1 rounded-xl transition-colors min-w-0",
              mobileMenuOpen ? "text-blue-600" : "text-gray-400")}>
            {mobileMenuOpen ? <X className="w-5 h-5 shrink-0" /> : <Menu className="w-5 h-5 shrink-0" />}
            <span className="text-[10px] font-medium leading-tight">More</span>
          </button>
        </div>
      </div>

      {/* Slide-up more menu */}
      {mobileMenuOpen && (
        <div className="absolute bottom-full left-0 right-0 bg-white shadow-lg border-t border-gray-100 z-50">
          <nav className="p-3 space-y-1">
            <NotificationCenter userName={user?.full_name} />
            {moreNavigation.map((item) => {
              const Icon = item.icon;
              return (
                <Link key={item.name} to={createPageUrl(item.page)}
                  onClick={() => setMobileMenuOpen(false)}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50">
                  <Icon className="w-4 h-4 text-gray-500" />
                  {item.name}
                </Link>
              );
            })}
          </nav>
          <div className="p-3 border-t border-gray-100">
            <Button variant="ghost" className="w-full justify-start text-gray-600" onClick={handleLogout}>
              <LogOut className="w-4 h-4 mr-3" /> Sign Out
            </Button>
          </div>
        </div>
      )}
    </nav>
  );

  // All pages get bottom nav on mobile (including Dashboard)
  return (
    <div className="min-h-screen bg-white">
      {desktopSidebar}

      {/* Main Content — padded for bottom nav */}
      <main className="lg:pl-64 pb-24 lg:pb-0">
        {children}
      </main>

      {mobileBottomNav}
    </div>
  );
}