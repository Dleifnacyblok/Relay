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
  LogOut,
  AlertCircle
} from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import NotificationCenter from "@/components/notifications/NotificationCenter";

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
    { name: "Search", page: "Search", icon: Search },
    { name: "My Accounts", page: "MyAccount", icon: User },
    { name: "My Loaners", page: "MyLoaners", icon: User },
    { name: "My Missing Parts", page: "MyMissingParts", icon: AlertCircle },
    { name: "Track Log", page: "SendBackLog", icon: Upload },
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
    <div className="min-h-screen" style={{backgroundColor: '#FFFFFF'}}>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex flex-col flex-grow bg-white border-r border-gray-200">
          {/* Logo */}
          <div className="flex items-center gap-4 px-6 py-6" style={{borderBottom: '1px solid rgba(0,0,0,0.06)'}}>
            <div style={{
              width: '100px',
              height: '100px',
              borderRadius: '12px',
              padding: '2px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
              backgroundColor: 'rgba(255, 255, 255, 0.88)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <img 
                src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/698fe9d012ce3a450807fc7e/9d5cf87f9_IMG_3258.jpg" 
                alt="Relay Logo" 
                className="object-contain"
                style={{width: '100%', height: '100%'}}
              />
            </div>
            <div style={{marginTop: '-2px'}}>
              <h1 className="text-lg font-semibold text-black" style={{letterSpacing: '-0.03em'}}>
                Relay
              </h1>
              <p className="text-xs text-gray-600" style={{marginTop: '-1px'}}>Loaner Manager</p>
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
                    "flex items-center gap-3 px-4 py-3.5 rounded-lg text-base font-medium transition-all",
                    active 
                      ? "bg-blue-50 text-black border border-blue-200" 
                      : "text-gray-600 hover:bg-gray-50 hover:text-black"
                  )}
                  >
                  <Icon className={cn("w-5 h-5", active ? "text-blue-600" : "text-gray-500")} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          {/* User Section */}
          <div className="p-4" style={{borderTop: '1px solid rgba(0,0,0,0.06)'}}>
            <div className="flex items-center gap-3 px-2 py-2">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center">
                <span className="text-sm font-medium text-white">
                  {user?.full_name?.charAt(0) || "U"}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-black truncate">
                  {user?.full_name || "User"}
                </p>
                <p className="text-xs text-gray-600 capitalize">{user?.role || "Rep"}</p>
              </div>
              <NotificationCenter userName={user?.full_name} />
              <Button 
                variant="ghost" 
                size="icon"
                className="text-gray-600 hover:text-black hover:bg-gray-100"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </aside>

      {/* Mobile Header */}
      <div className="lg:hidden sticky top-0 z-40 bg-white" style={{borderBottom: '1px solid rgba(0,0,0,0.06)'}}>
        <div className="relative flex items-center justify-center px-4 py-4">
          <div style={{
            width: '100px',
            height: '100px',
            borderRadius: '12px',
            padding: '2px',
            boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            backgroundColor: 'rgba(255, 255, 255, 0.88)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}>
            <img 
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/698fe9d012ce3a450807fc7e/9d5cf87f9_IMG_3258.jpg" 
              alt="Relay Logo" 
              className="object-contain"
              style={{width: '100%', height: '100%'}}
            />
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="absolute right-4 text-black hover:bg-gray-100"
            style={{top: '50%', transform: 'translateY(-50%)'}}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          >
            {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </Button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="absolute top-full left-0 right-0 bg-white shadow-lg" style={{borderBottom: '1px solid rgba(0,0,0,0.06)'}}>
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
                      "flex items-center gap-3 px-4 py-3.5 rounded-lg text-base font-medium",
                      active 
                        ? "bg-blue-50 text-black border border-blue-200" 
                        : "text-gray-600"
                    )}
                  >
                    <Icon className={cn("w-5 h-5", active ? "text-blue-600" : "text-gray-500")} />
                    {item.name}
                  </Link>
                );
              })}
            </nav>
            <div className="p-3 flex items-center gap-2" style={{borderTop: '1px solid rgba(0,0,0,0.06)'}}>
              <NotificationCenter userName={user?.full_name} />
              <Button 
                variant="ghost" 
                className="flex-1 justify-start text-gray-600 hover:text-black hover:bg-gray-100"
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