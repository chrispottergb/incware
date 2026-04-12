import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AISystemsRegistry from "./ai-compliance/AISystemsRegistry";
import AIOversightPersons from "./ai-compliance/AIOversightPersons";
import AIUsageLog from "./ai-compliance/AIUsageLog";
import AIRiskIncidents from "./ai-compliance/AIRiskIncidents";
import AIComplianceDocs from "./ai-compliance/AIComplianceDocs";

interface Props {
  companyId: string;
  companyName: string;
}

export default function AIComplianceTab({ companyId, companyName }: Props) {
  return (
    <Tabs defaultValue="systems" className="w-full">
      <TabsList>
        <TabsTrigger value="systems">AI Systems</TabsTrigger>
        <TabsTrigger value="oversight">Oversight</TabsTrigger>
        <TabsTrigger value="usage">Usage Log</TabsTrigger>
        <TabsTrigger value="incidents">Risk Incidents</TabsTrigger>
        <TabsTrigger value="documents">Documents</TabsTrigger>
      </TabsList>

      <TabsContent value="systems">
        <AISystemsRegistry companyId={companyId} />
      </TabsContent>
      <TabsContent value="oversight">
        <AIOversightPersons companyId={companyId} />
      </TabsContent>
      <TabsContent value="usage">
        <AIUsageLog companyId={companyId} />
      </TabsContent>
      <TabsContent value="incidents">
        <AIRiskIncidents companyId={companyId} />
      </TabsContent>
      <TabsContent value="documents">
        <AIComplianceDocs companyId={companyId} />
      </TabsContent>
    </Tabs>
  );
}
