import { ReactNode, useState, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
  ClipboardList,
  Search,
  Plus,
} from "lucide-react";

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState("");

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, name, entity_type").order("name");
      if (error) throw error;
      return data;
    },
  });

  const filteredCompanies = useMemo(() => {
    if (!companySearch.trim()) return companies.slice(0, 8);
    return companies.filter((c) =>
      c.name.toLowerCase().includes(companySearch.toLowerCase())
    );
  }, [companies, companySearch]);

  // Detect if we're in a company context
  const companyMatch = location.pathname.match(/^\/company\/([^/]+)/);
  const companyId = companyMatch ? companyMatch[1] : null;

  const mainNav = [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Reports", href: "/reports", icon: ClipboardList },
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

          <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
            Companies
          </p>
          <div className="px-2 pb-1">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-sidebar-foreground/40" />
              <Input
                value={companySearch}
                onChange={(e) => setCompanySearch(e.target.value)}
                placeholder="Search companies…"
                className="h-7 pl-7 text-[12px] bg-sidebar-accent/30 border-sidebar-border text-sidebar-foreground placeholder:text-sidebar-foreground/30"
              />
            </div>
          </div>
          <div className="max-h-40 overflow-y-auto space-y-0.5">
            {filteredCompanies.map((c) => {
              const isActive = location.pathname === `/company/${c.id}`;
              return (
                <button
                  key={c.id}
                  onClick={() => {
                    navigate(`/company/${c.id}`);
                    setMobileOpen(false);
                  }}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors text-left ${
                    isActive
                      ? "bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <Building2 className="h-3 w-3 shrink-0 opacity-50" />
                  <span className="truncate">{c.name}</span>
                </button>
              );
            })}
            {filteredCompanies.length === 0 && (
              <p className="px-3 py-2 text-[11px] text-sidebar-foreground/40">No matches</p>
            )}
          </div>
          <button
            onClick={() => {
              navigate("/");
              setMobileOpen(false);
              // Small delay to let Dashboard mount, then trigger dialog
              setTimeout(() => window.dispatchEvent(new CustomEvent("open-add-company")), 100);
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[12px] font-medium text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors"
          >
            <Plus className="h-3 w-3 shrink-0" />
            <span>Add Company</span>
          </button>

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
