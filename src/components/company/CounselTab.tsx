import CounselSection from "./counsel/CounselSection";
import { ATTORNEY_CONFIG, ACCOUNTANT_CONFIG } from "./counsel/config";

interface CounselTabProps {
  companyId: string;
}

/**
 * Firms and Counsel — attorneys and accountants, each rendered as firm cards
 * with nested people plus standalone solo-practitioner cards.
 */
export default function CounselTab({ companyId }: CounselTabProps) {
  return (
    <div className="space-y-8">
      <CounselSection companyId={companyId} config={ATTORNEY_CONFIG} />
      <CounselSection companyId={companyId} config={ACCOUNTANT_CONFIG} />
    </div>
  );
}
