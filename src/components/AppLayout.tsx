import { ReactNode } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  Building2,
  LayoutDashboard,
  LogOut,
  Menu,
  X,
  FileText,
  Users,
  Calendar,
  Clock,
  Landmark,
  UsersRound,
} from "lucide-react";
import { useState } from "react";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);

  // Detect if we're in a company context
  const companyMatch = location.pathname.match(/^\/company\/([^/]+)/);
  const companyId = companyMatch ? companyMatch[1] : null;

  const mainNav = [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
  ];

  const companyNav = companyId
    ? [
        { label: "Overview", href: `/company/${companyId}#incorporation`, icon: Building2 },
        { label: "Organization", href: `/company/${companyId}#organization`, icon: Landmark },
        { label: "Meetings", href: `/company/${companyId}#meetings`, icon: Calendar },
        { label: "Shareholders", href: `/company/${companyId}#shareholders`, icon: UsersRound },
        { label: "Timeline", href: `/company/${companyId}#timeline`, icon: Clock },
      ]
    : [];

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center gap-2.5 border-b border-sidebar-border px-4">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary">
            <Building2 className="h-4 w-4 text-sidebar-primary-foreground" />
          </div>
          <span className="font-display text-base font-bold text-sidebar-primary-foreground tracking-tight">
            IncWare
          </span>
        </div>

        <nav className="flex-1 space-y-0.5 p-2">
          <p className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
            Main
          </p>
          {mainNav.map((item) => {
            const active = location.pathname === item.href;
            return (
              <Link
                key={item.href}
                to={item.href}
                onClick={() => setMobileOpen(false)}
                className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                }`}
              >
                <item.icon className="h-4 w-4 shrink-0" />
                {item.label}
              </Link>
            );
          })}

          {companyNav.length > 0 && (
            <>
              <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                Company
              </p>
              {companyNav.map((item) => {
                const itemHash = item.href.split("#")[1] || "";
                const currentHash = location.hash.replace("#", "") || "incorporation";
                const active = companyId && itemHash === currentHash;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
                      active
                        ? "bg-sidebar-accent text-sidebar-accent-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                    }`}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    {item.label}
                  </Link>
                );
              })}
            </>
          )}
        </nav>

        <div className="border-t border-sidebar-border p-2">
          <div className="mb-1 truncate px-3 text-[11px] text-sidebar-foreground/50">
            {user?.email}
          </div>
          <button
            onClick={signOut}
            className="flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-foreground/20 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main content */}
      <div className="flex flex-1 flex-col">
        <header className="flex h-14 items-center gap-4 border-b border-border bg-card/80 backdrop-blur-sm px-4 lg:px-6">
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden h-8 w-8"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </Button>
          <div className="flex-1" />
          <span className="text-xs text-muted-foreground">
            {new Date().toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
          </span>
        </header>
        <main className="flex-1 overflow-auto p-4 lg:p-6">{children}</main>
      </div>
    </div>
  );
}
