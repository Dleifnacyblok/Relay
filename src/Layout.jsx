import { Link, useLocation } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { 
  LayoutDashboard, 
  User, 
  Search, 
  Upload,
  Menu,
  X,
  LogOut
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export default function Layout({ children }) {
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const { data: user } = useQuery({
    queryKey: ["currentUser"],
    queryFn: () => base44.auth.me(),
  });

  const isAdmin = user?.role === "admin";

  const navigation = [
    { name: "Dashboard", page: "Dashboard", icon: LayoutDashboard },
    { name: "My Loaners", page: "MyLoaners", icon: User },
    { name: "Search", page: "Search", icon: Search },
    ...(isAdmin ? [{ name: "Import", page: "ImportData", icon: Upload }] : []),
  ];

  const isActive = (pageName) => {
    const pageUrl = createPageUrl(pageName);
    return location.pathname === pageUrl || location.pathname === pageUrl + "/";
  };

  const handleLogout = () => {
    base44.auth.logout();
  };

  return (
    <div className="min-h-screen bg-[#0B0D12]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-[#121621] border-r border-slate-800/50">
          {/* Logo */}
          <div className="flex items-center gap-4 px-6 py-6 border-b border-slate-800/50">
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/698fe9d012ce3a450807fc7e/9d5cf87f9_IMG_3258.jpg" 
              alt="Relay Logo" 
              className="w-16 h-16 object-contain bg-white rounded-lg p-1"
            />
            <div>
              <h1 className="text-lg font-bold tracking-tight text-white" style={{textShadow: '0 0 25px rgba(79, 140, 255, 0.6), 0 0 35px rgba(157, 78, 221, 0.4)'}}>
                Relay
              </h1>
              <p className="text-xs text-slate-400">Loaner Manager</p>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {navigation.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.page);
              return (
                <Link
                  key={item.name}
                  to={createPageUrl(item.page)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                    active 
                      ? "bg-gradient-to-r from-[#4F8CFF]/20 to-[#9D4EDD]/20 text-white border border-[#4F8CFF]/30" 
                      : "text-slate-400 hover:bg-slate-800/50 hover:text-white"
                  )}
                  >
                  <Icon className={cn("w-5 h-5", active ? "text-[#4F8CFF]" : "text-slate-500")} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User Section */}
          <div className="p-4 border-t border-slate-800/50">
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-[#4F8CFF] to-[#9D4EDD] flex items-center justify-center">
                <span className="text-sm font-medium text-white">
                  {user?.full_name?.charAt(0) || "U"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">
                  {user?.full_name || "User"}
                </p>
                <p className="text-xs text-slate-400 capitalize">{user?.role || "Rep"}</p>
              </div>
              <Button 
                variant="ghost" 
                size="icon"
                className="text-slate-400 hover:text-white hover:bg-slate-800"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden sticky top-0 z-40 bg-[#121621] border-b border-slate-800/50">
        <div className="flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-3">
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/698fe9d012ce3a450807fc7e/9d5cf87f9_IMG_3258.jpg" 
              alt="Relay Logo" 
              className="w-10 h-10 object-contain bg-white rounded-lg p-1"
            />
            <span className="font-bold text-white" style={{textShadow: '0 0 25px rgba(79, 140, 255, 0.6), 0 0 35px rgba(157, 78, 221, 0.4)'}}>Relay</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="text-white hover:bg-slate-800"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-[#121621] border-b border-slate-800/50 shadow-lg">
            <nav className="p-3 space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.page);
                return (
                  <Link
                    key={item.name}
                    to={createPageUrl(item.page)}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-lg text-sm font-medium",
                      active 
                        ? "bg-gradient-to-r from-[#4F8CFF]/20 to-[#9D4EDD]/20 text-white border border-[#4F8CFF]/30" 
                        : "text-slate-400"
                    )}
                  >
                    <Icon className={cn("w-5 h-5", active ? "text-[#4F8CFF]" : "text-slate-500")} />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
            <div className="p-3 border-t border-slate-800/50">
              <Button 
                variant="ghost" 
                className="w-full justify-start text-slate-400 hover:text-white hover:bg-slate-800"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-3" />
                Sign Out
              </Button>
            </div>
            </div>
            )}
      </div>

      {/* Main Content */}
      <main className="lg:pl-64">
        {children}
      </main>
    </div>
  );
}