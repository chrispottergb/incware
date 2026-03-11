import { ReactNode, useState, useMemo } from "react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown } from "lucide-react";
import logoEntityIQ from "@/assets/logo-entityiq.png";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Building2,
  Database,
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
  Scale,
  GitBranch,
  UserCheck,
  Settings as SettingsIcon,
} from "lucide-react";
import { isLLCType } from "@/lib/entity-terminology";

function entityBadge(entityType: string | undefined) {
  if (entityType === "Corporation") return "Corp";
  if (entityType === "S-Corp") return "S-Corp";
  if (entityType === "LLC") return "LLC";
  if (entityType === "Single Member LLC") return "SMLLC";
  if (entityType === "Non-Profit") return "N-P";
  if (entityType === "Partnership") return "Ptnr";
  return entityType?.slice(0, 4) || "";
}

export default function AppLayout({ children }: { children: ReactNode }) {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [companySearch, setCompanySearch] = useState("");

  const [inactiveOpen, setInactiveOpen] = useState(false);

  const { data: companies = [] } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("id, name, entity_type, status").order("name");
      if (error) throw error;
      return data;
    },
  });

  const activeCompanies = useMemo(() => companies.filter((c) => c.status !== "inactive"), [companies]);
  const inactiveCompanies = useMemo(() => companies.filter((c) => c.status === "inactive"), [companies]);

  const filteredActiveCompanies = useMemo(() => {
    if (!companySearch.trim()) return activeCompanies;
    return activeCompanies.filter((c) =>
      c.name.toLowerCase().includes(companySearch.toLowerCase())
    );
  }, [activeCompanies, companySearch]);

  const filteredInactiveCompanies = useMemo(() => {
    if (!companySearch.trim()) return inactiveCompanies;
    return inactiveCompanies.filter((c) =>
      c.name.toLowerCase().includes(companySearch.toLowerCase())
    );
  }, [inactiveCompanies, companySearch]);

  // Detect if we're in a company context
  const companyMatch = location.pathname.match(/^\/company\/([^/]+)/);
  const companyId = companyMatch ? companyMatch[1] : null;
  const currentCompany = companyId ? companies.find((c) => c.id === companyId) : null;
  const currentCompanyIsLLC = isLLCType(currentCompany?.entity_type);

  const mainNav = [
    { label: "Dashboard", href: "/", icon: LayoutDashboard },
    { label: "Import Access DB", href: "/import-access", icon: Database },
    { label: "Reports", href: "/reports", icon: ClipboardList },
    { label: "Org Chart", href: "/org-chart", icon: GitBranch },
    { label: "Settings", href: "/settings", icon: SettingsIcon },
  ];

  const companyNav = companyId
    ? currentCompanyIsLLC
      ? [
          { label: "Organizational Info", href: `/company/${companyId}#organization`, icon: Landmark },
          { label: "Meetings", href: `/company/${companyId}#meetings`, icon: Calendar },
          { label: "Membership Interest/Units", href: `/company/${companyId}#shareholders`, icon: UsersRound },
          { label: "Timeline", href: `/company/${companyId}#timeline`, icon: Clock },
          { label: "Leases", href: `/company/${companyId}#leases`, icon: FileText },
          { label: "Counsel", href: `/company/${companyId}#counsel`, icon: Scale },
          { label: "Bank", href: `/company/${companyId}#banks`, icon: Landmark },
          { label: "Relationships", href: `/company/${companyId}#relationships`, icon: GitBranch },
          { label: "AI Compliance", href: `/company/${companyId}#ai-compliance`, icon: UserCheck },
          { label: "Operating Agreement", href: `/company/${companyId}#operating-agreement`, icon: FileText },
          { label: "Record Book", href: `/company/${companyId}#record-book`, icon: FileText },
          { label: "Documents", href: `/company/${companyId}#documents`, icon: FileText },
        ]
      : (() => {
          const isCorp = currentCompany?.entity_type === "Corporation" || currentCompany?.entity_type === "S-Corp";
          const isNonprofit = currentCompany?.entity_type === "Non-Profit";
          const nav = [
            { label: isCorp ? "Overview" : "Incorporation Info", href: `/company/${companyId}#incorporation`, icon: Building2 },
            ...(!isCorp ? [{ label: "Organization", href: `/company/${companyId}#organization`, icon: Landmark }] : []),
            { label: "Meetings", href: `/company/${companyId}#meetings`, icon: Calendar },
            { label: "Shareholders", href: `/company/${companyId}#shareholders`, icon: UsersRound },
            { label: "Timeline", href: `/company/${companyId}#timeline`, icon: Clock },
            { label: "Leases", href: `/company/${companyId}#leases`, icon: FileText },
            { label: "Counsel", href: `/company/${companyId}#counsel`, icon: Scale },
            { label: "Banks", href: `/company/${companyId}#banks`, icon: Landmark },
            { label: "Relationships", href: `/company/${companyId}#relationships`, icon: GitBranch },
            { label: "AI Compliance", href: `/company/${companyId}#ai-compliance`, icon: UserCheck },
          ];
          if (isCorp) nav.push({ label: "Bylaws", href: `/company/${companyId}#bylaws`, icon: FileText });
          if (isNonprofit) {
            nav.push({ label: "Bylaws", href: `/company/${companyId}#nonprofit-bylaws`, icon: FileText });
            nav.push({ label: "Conflict of Interest", href: `/company/${companyId}#conflict-of-interest`, icon: FileText });
          }
          nav.push({ label: "Record Book", href: `/company/${companyId}#record-book`, icon: FileText });
          nav.push({ label: "Documents", href: `/company/${companyId}#documents`, icon: FileText });
          return nav;
        })()
    : [];

  return (
    <div className="flex min-h-screen">
      {/* Sidebar */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-60 flex-col bg-sidebar text-sidebar-foreground transition-transform lg:static lg:translate-x-0 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="flex h-14 items-center border-b border-sidebar-border px-4">
          <img src={logoEntityIQ} alt="EntityIQ" className="h-7" />
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
                    ? "border-l-2 border-primary bg-sidebar-accent text-sidebar-accent-foreground"
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
            {filteredActiveCompanies.map((c) => {
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
                      ? "border-l-2 border-primary bg-sidebar-accent text-sidebar-accent-foreground"
                      : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                  }`}
                >
                  <Building2 className="h-3 w-3 shrink-0 opacity-50" />
                  <span className="truncate flex-1">{c.name}</span>
                  <span className="shrink-0 rounded bg-sidebar-accent/60 px-1 py-0 text-[9px] font-semibold uppercase text-sidebar-foreground/50">
                    {entityBadge(c.entity_type)}
                  </span>
                </button>
              );
            })}
            {filteredActiveCompanies.length === 0 && (
              <p className="px-3 py-2 text-[11px] text-sidebar-foreground/40">No matches</p>
            )}
          </div>
          <button
            onClick={() => {
              navigate("/");
              setMobileOpen(false);
              setTimeout(() => window.dispatchEvent(new CustomEvent("open-add-company")), 100);
            }}
            className="flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[12px] font-medium text-sidebar-foreground/50 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground transition-colors"
          >
            <Plus className="h-3 w-3 shrink-0" />
            <span>Add Company</span>
          </button>

          {filteredInactiveCompanies.length > 0 && (
            <Collapsible open={inactiveOpen} onOpenChange={setInactiveOpen}>
              <CollapsibleTrigger className="flex w-full items-center gap-1 px-3 pt-3 pb-1">
                <ChevronDown className={`h-3 w-3 text-sidebar-foreground/40 transition-transform ${inactiveOpen ? "" : "-rotate-90"}`} />
                <span className="text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                  Inactive Clients ({filteredInactiveCompanies.length})
                </span>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="max-h-32 overflow-y-auto space-y-0.5">
                  {filteredInactiveCompanies.map((c) => {
                    const isActive = location.pathname === `/company/${c.id}`;
                    return (
                      <button
                        key={c.id}
                        onClick={() => {
                          navigate(`/company/${c.id}`);
                          setMobileOpen(false);
                        }}
                        className={`flex w-full items-center gap-2 rounded-md px-3 py-1.5 text-[12px] font-medium transition-colors text-left opacity-60 ${
                          isActive
                            ? "border-l-2 border-primary bg-sidebar-accent text-sidebar-accent-foreground"
                            : "text-sidebar-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground"
                        }`}
                      >
                        <Building2 className="h-3 w-3 shrink-0 opacity-50" />
                        <span className="truncate flex-1">{c.name}</span>
                        <span className="shrink-0 rounded bg-sidebar-accent/60 px-1 py-0 text-[9px] font-semibold uppercase text-sidebar-foreground/50">
                          {entityBadge(c.entity_type)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {companyNav.length > 0 && (
            <>
              <p className="px-3 pt-4 pb-1 text-[10px] font-semibold uppercase tracking-widest text-sidebar-foreground/40">
                Company
              </p>
              {companyNav.map((item) => {
                const itemHash = item.href.split("#")[1] || "";
                const currentHash = location.hash.replace("#", "") || (currentCompanyIsLLC ? "organization" : "incorporation");
                const active = companyId && itemHash === currentHash;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-[13px] font-medium transition-colors ${
                      active
                        ? "border-l-2 border-primary bg-sidebar-accent text-sidebar-accent-foreground"
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
      <div className="flex flex-1 flex-col min-w-0">
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
        <main className="flex-1 overflow-auto p-4 lg:p-6 min-w-0">{children}</main>
      </div>
    </div>
  );
}
