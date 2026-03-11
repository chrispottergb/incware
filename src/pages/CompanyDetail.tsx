import { useState, useMemo, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ArrowLeft, Building2, Loader2, Trash2, ArrowRightLeft, Power } from "lucide-react";
import { toast } from "sonner";
import IncorporationTab from "@/components/company/IncorporationTab";
import OrganizationTab from "@/components/company/OrganizationTab";
import MeetingsTab from "@/components/company/MeetingsTab";
import ShareholdersTab from "@/components/company/ShareholdersTab";
import StockCertificatesTab from "@/components/company/StockCertificatesTab";
import StockLedgerTab from "@/components/company/StockLedgerTab";
import BillsOfSaleTab from "@/components/company/BillsOfSaleTab";
import TimelineTab from "@/components/company/TimelineTab";
import AIComplianceTab from "@/components/company/AIComplianceTab";
import RecordBookGenerator from "@/components/company/RecordBookGenerator";
import OperatingAgreementGenerator from "@/components/company/OperatingAgreementGenerator";
import BylawsGenerator from "@/components/company/BylawsGenerator";
import NonprofitBylawsGenerator from "@/components/company/NonprofitBylawsGenerator";
import ConflictOfInterestGenerator from "@/components/company/ConflictOfInterestGenerator";
import SMOperatingAgreementGenerator from "@/components/company/SMOperatingAgreementGenerator";
import CounselTab from "@/components/company/CounselTab";
import BanksTab from "@/components/company/BanksTab";
import RelationshipsTab from "@/components/company/RelationshipsTab";
import LeasesTab from "@/components/company/LeasesTab";
import BuySellWorkflow from "@/components/company/BuySellWorkflow";
import TransferLedgerTab from "@/components/company/TransferLedgerTab";
import DocumentsTab from "@/components/company/DocumentsTab";
import UnifiedLedgerTab from "@/components/company/UnifiedLedgerTab";
import { getTerminology, isLLCType } from "@/lib/entity-terminology";
import { useShareCalculations } from "@/hooks/useShareCalculations";

