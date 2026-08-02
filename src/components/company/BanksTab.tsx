import BanksSection from "./banks/BanksSection";

interface BanksTabProps {
  companyId: string;
}

/**
 * Bank accounts and authorized signers — each account is a card with its
 * signers nested underneath, mirroring the Firms and Counsel pattern.
 */
export default function BanksTab({ companyId }: BanksTabProps) {
  return <BanksSection companyId={companyId} />;
}
