import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Building2, Plus, Search, Loader2, ChevronRight, UserPlus, FolderOpen, CalendarCheck, SearchIcon, Bot, AlertTriangle, ClipboardCheck, Upload } from "lucide-react";
import { toast } from "sonner";
import TaxReturnUpload from "@/components/TaxReturnUpload";
import CreateCompanyWizard from "@/components/CreateCompanyWizard";

import cardNewClient from "@/assets/card-new-client.jpg";
import cardImportTaxReturn from "@/assets/card-import-tax-return.jpg";
import cardExistingClient from "@/assets/card-existing-client.jpg";
import cardAnnualUpdate from "@/assets/card-annual-update.jpg";
import cardQuickSearch from "@/assets/card-quick-search.jpg";

const ENTITY_TYPES = ["Corporation", "LLC", "Single Member LLC", "S-Corp", "Non-Profit", "Partnership"];

const US_STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA",
  "KS","KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT",
  "VA","WA","WV","WI","WY","DC",
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [taxReturnOpen, setTaxReturnOpen] = useState(false);
  
  useEffect(() => {
    const handler = () => setDialogOpen(true);
    window.addEventListener("open-add-company", handler);
    return () => window.removeEventListener("open-add-company", handler);
  }, []);

  // Legacy form state removed — now handled by CreateCompanyWizard

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["companies"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .order("name");
      if (error) throw error;
      return data;
    },
  });

  // Company creation now handled by CreateCompanyWizard

  const filtered = companies.filter((c) => {
    const matchesSearch = c.name.toLowerCase().includes(search.toLowerCase());
    const matchesType = filterType === "all" || c.entity_type === filterType;
    return matchesSearch && matchesType;
  });

  const statusBadge = (status: string | null) => {
    if (status === "active") return <Badge variant="outline" className="bg-success/10 text-success border-success/20 text-[10px] px-1.5 py-0">Active</Badge>;
    return <Badge variant="outline" className="bg-muted text-muted-foreground border-muted text-[10px] px-1.5 py-0">Inactive</Badge>;
  };

  return (
    <div className="space-y-6 animate-fade-in min-w-0">

      {/* Welcome Action Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-2 sm:gap-3 min-w-0">
        {[
          {
            title: "New Client",
            description: "Set up a new company",
            image: cardNewClient,
            icon: UserPlus,
            onClick: () => setDialogOpen(true),
          },
          {
            title: "Import Tax Return",
            description: "Upload & auto-populate",
            image: cardImportTaxReturn,
            icon: Upload,
            onClick: () => setTaxReturnOpen(true),
          },
          {
            title: "Existing Client",
            description: "View & manage companies",
            image: cardExistingClient,
            icon: FolderOpen,
            onClick: () => {
              const el = document.getElementById("companies-section");
              el?.scrollIntoView({ behavior: "smooth" });
            },
          },
          {
            title: "Annual Update",
            description: "Schedule annual meetings",
            image: cardAnnualUpdate,
            icon: CalendarCheck,
            onClick: () => {
              if (companies.length > 0) {
                navigate(`/company/${companies[0].id}#meetings`);
              } else {
                toast.info("Add a company first to manage annual meetings.");
              }
            },
          },
          {
            title: "Quick Search",
            description: "Find a company fast",
            image: cardQuickSearch,
            icon: SearchIcon,
            onClick: () => {
              setShowSearch(true);
              setTimeout(() => {
                const input = document.getElementById("company-search-input");
                input?.focus();
              }, 100);
            },
          },
        ].map((card) => (
          <button
            key={card.title}
            onClick={card.onClick}
            className="group relative overflow-hidden rounded-xl border border-border bg-card text-left shadow-sm transition-all duration-300 hover:shadow-lg hover:border-primary/30 hover:-translate-y-1 focus:outline-none focus:ring-2 focus:ring-primary/40 min-w-0"
          >
            <div className="aspect-[16/9] overflow-hidden">
              <img
                src={card.image}
                alt={card.title}
                className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-2 sm:p-4">
              <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5">
                <card.icon className="h-4 w-4 sm:h-6 sm:w-6 text-white/90 shrink-0" />
                <h3 className="text-sm sm:text-lg font-bold text-white font-display tracking-tight truncate">{card.title}</h3>
              </div>
              <p className="text-xs sm:text-sm text-white/70 truncate">{card.description}</p>
            </div>
          </button>
        ))}
      </div>

      {/* Standalone Tax Return Upload Dialog */}
      <TaxReturnUpload
        mode="populate"
        onCompanyCreated={(id) => {
          queryClient.invalidateQueries({ queryKey: ["companies"] });
          setTaxReturnOpen(false);
          navigate(`/company/${id}`);
        }}
        trigger={<span />}
        externalOpen={taxReturnOpen}
        onExternalOpenChange={setTaxReturnOpen}
      />

      {/* AI Compliance Summary */}
      <AIComplianceSummary />

      <div id="companies-section" />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-xl font-bold tracking-tight">Client Companies</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {companies.length} client{companies.length !== 1 ? "s" : ""} on file
          </p>
        </div>

        <Button size="sm" onClick={() => setDialogOpen(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add Company
        </Button>

        <CreateCompanyWizard open={dialogOpen} onOpenChange={setDialogOpen} />
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="company-search-input"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search companies..."
            className="pl-8 h-9 text-sm"
          />
        </div>
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-full sm:w-40 h-9 text-sm">
            <SelectValue placeholder="All types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            {ENTITY_TYPES.map((t) => (
              <SelectItem key={t} value={t}>{t}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Companies Table */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-16 text-center">
            <Building2 className="mb-3 h-10 w-10 text-muted-foreground/30" />
            <h3 className="font-display text-base font-semibold">No companies yet</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Add your first client company to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-hidden rounded-lg">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50 hover:bg-muted/50">
                    <TableHead className="font-semibold text-xs">Company Name</TableHead>
                    <TableHead className="text-xs">Type</TableHead>
                    <TableHead className="text-xs">State</TableHead>
                    <TableHead className="text-xs">Inc. Date</TableHead>
                    <TableHead className="text-xs">Fiscal Year End</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="w-10"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((company) => (
                    <TableRow
                      key={company.id}
                      className="cursor-pointer group"
                      onClick={() => navigate(`/company/${company.id}`)}
                    >
                      <TableCell className="font-medium text-sm">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/8 shrink-0">
                            <Building2 className="h-3.5 w-3.5 text-primary" />
                          </div>
                          {company.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{company.entity_type}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{company.state_of_incorporation || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {company.incorporation_date
                          ? new Date(company.incorporation_date + "T00:00:00").toLocaleDateString()
                          : "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{company.fiscal_year_end || "—"}</TableCell>
                      <TableCell>{statusBadge(company.status)}</TableCell>
                      <TableCell>
                        <ChevronRight className="h-4 w-4 text-muted-foreground/30 group-hover:text-primary transition-colors" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function AIComplianceSummary() {
  const { data, isLoading } = useQuery({
    queryKey: ["ai_compliance_summary"],
    queryFn: async () => {
      const [systemsRes, incidentsRes, logsRes] = await Promise.all([
        supabase.from("ai_systems").select("id, status", { count: "exact" }),
        supabase.from("ai_risk_incidents").select("id, status", { count: "exact" }).in("status", ["open", "investigating"]),
        supabase.from("ai_usage_logs").select("id, review_decision", { count: "exact" }).is("review_decision", null),
      ]);
      return {
        totalSystems: systemsRes.count ?? 0,
        activeSystems: (systemsRes.data || []).filter(s => s.status === "active").length,
        openIncidents: incidentsRes.count ?? 0,
        pendingReviews: logsRes.count ?? 0,
      };
    },
  });

  if (isLoading || !data) return null;
  if (data.totalSystems === 0 && data.openIncidents === 0 && data.pendingReviews === 0) return null;

  const stats = [
    { label: "AI Systems", value: data.activeSystems, sub: `${data.totalSystems} total`, icon: Bot, color: "text-primary" },
    { label: "Open Incidents", value: data.openIncidents, sub: "need attention", icon: AlertTriangle, color: data.openIncidents > 0 ? "text-destructive" : "text-success" },
    { label: "Pending Reviews", value: data.pendingReviews, sub: "awaiting decision", icon: ClipboardCheck, color: data.pendingReviews > 0 ? "text-yellow-600" : "text-success" },
  ];

  return (
    <div className="space-y-2">
      <h2 className="text-sm font-semibold text-muted-foreground">EU AI Act Compliance</h2>
      <div className="grid grid-cols-3 gap-2 sm:gap-3">
        {stats.map(s => (
          <Card key={s.label} className="relative overflow-hidden">
            <CardContent className="p-3 sm:p-4 flex items-center gap-3">
              <div className={`shrink-0 ${s.color}`}>
                <s.icon className="h-5 w-5 sm:h-6 sm:w-6" />
              </div>
              <div className="min-w-0">
                <p className="text-lg sm:text-2xl font-bold leading-none">{s.value}</p>
                <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