export default function CompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const rawHashTab = location.hash.replace("#", "");

  const [deleteStep, setDeleteStep] = useState<0 | 1 | 2>(0);
  const [deleting, setDeleting] = useState(false);
  const [buySellOpen, setBuySellOpen] = useState(false);

  const handleTabChange = (value: string) => {
    navigate(`#${value}`, { replace: true });
  };

  const handleDelete = async () => {
    if (!id) return;
    setDeleting(true);
    try {
      const { error } = await supabase.from("companies").delete().eq("id", id);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Company and all associated data have been permanently deleted.");
      navigate("/");
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to delete company");
    } finally {
      setDeleting(false);
      setDeleteStep(0);
    }
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

  const shareCalc = useShareCalculations(id || "");
  const entityType = company?.entity_type;
  const isLLC = isLLCType(entityType);
  const defaultTab = isLLC ? "organization" : "incorporation";

  // Valid tab values for LLC vs non-LLC to prevent reversion
  const LLC_TABS = ["organization", "meetings", "shareholders", "timeline", "leases", "counsel", "banks", "relationships", "ai-compliance", "operating-agreement", "record-book", "documents"];
  const validLLCTab = isLLC && rawHashTab && !LLC_TABS.includes(rawHashTab);
  const hashTab = (!rawHashTab || (rawHashTab === "incorporation" && isLLC) || validLLCTab) ? defaultTab : rawHashTab;

  useEffect(() => {
    if (!isLLC) return;
    if (!rawHashTab || rawHashTab === "incorporation" || !LLC_TABS.includes(rawHashTab)) {
      navigate("#organization", { replace: true });
    }
  }, [isLLC, rawHashTab, navigate]);

  // Memoize tab configuration to prevent unnecessary re-renders that cause tab reversion
  const tabConfig = useMemo(() => {
    if (isLLC) {
      return [
        { value: "organization", label: "Organizational Info" },
        { value: "meetings", label: "Meetings" },
        { value: "shareholders", label: "Membership Interest/Units" },
        { value: "timeline", label: "Timeline" },
        { value: "leases", label: "Leases" },
        { value: "counsel", label: "Counsel" },
        { value: "banks", label: "Bank" },
        { value: "relationships", label: "Relationships" },
        { value: "ai-compliance", label: "AI Compliance" },
        { value: "operating-agreement", label: "Operating Agreement" },
        { value: "record-book", label: "Record Book" },
      ];
    }
    const isCorp = entityType === "Corporation" || entityType === "S-Corp";
    const tabs = [
      { value: "incorporation", label: "Incorporation Info" },
      ...(!isCorp ? [{ value: "organization", label: "Organizational Info" }] : []),
      { value: "meetings", label: "Meetings" },
      { value: "shareholders", label: getTerminology(entityType).shareholdersTab },
      { value: "timeline", label: "Timeline" },
      { value: "leases", label: "Leases" },
      { value: "counsel", label: "Counsel" },
      { value: "banks", label: "Banks" },
      { value: "relationships", label: "Relationships" },
      { value: "ai-compliance", label: "AI Compliance" },
    ];
    if (entityType === "Corporation" || entityType === "S-Corp") {
      tabs.push({ value: "bylaws", label: "Bylaws" });
    }
    if (entityType === "Non-Profit") {
      tabs.push({ value: "nonprofit-bylaws", label: "Bylaws" });
      tabs.push({ value: "conflict-of-interest", label: "Conflict of Interest" });
    }
    tabs.push({ value: "record-book", label: "Record Book" });
    return tabs;
  }, [isLLC, entityType]);

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

  const isCorp = company.entity_type === "Corporation" || company.entity_type === "S-Corp";

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
            <Badge 
              variant="outline" 
              className={`${statusColor} text-[10px] px-1.5 py-0 cursor-pointer hover:opacity-80 transition-opacity`}
              onClick={async () => {
                const newStatus = company.status === "active" ? "inactive" : "active";
                const { error } = await supabase
                  .from("companies")
                  .update({ status: newStatus })
                  .eq("id", company.id);
                if (error) {
                  toast.error("Failed to update status");
                } else {
                  queryClient.invalidateQueries({ queryKey: ["company", company.id] });
                  queryClient.invalidateQueries({ queryKey: ["companies"] });
                  toast.success(`Client marked as ${newStatus}`);
                }
              }}
              title={`Click to mark as ${company.status === "active" ? "inactive" : "active"}`}
            >
              <Power className="h-2.5 w-2.5 mr-1" />
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
        <Button
          variant="ghost"
          size="icon"
          onClick={() => setDeleteStep(1)}
          className="mt-0.5 shrink-0 h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
          title="Delete company"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>

      {/* Delete Confirmation Step 1 */}
      <AlertDialog open={deleteStep === 1} onOpenChange={(open) => !open && setDeleteStep(0)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{company.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete this company and all associated records including meetings, financials, shareholders, stock certificates, assets, and documents.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); setDeleteStep(2); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Continue
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Step 2 */}
      <AlertDialog open={deleteStep === 2} onOpenChange={(open) => !open && setDeleteStep(0)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure? This is permanent.</AlertDialogTitle>
            <AlertDialogDescription>
              All data for <span className="font-semibold text-foreground">{company.name}</span> will be permanently lost and cannot be recovered. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Go Back</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => { e.preventDefault(); handleDelete(); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={deleting}
            >
              {deleting ? <><Loader2 className="h-4 w-4 animate-spin mr-1.5" /> Deleting…</> : "Yes, Delete Permanently"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Tabs */}
      <Tabs value={hashTab} onValueChange={handleTabChange} className="w-full">
        <div className="border-b border-border">
          <TabsList className="h-auto w-full flex-wrap justify-center gap-0 rounded-none bg-transparent p-0">
            {tabConfig.map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="relative rounded-none border-b-2 border-transparent px-3 py-2.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground data-[state=active]:border-primary data-[state=active]:text-foreground data-[state=active]:bg-transparent data-[state=active]:shadow-none"
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
            {isCorp && shareCalc.authorizedShares != null && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center gap-6 text-xs">
                <div>
                  <span className="text-muted-foreground">Authorized:</span>{" "}
                  <span className="font-semibold">{shareCalc.authorizedShares.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Issued:</span>{" "}
                  <span className="font-semibold">{shareCalc.totalIssuedShares.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Available to Issue:</span>{" "}
                  <span className="font-semibold text-primary">{(shareCalc.availableShares ?? 0).toLocaleString()}</span>
                </div>
              </div>
            )}
            {isLLCType(company.entity_type) && shareCalc.totalIssuedShares > 0 && (
              <div className="rounded-lg border border-border bg-muted/30 p-3 flex items-center gap-6 text-xs">
                <div>
                  <span className="text-muted-foreground">Total Units Outstanding:</span>{" "}
                  <span className="font-semibold">{shareCalc.totalIssuedShares.toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Active Members:</span>{" "}
                  <span className="font-semibold">{Object.values(shareCalc.shareholderHoldings).filter(v => v > 0).length}</span>
                </div>
              </div>
            )}
            <div className="flex justify-end">
              <Button size="sm" onClick={() => setBuySellOpen(true)} className="h-8 text-xs">
                <ArrowRightLeft className="mr-1.5 h-3.5 w-3.5" />
                {isLLCType(company.entity_type) ? "Buy/Sell Interest/Units" : "Buy / Sell Shares"}
              </Button>
            </div>
            <ShareholdersTab companyId={company.id} entityType={company.entity_type} shareholderHoldings={shareCalc.shareholderHoldings} />
            {isLLCType(company.entity_type) ? (
              <>
                <UnifiedLedgerTab companyId={company.id} entityType={company.entity_type} authorizedShares={shareCalc.authorizedShares} />
                <div data-section="certificates">
                  <StockCertificatesTab companyId={company.id} entityType={company.entity_type} />
                </div>
                <BillsOfSaleTab companyId={company.id} entityType={company.entity_type} />
              </>
            ) : (
              <>
                <StockLedgerTab companyId={company.id} entityType={company.entity_type} />
                <div data-section="certificates">
                  <StockCertificatesTab companyId={company.id} entityType={company.entity_type} />
                </div>
                <TransferLedgerTab companyId={company.id} entityType={company.entity_type} authorizedShares={shareCalc.authorizedShares} />
                <BillsOfSaleTab companyId={company.id} entityType={company.entity_type} />
              </>
            )}
          </div>
          <BuySellWorkflow
            companyId={company.id}
            companyName={company.name}
            entityType={company.entity_type}
            open={buySellOpen}
            onOpenChange={setBuySellOpen}
            availableShares={shareCalc.availableShares}
          />
        </TabsContent>
        <TabsContent value="timeline" className="mt-5">
          <TimelineTab companyId={company.id} company={company} />
        </TabsContent>
        <TabsContent value="leases" className="mt-5">
          <LeasesTab companyId={company.id} companyName={company.name} companyAddress={[company.address, company.city, company.state, company.zip].filter(Boolean).join(", ")} />
        </TabsContent>
        <TabsContent value="counsel" className="mt-5">
          <CounselTab companyId={company.id} />
        </TabsContent>
        <TabsContent value="banks" className="mt-5">
          <BanksTab companyId={company.id} />
        </TabsContent>
        <TabsContent value="relationships" className="mt-5">
          <RelationshipsTab companyId={company.id} companyName={company.name} />
        </TabsContent>
        <TabsContent value="ai-compliance" className="mt-5">
          <AIComplianceTab companyId={company.id} companyName={company.name} />
        </TabsContent>
        {isLLC && (
          <TabsContent value="operating-agreement" className="mt-5">
            {company.entity_type === "Single Member LLC" ? (
              <SMOperatingAgreementGenerator companyId={company.id} companyName={company.name} company={company} />
            ) : (
              <OperatingAgreementGenerator companyId={company.id} companyName={company.name} company={company} />
            )}
          </TabsContent>
        )}
        {(company.entity_type === "Corporation" || company.entity_type === "S-Corp") && (
          <TabsContent value="bylaws" className="mt-5">
            <BylawsGenerator companyId={company.id} companyName={company.name} company={company} />
          </TabsContent>
        )}
        {company.entity_type === "Non-Profit" && (
          <>
            <TabsContent value="nonprofit-bylaws" className="mt-5">
              <NonprofitBylawsGenerator companyId={company.id} companyName={company.name} company={company} />
            </TabsContent>
            <TabsContent value="conflict-of-interest" className="mt-5">
              <ConflictOfInterestGenerator companyId={company.id} companyName={company.name} company={company} />
            </TabsContent>
          </>
        )}
        <TabsContent value="record-book" className="mt-5">
          <RecordBookGenerator companyId={company.id} companyName={company.name} entityType={company.entity_type} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
