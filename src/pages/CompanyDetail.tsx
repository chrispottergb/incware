import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";
import IncorporationTab from "@/components/company/IncorporationTab";
import OrganizationTab from "@/components/company/OrganizationTab";
import MeetingsTab from "@/components/company/MeetingsTab";
import ShareholdersTab from "@/components/company/ShareholdersTab";
import StockCertificatesTab from "@/components/company/StockCertificatesTab";
import StockLedgerTab from "@/components/company/StockLedgerTab";
import BillsOfSaleTab from "@/components/company/BillsOfSaleTab";
import TimelineTab from "@/components/company/TimelineTab";

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const hashTab = location.hash.replace("#", "") || "incorporation";

  const handleTabChange = (value: string) => {
    navigate(`#${value}`, { replace: true });
  };

  const { data: company, isLoading } = useQuery({
    queryKey: ["company", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Building2 className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">Company not found.</p>
        <Button variant="outline" size="sm" onClick={() => navigate("/")}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const statusColor =
    company.status === "active"
      ? "bg-success/10 text-success border-success/20"
      : "bg-muted text-muted-foreground border-muted";

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/")}
          className="mt-0.5 shrink-0 h-8 w-8"
        >
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2.5 flex-wrap">
            <h1 className="font-display text-xl font-bold tracking-tight truncate">
              {company.name}
            </h1>
            <Badge variant="outline" className={`${statusColor} text-[10px] px-1.5 py-0`}>
              {company.status === "active" ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {company.entity_type}
            {company.state_of_incorporation && ` · ${company.state_of_incorporation}`}
            {company.incorporation_date &&
              ` · Inc. ${new Date(company.incorporation_date + "T00:00:00").toLocaleDateString()}`}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={hashTab} onValueChange={handleTabChange} className="w-full">
        <div className="border-b border-border">
          <TabsList className="h-auto w-full justify-start gap-0 rounded-none bg-transparent p-0">
            {[
              { value: "incorporation", label: "Incorporation Info" },
              { value: "organization", label: "Organizational Info" },
              { value: "meetings", label: "Meetings" },
              { value: "shareholders", label: "Shareholders & Stock" },
              { value: "timeline", label: "Timeline" },
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="relative rounded-none border-b-2 border-transparent px-4 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="incorporation" className="mt-5">
          <IncorporationTab company={company} />
        </TabsContent>
        <TabsContent value="organization" className="mt-5">
          <OrganizationTab companyId={company.id} company={company} />
        </TabsContent>
        <TabsContent value="meetings" className="mt-5">
          <MeetingsTab companyId={company.id} company={company} />
        </TabsContent>
        <TabsContent value="shareholders" className="mt-5">
          <div className="space-y-5">
            <ShareholdersTab companyId={company.id} />
            <StockCertificatesTab companyId={company.id} />
            <StockLedgerTab companyId={company.id} entityType={company.entity_type} />
            <BillsOfSaleTab companyId={company.id} />
          </div>
        </TabsContent>
        <TabsContent value="timeline" className="mt-5">
          <TimelineTab companyId={company.id} company={company} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
