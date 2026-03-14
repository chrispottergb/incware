import USComplianceTracker from "./ai-compliance/USComplianceTracker";

interface Props {
  companyId: string;
  companyName: string;
}

export default function AIComplianceTab({ companyId, companyName }: Props) {
  return <USComplianceTracker />;
}
