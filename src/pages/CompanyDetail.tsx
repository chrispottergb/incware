import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
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
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Company not found.</p>
        <Button variant="link" onClick={() => navigate("/")}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">
            {company.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            {company.entity_type}
            {company.state_of_incorporation && ` · ${company.state_of_incorporation}`}
          </p>
        </div>
        <span
          className={`ml-auto rounded-full px-3 py-1 text-xs font-medium ${
            company.status === "active"
              ? "bg-success/10 text-success"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {company.status === "active" ? "Active" : "Inactive"}
        </span>
      </div>

      <Tabs defaultValue="incorporation" className="w-full">
        <TabsList className="w-full justify-start border-b bg-transparent p-0">
          <TabsTrigger
            value="incorporation"
            className="rounded-none border-b-2 border-transparent px-4 pb-3 pt-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            Incorporation Info
          </TabsTrigger>
          <TabsTrigger
            value="organization"
            className="rounded-none border-b-2 border-transparent px-4 pb-3 pt-2 data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none"
          >
            Organizational Info
          </TabsTrigger>
        </TabsList>

        <TabsContent value="incorporation" className="mt-6">
          <IncorporationTab company={company} />
        </TabsContent>
        <TabsContent value="organization" className="mt-6">
          <OrganizationTab companyId={company.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
