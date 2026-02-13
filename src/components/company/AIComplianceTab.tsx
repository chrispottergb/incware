import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import AISystemsRegistry from "./ai-compliance/AISystemsRegistry";
import AIOversightPersons from "./ai-compliance/AIOversightPersons";
import AIUsageLog from "./ai-compliance/AIUsageLog";
import AIRiskIncidents from "./ai-compliance/AIRiskIncidents";
import AIComplianceDocs from "./ai-compliance/AIComplianceDocs";

interface Props {
  companyId: string;
}

export default function AIComplianceTab({ companyId }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <h2 className="text-sm font-semibold">EU AI Act Compliance (Reg. 2024/1689)</h2>
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
