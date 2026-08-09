import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  certificateNumberFromLabel,
  normalizeShareClassKey,
  parseQuantity,
  suggestNextCertificateNumber,
  type EntryTier,
  type QuantityBasis,
  type Reconciliation,
  type SnapshotLotInput,
} from "@/lib/ownership-snapshot";

const db = supabase as any;

export interface SnapshotHeaderInput {
  asOfDate: string;
  quantityBasis: QuantityBasis;
  entryTier: EntryTier;
  shareClassLabel: string;
  declaredTotal: number | null;
  highestCertificateNumberIssued: string;
  reconciliationNote: string;
  notes: string;
}

export interface LockContext {
  isLLC: boolean;
  parValue: number | null;
  reviewRows: Record<number, string>;
}

/**
 * Reads the snapshot state for an entity and performs the lock.
 *
 * The lock is the only place that writes to the authoritative ledger. It runs in
 * a strict order so a failure mid-way never leaves a locked snapshot pointing at
 * ledger rows that do not exist:
 *   1. holders  2. certificates  3. opening-balance ledger rows
 *   4. audit lots (linked to the ledger rows)  5. retired records
 *   6. snapshot flipped to `locked` (a DB trigger makes it immutable from here)
 */
export function useOwnershipSnapshot(companyId: string, enabled = true) {
  const queryClient = useQueryClient();

  const snapshotQuery = useQuery({
    queryKey: ["ownership_snapshots", companyId],
    queryFn: async () => {
      const { data, error } = await db
        .from("ownership_snapshots")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!companyId && enabled,
  });

  const snapshots = snapshotQuery.data ?? [];
  const lockedSnapshot = snapshots.find((s) => s.status === "locked") ?? null;
  const draftSnapshot = snapshots.find((s) => s.status === "draft") ?? null;

  const lotsQuery = useQuery({
    queryKey: ["ownership_snapshot_lots", lockedSnapshot?.id],
    queryFn: async () => {
      const { data, error } = await db
        .from("ownership_snapshot_lots")
        .select("*")
        .eq("snapshot_id", lockedSnapshot!.id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as any[];
    },
    enabled: !!lockedSnapshot?.id,
  });

  const lock = useMutation({
    mutationFn: async (args: {
      header: SnapshotHeaderInput;
      lots: SnapshotLotInput[];
      reconciliation: Reconciliation;
      newOwnerNames: Record<string, string>;
      existingCertificateNumbers: number[];
      ctx: LockContext;
    }) => {
      const { header, lots, reconciliation, newOwnerNames, existingCertificateNumbers, ctx } = args;
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const usable = lots
        .map((lot, index) => ({ lot, index }))
        .filter(({ lot }) => lot.ownerKey && parseQuantity(lot.quantity) > 0);

      // 0. Snapshot header (draft first, so lots always have a parent)
      const shareClassKey = normalizeShareClassKey(header.shareClassLabel);
      const suggestedNext = suggestNextCertificateNumber(
        existingCertificateNumbers,
        usable.map(({ lot }) => lot.certificateLabel)
      );

      const snapshotPayload = {
        company_id: companyId,
        share_class_key: shareClassKey,
        share_class_label: header.shareClassLabel,
        as_of_date: header.asOfDate,
        quantity_basis: header.quantityBasis,
        entry_tier: header.entryTier,
        declared_total: reconciliation.declaredTotal,
        highest_certificate_number_issued: header.highestCertificateNumberIssued || null,
        suggested_next_certificate_number: String(suggestedNext),
        reconciliation_note: header.reconciliationNote || null,
        notes: header.notes || null,
        status: "draft",
      };

      let snapshotId = draftSnapshot?.id as string | undefined;
      if (snapshotId) {
        const { error } = await db.from("ownership_snapshots").update(snapshotPayload).eq("id", snapshotId);
        if (error) throw error;
        await db.from("ownership_snapshot_lots").delete().eq("snapshot_id", snapshotId);
        await db.from("retired_ownership_records").delete().eq("snapshot_id", snapshotId);
      } else {
        const { data, error } = await db
          .from("ownership_snapshots")
          .insert(snapshotPayload)
          .select("id")
          .single();
        if (error) throw error;
        snapshotId = data.id as string;
      }

      // 1. Holders — created once per new owner key, never matched by name.
      const ownerIdByKey = new Map<string, string>();
      for (const key of Array.from(new Set(usable.map(({ lot }) => lot.ownerKey)))) {
        if (!key.startsWith("new:")) {
          ownerIdByKey.set(key, key);
          continue;
        }
        const name = (newOwnerNames[key] || "").trim();
        const { data, error } = await supabase
          .from("shareholders")
          .insert({
            company_id: companyId,
            name,
            num_shares: 0,
            share_class: header.shareClassLabel,
          } as any)
          .select("id")
          .single();
        if (error) throw error;
        ownerIdByKey.set(key, data.id);
      }

      // 2/3. Certificates + paired opening-balance ledger rows
      const taken = new Set<number>([
        ...existingCertificateNumbers,
        ...usable
          .map(({ lot }) => certificateNumberFromLabel(lot.certificateLabel))
          .filter((n): n is number => n !== null),
      ]);
      let cursor = 1;
      const nextFree = () => {
        while (taken.has(cursor)) cursor++;
        taken.add(cursor);
        return cursor;
      };

      const holderTotals = new Map<string, number>();
      const lotRows: any[] = [];
      const retiredRows: any[] = [];

      for (const { lot, index } of usable) {
        const holderId = ownerIdByKey.get(lot.ownerKey)!;
        const holderName = lot.ownerKey.startsWith("new:")
          ? (newOwnerNames[lot.ownerKey] || "").trim()
          : lot.holderName;
        const quantity = parseQuantity(lot.quantity);
        const originalDate = lot.certificateDate || lot.acquiredDate || header.asOfDate;
        const certNumber = certificateNumberFromLabel(lot.certificateLabel) ?? nextFree();
        const surrendered = lot.status === "surrendered";

        const { data: cert, error: certError } = await supabase
          .from("stock_certificates")
          .insert({
            company_id: companyId,
            shareholder_id: holderId,
            share_class: header.shareClassLabel,
            num_shares: quantity,
            status: surrendered ? "cancelled" : "active",
            issue_date: originalDate,
            certificate_number: certNumber,
            certificate_label: lot.certificateLabel.trim() || null,
            par_value: ctx.parValue,
            ...(surrendered
              ? {
                  cancelled_date: header.asOfDate,
                  cancelled_reason:
                    lot.notes.trim() || "Surrendered prior to onboarding — retained as historical evidence",
                }
              : {}),
          } as any)
          .select("id, certificate_number")
          .single();
        if (certError) throw certError;

        if (surrendered) {
          // Display-only archive. Surrendered lots never reach the ledger, so they
          // can never affect any ownership math downstream.
          retiredRows.push({
            snapshot_id: snapshotId,
            company_id: companyId,
            certificate_number: cert.certificate_number,
            certificate_label: lot.certificateLabel.trim() || null,
            holder_name: holderName,
            quantity,
            issue_date: originalDate,
            surrender_date: header.asOfDate,
            reason: lot.notes.trim() || null,
          });
          lotRows.push(buildLotRow({ snapshotId, companyId, holderId, holderName, quantity, lot, index, certNumber: cert.certificate_number, ctx, ledgerId: null }));
          continue;
        }

        holderTotals.set(holderId, (holderTotals.get(holderId) || 0) + quantity);

        const { data: ledger, error: ledgerError } = await supabase
          .from("share_transactions")
          .insert({
            company_id: companyId,
            shareholder_id: holderId,
            transaction_type: ctx.isLLC ? "membership_issuance" : "initial_issuance",
            entry_type: "opening_balance",
            share_class: header.shareClassLabel,
            num_shares: quantity,
            transaction_date: originalDate,
            effective_date: originalDate,
            to_shareholder: holderName,
            from_shareholder: "Pre-existing Ownership",
            certificate_id: cert.id,
            issued_certificate_number: cert.certificate_number,
            certificate_label: lot.certificateLabel.trim() || null,
            par_value: ctx.parValue,
            notes:
              lot.notes.trim() ||
              `Opening ownership snapshot as of ${header.asOfDate} (originally dated ${originalDate})`,
          } as any)
          .select("id")
          .single();
        if (ledgerError) throw ledgerError;

        lotRows.push(
          buildLotRow({
            snapshotId,
            companyId,
            holderId,
            holderName,
            quantity,
            lot,
            index,
            certNumber: cert.certificate_number,
            ctx,
            ledgerId: ledger.id,
          })
        );
      }

      // 4/5. Audit evidence
      if (lotRows.length) {
        const { error } = await db.from("ownership_snapshot_lots").insert(lotRows);
        if (error) throw error;
      }
      if (retiredRows.length) {
        const { error } = await db.from("retired_ownership_records").insert(retiredRows);
        if (error) throw error;
      }

      // Holder totals + the entity's back-dating lock
      for (const [holderId, total] of holderTotals) {
        await supabase.from("shareholders").update({ num_shares: total } as any).eq("id", holderId);
      }
      const { error: companyError } = await supabase
        .from("companies")
        .update({ opening_balance_date: header.asOfDate } as any)
        .eq("id", companyId);
      if (companyError) throw companyError;

      await supabase.rpc("recalculate_ownership_percentages" as any, { p_company_id: companyId });

      // 6. Seal it — the DB trigger rejects any later edit to a locked snapshot.
      const { error: lockError } = await db
        .from("ownership_snapshots")
        .update({
          status: "locked",
          locked_at: new Date().toISOString(),
          locked_by: user.id,
          declared_total: reconciliation.declaredTotal,
        })
        .eq("id", snapshotId);
      if (lockError) throw lockError;

      return { snapshotId, suggestedNext };
    },
    onSuccess: async () => {
      for (const key of [
        ["ownership_snapshots", companyId],
        ["shareholders", companyId],
        ["shareholders-establish", companyId],
        ["shareholders-for-holdings", companyId],
        ["share_transactions", companyId],
        ["stock_certificates", companyId],
        ["stock_certificates_numbers", companyId],
        ["stock_certificates_ledger", companyId],
        ["company", companyId],
        ["company-establish", companyId],
        ["company-authorized-shares", companyId],
      ]) {
        await queryClient.invalidateQueries({ queryKey: key });
      }
    },
  });

  return {
    snapshots,
    lockedSnapshot,
    draftSnapshot,
    lockedLots: lotsQuery.data ?? [],
    isLoading: snapshotQuery.isLoading,
    lock,
  };
}

function buildLotRow(args: {
  snapshotId?: string;
  companyId: string;
  holderId: string;
  holderName: string;
  quantity: number;
  lot: SnapshotLotInput;
  index: number;
  certNumber: number;
  ctx: LockContext;
  ledgerId: string | null;
}) {
  const { snapshotId, companyId, holderId, holderName, quantity, lot, index, certNumber, ctx, ledgerId } = args;
  const reviewReason = ctx.reviewRows[index];
  return {
    snapshot_id: snapshotId,
    company_id: companyId,
    shareholder_id: holderId,
    holder_name_as_entered: holderName,
    entered_quantity: quantity,
    certificate_number: certNumber,
    certificate_label: lot.certificateLabel.trim() || null,
    certificate_date: lot.certificateDate || null,
    acquired_date: lot.acquiredDate || null,
    acquisition_type: lot.acquisitionType,
    transferor_description: lot.transferorDescription.trim() || null,
    status: lot.status,
    needs_review: !!reviewReason,
    review_reason: reviewReason || null,
    share_transaction_id: ledgerId,
    notes: lot.notes.trim() || null,
  };
}
