import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { DatePickerField } from "@/components/ui/date-picker-field";
import { Eye, Download, Loader2, Save, X } from "lucide-react";
import { EntityPartyPicker } from "./EntityPartyPicker";
import { ClassificationBanner } from "./ClassificationBanner";
import { ExpenseMatrix } from "./ExpenseMatrix";
import { MarketRentField } from "./MarketRentField";
import { LeaseClausesEditor } from "./LeaseClausesEditor";
import { useLeaseClassification } from "@/hooks/useLeaseClassification";
import { LEASE_STRUCTURE_LABELS } from "@/lib/lease-risk";
import type { LeaseClassification, LeaseParty } from "@/lib/lease-classification";

export interface LeasePart2Form {
  lease_date: string;
  lease_term: string;
  landlord_name: string;
  landlord_address: string;
  lease_structure: string;
  expense_taxes_party: string;
  expense_insurance_party: string;
  expense_maintenance_party: string;
  market_rent_justified: boolean;
  market_rent_note: string;
  percentage_rent_pct: string;
  percentage_rent_basis: string;
  full_service_inclusions: string;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  companyId: string;
  editId: string | null;
  form: LeasePart2Form;
  onFormChange: (patch: Partial<LeasePart2Form>) => void;
  landlordParty: LeaseParty;
  tenantParty: LeaseParty;
  onLandlordChange: (p: LeaseParty) => void;
  onTenantChange: (p: LeaseParty) => void;
  override: LeaseClassification | null;
  onOverrideChange: (next: LeaseClassification | null) => void;
  onSave: () => void;
  onPreview: () => void;
  onDownload: () => void;
  isSaving: boolean;
  onEditTypeFromPart1: () => void;
}

export function GenerateLeaseModal({
  open,
  onOpenChange,
  companyId,
  editId,
  form,
  onFormChange,
  landlordParty,
  tenantParty,
  onLandlordChange,
  onTenantChange,
  override,
  onOverrideChange,
  onSave,
  onPreview,
  onDownload,
  isSaving,
  onEditTypeFromPart1,
}: Props) {
  const classification = useLeaseClassification({
    landlord: landlordParty,
    tenant: tenantParty,
    currentCompanyId: companyId,
    override,
  });

  const isRequired =
    classification.classification === "self_rental" || classification.classification === "intercompany";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="font-display text-base">Generate Lease Document</DialogTitle>
            <div className="flex items-center gap-2 mr-6">
              <Badge variant="outline" className="text-[11px]">
                {LEASE_STRUCTURE_LABELS[form.lease_structure] || "Modified Gross"}
              </Badge>
              <Button type="button" variant="ghost" size="sm" className="h-6 text-[11px] px-2" onClick={onEditTypeFromPart1}>
                Edit type
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-3">
          {/* Signing Details */}
          <div className="rounded-md border border-border p-3 space-y-2 bg-card">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Signing Details</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="field-group">
                <Label className="field-label">Lease Date (Signed)</Label>
                <DatePickerField value={form.lease_date} onChange={(v) => onFormChange({ lease_date: v })} />
              </div>
              <div className="field-group">
                <Label className="field-label">Lease Term</Label>
                <Input
                  className="h-8 text-sm"
                  value={form.lease_term}
                  onChange={(e) => onFormChange({ lease_term: e.target.value })}
                  placeholder="e.g. 12 months"
                />
              </div>
            </div>
          </div>

          {/* Parties */}
          <div className="grid grid-cols-2 gap-3">
            <EntityPartyPicker
              label="Landlord"
              currentCompanyId={companyId}
              value={landlordParty}
              onChange={(p) => {
                onLandlordChange(p);
                if ((p.kind === "company" || p.kind === "individual") && p.name) {
                  onFormChange({ landlord_name: p.name });
                }
              }}
              externalName={form.landlord_name}
              onExternalNameChange={(v) => onFormChange({ landlord_name: v })}
              externalAddress={form.landlord_address}
              onExternalAddressChange={(v) => onFormChange({ landlord_address: v })}
            />
            <EntityPartyPicker
              label="Tenant"
              currentCompanyId={companyId}
              value={tenantParty}
              onChange={onTenantChange}
              externalName=""
              onExternalNameChange={() => {}}
            />
          </div>

          {landlordParty.kind !== "external" && (
            <div className="field-group">
              <Label className="field-label">Landlord Address (for lease document)</Label>
              <Input
                className="h-8 text-sm"
                value={form.landlord_address}
                onChange={(e) => onFormChange({ landlord_address: e.target.value })}
                placeholder="Street, City, State ZIP"
              />
            </div>
          )}

          {/* Classification */}
          <ClassificationBanner
            classification={classification.classification}
            reason={classification.reason}
            overridden={!!override}
            onOverride={onOverrideChange}
          />

          {/* Structure & Expenses */}
          <ExpenseMatrix
            structure={form.lease_structure}
            taxes={form.expense_taxes_party}
            insurance={form.expense_insurance_party}
            maintenance={form.expense_maintenance_party}
            percentageRentPct={form.percentage_rent_pct}
            percentageRentBasis={form.percentage_rent_basis}
            fullServiceInclusions={form.full_service_inclusions}
            onChange={(patch) => onFormChange({
              ...(patch.structure !== undefined && { lease_structure: patch.structure }),
              ...(patch.taxes !== undefined && { expense_taxes_party: patch.taxes }),
              ...(patch.insurance !== undefined && { expense_insurance_party: patch.insurance }),
              ...(patch.maintenance !== undefined && { expense_maintenance_party: patch.maintenance }),
              ...(patch.percentageRentPct !== undefined && { percentage_rent_pct: patch.percentageRentPct }),
              ...(patch.percentageRentBasis !== undefined && { percentage_rent_basis: patch.percentageRentBasis }),
              ...(patch.fullServiceInclusions !== undefined && { full_service_inclusions: patch.fullServiceInclusions }),
            })}
          />

          {/* Market Rent (only for non-standard) */}
          {classification.classification !== "standard" && (
            <MarketRentField
              justified={form.market_rent_justified}
              note={form.market_rent_note}
              onJustifiedChange={(v) => onFormChange({ market_rent_justified: v })}
              onNoteChange={(v) => onFormChange({ market_rent_note: v })}
              required={isRequired}
            />
          )}

          {/* Custom clauses (edit mode only) */}
          {editId && <LeaseClausesEditor leaseId={editId} />}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
            <X className="h-3.5 w-3.5 mr-1" /> Close
          </Button>
          <Button type="button" variant="outline" onClick={onSave} disabled={isSaving}>
            {isSaving ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <Save className="h-3.5 w-3.5 mr-1" />}
            Save Details
          </Button>
          <Button type="button" variant="outline" onClick={onPreview} disabled={!editId}>
            <Eye className="h-3.5 w-3.5 mr-1" /> Preview Lease
          </Button>
          <Button type="button" onClick={onDownload} disabled={!editId}>
            <Download className="h-3.5 w-3.5 mr-1" /> Download PDF
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
