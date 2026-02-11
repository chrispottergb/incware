import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Building2, Loader2 } from "lucide-react";
import IncorporationTab from "@/components/company/IncorporationTab";
import OrganizationTab from "@/components/company/OrganizationTab";

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: company, isLoading } = useQuery({
    queryKey: ["company", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("companies")
        .select("*")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!company) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-3">
        <Building2 className="h-12 w-12 text-muted-foreground/40" />
        <p className="text-muted-foreground">Company not found.</p>
        <Button variant="outline" onClick={() => navigate("/")}>
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
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-start gap-4">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate("/")}
          className="mt-0.5 shrink-0"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="font-display text-2xl font-bold tracking-tight truncate">
              {company.name}
            </h1>
            <Badge variant="outline" className={statusColor}>
              {company.status === "active" ? "Active" : "Inactive"}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {company.entity_type}
            {company.state_of_incorporation && ` · ${company.state_of_incorporation}`}
            {company.incorporation_date &&
              ` · Inc. ${new Date(company.incorporation_date + "T00:00:00").toLocaleDateString()}`}
          </p>
        </div>
      </div>

      {/* Tabs — matching original IncWare tab structure */}
      <Tabs defaultValue="incorporation" className="w-full">
        <div className="border-b border-border">
          <TabsList className="h-auto w-full justify-start gap-0 rounded-none bg-transparent p-0">
            {[
              { value: "incorporation", label: "Incorporation Info" },
              { value: "organization", label: "Organizational Info" },
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="relative rounded-none border-b-2 border-transparent px-4 py-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
              >
                {tab.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <TabsContent value="incorporation" className="mt-6">
          <IncorporationTab company={company} />
        </TabsContent>
        <TabsContent value="organization" className="mt-6">
          <OrganizationTab companyId={company.id} company={company} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
