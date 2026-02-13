import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { toast } from "sonner";
import AISystemsRegistry from "./ai-compliance/AISystemsRegistry";
import AIOversightPersons from "./ai-compliance/AIOversightPersons";
import AIUsageLog from "./ai-compliance/AIUsageLog";
import AIRiskIncidents from "./ai-compliance/AIRiskIncidents";
import AIComplianceDocs from "./ai-compliance/AIComplianceDocs";
import { exportAICompliancePDF, type AIComplianceData } from "@/lib/pdf-export";

interface Props {
  companyId: string;
  companyName: string;
}

export default function AIComplianceTab({ companyId, companyName }: Props) {
  const { data: systems = [] } = useQuery({
    queryKey: ["ai_systems", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("ai_systems").select("*").eq("company_id", companyId);
      if (error) throw error;
      return data;
    },
  });

  const handleExport = async () => {
    try {
      const sysIds = systems.map((s: any) => s.id);

      const [oversightRes, logsRes, incidentsRes] = await Promise.all([
        sysIds.length > 0
          ? supabase.from("ai_oversight_persons").select("*").in("ai_system_id", sysIds)
          : Promise.resolve({ data: [], error: null }),
        supabase.from("ai_usage_logs").select("*").eq("company_id", companyId).order("usage_date", { ascending: false }),
        supabase.from("ai_risk_incidents").select("*").eq("company_id", companyId).order("incident_date", { ascending: false }),
      ]);

      if (oversightRes.error) throw oversightRes.error;
      if (logsRes.error) throw logsRes.error;
      if (incidentsRes.error) throw incidentsRes.error;

      const getSystemName = (id: string) => systems.find((s: any) => s.id === id)?.system_name || "Unknown";

      const pdfData: AIComplianceData = {
        companyName,
        systems: systems.map((s: any) => ({
          system_name: s.system_name,
          provider: s.provider,
          risk_level: s.risk_level,
          status: s.status,
          deployment_date: s.deployment_date,
          purpose: s.purpose,
          data_categories: s.data_categories,
        })),
        oversightPersons: (oversightRes.data || []).map((p: any) => ({
          person_name: p.person_name,
          title: p.title,
          competence_description: p.competence_description,
          authority_scope: p.authority_scope,
          status: p.status,
          system_name: getSystemName(p.ai_system_id),
        })),
        usageLogs: (logsRes.data || []).map((l: any) => ({
          usage_date: l.usage_date,
          system_name: getSystemName(l.ai_system_id),
          usage_type: l.usage_type,
          description: l.description,
          human_reviewer: l.human_reviewer,
          review_decision: l.review_decision,
          affected_persons_notified: l.affected_persons_notified,
        })),
        incidents: (incidentsRes.data || []).map((i: any) => ({
          incident_date: i.incident_date,
          system_name: getSystemName(i.ai_system_id),
          severity: i.severity,
          status: i.status,
          description: i.description,
          reported_by: i.reported_by,
          provider_notified: i.provider_notified,
          authority_notified: i.authority_notified,
        })),
      };

      exportAICompliancePDF(pdfData);
      toast.success("AI compliance report exported");
    } catch (e: any) {
      toast.error(e.message || "Export failed");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">EU AI Act Compliance (Reg. 2024/1689)</h2>
        <Button size="sm" variant="outline" onClick={handleExport}>
          <FileDown className="h-3.5 w-3.5 mr-1" />Export Audit Report
        </Button>
      </div>

      <Tabs defaultValue="registry" className="w-full">
        <TabsList className="w-full justify-start">
          <TabsTrigger value="registry" className="text-xs">Systems Registry</TabsTrigger>
          <TabsTrigger value="oversight" className="text-xs">Human Oversight</TabsTrigger>
          <TabsTrigger value="usage" className="text-xs">Usage Log</TabsTrigger>
          <TabsTrigger value="incidents" className="text-xs">Risk & Incidents</TabsTrigger>
          <TabsTrigger value="docs" className="text-xs">Documents</TabsTrigger>
        </TabsList>

        <TabsContent value="registry"><AISystemsRegistry companyId={companyId} /></TabsContent>
        <TabsContent value="oversight"><AIOversightPersons companyId={companyId} /></TabsContent>
        <TabsContent value="usage"><AIUsageLog companyId={companyId} /></TabsContent>
        <TabsContent value="incidents"><AIRiskIncidents companyId={companyId} /></TabsContent>
        <TabsContent value="docs"><AIComplianceDocs companyId={companyId} /></TabsContent>
      </Tabs>
    </div>
  );
}
