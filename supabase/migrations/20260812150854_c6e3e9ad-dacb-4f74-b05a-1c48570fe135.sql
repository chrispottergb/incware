CREATE OR REPLACE FUNCTION public.amend_ownership_snapshot(
  p_company_id uuid,
  p_prior_snapshot_id uuid,
  p_as_of_date date,
  p_share_class_label text,
  p_quantity_basis text,
  p_entry_tier text,
  p_declared_total numeric,
  p_amendment_reason text,
  p_source_document_id uuid,
  p_is_llc boolean,
  p_par_value numeric,
  p_lots jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_owner uuid;
  v_prior RECORD;
  v_class_key text;
  v_snapshot_id uuid;
  v_corrected int := 0;
  v_new_rows int := 0;
  v_certificated boolean;
  v_certs_created int := 0;
  v_certs_cancelled int := 0;
  v_lot jsonb;
  v_holder_id uuid;
  v_holder_name text;
  v_qty numeric(18,4);
  v_cert_id uuid;
  v_cert_number int;
  v_ledger_id uuid;
  v_next_cert int;
  v_computed numeric(18,4) := 0;
  v_lot_sum numeric(18,4);
  v_ledger_sum numeric(18,4);
  v_holder_sum numeric(18,4);
  v_authorized numeric;
  v_locked_count int;
  v_new_ledger_ids uuid[] := ARRAY[]::uuid[];
  v_prior_ledger_ids uuid[];
  v_bad int;
BEGIN
  -- ---------------------------------------------------------------------
  -- 0. Authorization + input validation
  -- ---------------------------------------------------------------------
  SELECT user_id INTO v_owner FROM companies WHERE id = p_company_id;
  IF v_owner IS NULL OR v_owner <> auth.uid() THEN
    RAISE EXCEPTION 'Access denied';
  END IF;

  IF p_amendment_reason IS NULL OR btrim(p_amendment_reason) = '' THEN
    RAISE EXCEPTION 'An amendment reason is required. It is the only record of the corporate action that caused the change.';
  END IF;

  IF p_source_document_id IS NULL THEN
    RAISE EXCEPTION 'A source document is required for an amendment.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM document_registry d
    WHERE d.id = p_source_document_id AND d.company_id = p_company_id
  ) THEN
    RAISE EXCEPTION 'Source document does not belong to this company.';
  END IF;

  SELECT * INTO v_prior
  FROM ownership_snapshots
  WHERE id = p_prior_snapshot_id AND company_id = p_company_id
  FOR UPDATE;

  IF v_prior.id IS NULL THEN
    RAISE EXCEPTION 'Prior snapshot not found for this company.';
  END IF;
  IF v_prior.status <> 'locked' THEN
    RAISE EXCEPTION 'Only a locked snapshot can be amended (found status %).', v_prior.status;
  END IF;
  IF p_as_of_date < v_prior.as_of_date THEN
    RAISE EXCEPTION 'The amendment as-of date (%) cannot precede the prior snapshot as-of date (%).',
      p_as_of_date, v_prior.as_of_date;
  END IF;

  v_class_key := lower(regexp_replace(coalesce(p_share_class_label, 'Common'), '[^a-zA-Z0-9]+', '_', 'g'));
  IF v_class_key <> v_prior.share_class_key THEN
    RAISE EXCEPTION 'An amendment must target the same share class as the snapshot it supersedes.';
  END IF;

  SELECT EXISTS (SELECT 1 FROM stock_certificates WHERE company_id = p_company_id) INTO v_certificated;

  -- ---------------------------------------------------------------------
  -- 1. Correct the prior snapshot's ledger rows
  -- ---------------------------------------------------------------------
  SELECT array_agg(share_transaction_id) INTO v_prior_ledger_ids
  FROM ownership_snapshot_lots
  WHERE snapshot_id = p_prior_snapshot_id AND share_transaction_id IS NOT NULL;

  IF v_prior_ledger_ids IS NOT NULL THEN
    UPDATE share_transactions
    SET status = 'corrected',
        correction_memo = left('Superseded by ownership snapshot amendment as of '
          || p_as_of_date::text || ': ' || btrim(p_amendment_reason), 2000)
    WHERE id = ANY(v_prior_ledger_ids)
      AND status <> 'corrected';
    GET DIAGNOSTICS v_corrected = ROW_COUNT;
  END IF;

  -- ---------------------------------------------------------------------
  -- 2. Certificate cancellation — conditional. Uncertificated entities
  --    never get cancellation records for documents that do not exist.
  -- ---------------------------------------------------------------------
  IF v_certificated THEN
    UPDATE stock_certificates c
    SET status = 'cancelled',
        cancelled_date = p_as_of_date,
        cancelled_reason = left('Superseded by ownership snapshot amendment: ' || btrim(p_amendment_reason), 2000)
    FROM ownership_snapshot_lots l
    WHERE l.snapshot_id = p_prior_snapshot_id
      AND l.certificate_number = c.certificate_number
      AND c.company_id = p_company_id
      AND coalesce(c.status, 'active') <> 'cancelled';
    GET DIAGNOSTICS v_certs_cancelled = ROW_COUNT;
  END IF;

  -- ---------------------------------------------------------------------
  -- 3. New snapshot (draft first, so lots always have a parent)
  -- ---------------------------------------------------------------------
  INSERT INTO ownership_snapshots (
    company_id, share_class_key, share_class_label, as_of_date, quantity_basis,
    entry_tier, declared_total, status, supersedes_id, source_document_id, notes
  ) VALUES (
    p_company_id, v_class_key, coalesce(p_share_class_label, 'Common'), p_as_of_date,
    coalesce(p_quantity_basis, 'units'), coalesce(p_entry_tier, 'position_lots'),
    p_declared_total, 'draft', p_prior_snapshot_id, p_source_document_id, btrim(p_amendment_reason)
  ) RETURNING id INTO v_snapshot_id;

  -- Next free certificate number for lots that do not carry a numeric label.
  SELECT coalesce(max(certificate_number), 0) + 1 INTO v_next_cert
  FROM stock_certificates WHERE company_id = p_company_id;

  -- ---------------------------------------------------------------------
  -- 4. Holders, certificates, ledger rows, lots, retired records
  -- ---------------------------------------------------------------------
  FOR v_lot IN SELECT * FROM jsonb_array_elements(coalesce(p_lots, '[]'::jsonb))
  LOOP
    v_qty := coalesce((v_lot->>'quantity')::numeric, 0);
    IF v_qty <= 0 THEN
      CONTINUE;
    END IF;

    IF coalesce(v_lot->>'shareholder_id', '') <> '' THEN
      v_holder_id := (v_lot->>'shareholder_id')::uuid;
      SELECT name INTO v_holder_name FROM shareholders WHERE id = v_holder_id AND company_id = p_company_id;
      IF v_holder_name IS NULL THEN
        RAISE EXCEPTION 'Holder % does not belong to this company.', v_holder_id;
      END IF;
    ELSE
      v_holder_name := btrim(coalesce(v_lot->>'new_holder_name', ''));
      IF v_holder_name = '' THEN
        RAISE EXCEPTION 'Every lot must name a holder.';
      END IF;
      INSERT INTO shareholders (company_id, name, num_shares, share_class)
      VALUES (p_company_id, v_holder_name, 0, coalesce(p_share_class_label, 'Common'))
      RETURNING id INTO v_holder_id;
    END IF;

    v_cert_id := NULL;
    v_cert_number := NULL;

    IF v_certificated THEN
      IF coalesce(v_lot->>'certificate_label', '') ~ '^[0-9]+$' THEN
        v_cert_number := (v_lot->>'certificate_label')::int;
      ELSE
        v_cert_number := v_next_cert;
        v_next_cert := v_next_cert + 1;
      END IF;

      INSERT INTO stock_certificates (
        company_id, shareholder_id, share_class, num_shares, status, issue_date,
        certificate_number, certificate_label, par_value,
        cancelled_date, cancelled_reason
      ) VALUES (
        p_company_id, v_holder_id, coalesce(p_share_class_label, 'Common'), v_qty,
        CASE WHEN v_lot->>'status' = 'surrendered' THEN 'cancelled' ELSE 'active' END,
        coalesce(nullif(v_lot->>'certificate_date','')::date, p_as_of_date),
        v_cert_number, nullif(btrim(coalesce(v_lot->>'certificate_label','')), ''), p_par_value,
        CASE WHEN v_lot->>'status' = 'surrendered' THEN p_as_of_date END,
        CASE WHEN v_lot->>'status' = 'surrendered'
          THEN coalesce(nullif(btrim(coalesce(v_lot->>'notes','')), ''), 'Surrendered at amendment') END
      ) RETURNING id INTO v_cert_id;
      v_certs_created := v_certs_created + 1;
    END IF;

    IF v_lot->>'status' = 'surrendered' THEN
      INSERT INTO retired_ownership_records (
        snapshot_id, company_id, certificate_number, certificate_label, holder_name,
        quantity, issue_date, surrender_date, reason
      ) VALUES (
        v_snapshot_id, p_company_id, v_cert_number,
        nullif(btrim(coalesce(v_lot->>'certificate_label','')), ''), v_holder_name, v_qty,
        nullif(v_lot->>'certificate_date','')::date, p_as_of_date,
        nullif(btrim(coalesce(v_lot->>'notes','')), '')
      );

      INSERT INTO ownership_snapshot_lots (
        snapshot_id, company_id, shareholder_id, holder_name_as_entered, entered_quantity,
        certificate_number, certificate_label, certificate_date, acquired_date,
        acquisition_type, transferor_description, status, needs_review, review_reason,
        share_transaction_id, notes
      ) VALUES (
        v_snapshot_id, p_company_id, v_holder_id, v_holder_name, v_qty,
        v_cert_number, nullif(btrim(coalesce(v_lot->>'certificate_label','')), ''),
        nullif(v_lot->>'certificate_date','')::date, nullif(v_lot->>'acquired_date','')::date,
        coalesce(nullif(v_lot->>'acquisition_type',''), 'original_issue'),
        nullif(btrim(coalesce(v_lot->>'transferor_description','')), ''), 'surrendered',
        coalesce((v_lot->>'needs_review')::boolean, false),
        nullif(btrim(coalesce(v_lot->>'review_reason','')), ''),
        NULL, nullif(btrim(coaleske_placeholder(coalesce(v_lot->>'notes',''))), '')
      );
      CONTINUE;
    END IF;

    -- Option (A) stand-in: post-split quantities are carried on the amendment
    -- lot itself. A real `stock_split` transaction type is a queued Phase 2
    -- item; when it lands, the jump below becomes its own ledger event.
    INSERT INTO share_transactions (
      company_id, shareholder_id, transaction_type, entry_type, share_class, num_shares,
      transaction_date, effective_date, to_shareholder, from_shareholder,
      certificate_id, issued_certificate_number, certificate_label, par_value, notes
    ) VALUES (
      p_company_id, v_holder_id,
      CASE WHEN p_is_llc THEN 'membership_issuance' ELSE 'initial_issuance' END,
      'opening_balance', coalesce(p_share_class_label, 'Common'), v_qty,
      p_as_of_date, p_as_of_date, v_holder_name, 'Pre-existing Ownership',
      v_cert_id, v_cert_number, nullif(btrim(coalesce(v_lot->>'certificate_label','')), ''),
      p_par_value,
      left('Amended opening ownership snapshot as of ' || p_as_of_date::text || ' — '
        || btrim(p_amendment_reason), 2000)
    ) RETURNING id INTO v_ledger_id;

    v_new_ledger_ids := v_new_ledger_ids || v_ledger_id;
    v_new_rows := v_new_rows + 1;
    v_computed := v_computed + v_qty;

    INSERT INTO ownership_snapshot_lots (
      snapshot_id, company_id, shareholder_id, holder_name_as_entered, entered_quantity,
      certificate_number, certificate_label, certificate_date, acquired_date,
      acquisition_type, transferor_description, status, needs_review, review_reason,
      share_transaction_id, notes
    ) VALUES (
      v_snapshot_id, p_company_id, v_holder_id, v_holder_name, v_qty,
      v_cert_number, nullif(btrim(coalesce(v_lot->>'certificate_label','')), ''),
      nullif(v_lot->>'certificate_date','')::date, nullif(v_lot->>'acquired_date','')::date,
      coalesce(nullif(v_lot->>'acquisition_type',''), 'original_issue'),
      nullif(btrim(coalesce(v_lot->>'transferor_description','')), ''), 'outstanding',
      coalesce((v_lot->>'needs_review')::boolean, false),
      nullif(btrim(coalesce(v_lot->>'review_reason','')), ''),
      v_ledger_id, nullif(btrim(coalesce(v_lot->>'notes','')), '')
    );
  END LOOP;

  IF v_new_rows = 0 THEN
    RAISE EXCEPTION 'An amendment must contain at least one outstanding position.';
  END IF;

  -- ---------------------------------------------------------------------
  -- 5. Holder totals + entity back-dating lock + percentages
  -- ---------------------------------------------------------------------
  UPDATE shareholders s
  SET num_shares = coalesce(t.total, 0)
  FROM (
    SELECT st.shareholder_id, sum(st.num_shares) AS total
    FROM share_transactions st
    WHERE st.company_id = p_company_id
      AND st.entry_type = 'opening_balance'
      AND st.status <> 'corrected'
    GROUP BY st.shareholder_id
  ) t
  WHERE s.id = t.shareholder_id AND s.company_id = p_company_id;

  UPDATE shareholders s
  SET num_shares = 0
  WHERE s.company_id = p_company_id
    AND NOT EXISTS (
      SELECT 1 FROM share_transactions st
      WHERE st.company_id = p_company_id
        AND st.shareholder_id = s.id
        AND st.status <> 'corrected'
    );

  UPDATE companies SET opening_balance_date = p_as_of_date WHERE id = p_company_id;

  PERFORM public.recalculate_ownership_percentages(p_company_id);

  -- ---------------------------------------------------------------------
  -- 6. Assertions — any failure rolls the entire amendment back
  -- ---------------------------------------------------------------------

  -- A1/A3 three-way + per-holder match
  SELECT coalesce(sum(entered_quantity), 0) INTO v_lot_sum
  FROM ownership_snapshot_lots
  WHERE snapshot_id = v_snapshot_id AND status = 'outstanding';

  SELECT coalesce(sum(num_shares), 0) INTO v_ledger_sum
  FROM share_transactions WHERE id = ANY(v_new_ledger_ids);

  IF abs(v_lot_sum - v_ledger_sum) > 0.00005 OR abs(v_lot_sum - v_computed) > 0.00005 THEN
    RAISE EXCEPTION 'Assertion failed: lot total (%) does not match ledger total (%).', v_lot_sum, v_ledger_sum;
  END IF;

  SELECT coalesce(sum(num_shares), 0) INTO v_holder_sum
  FROM shareholders
  WHERE company_id = p_company_id AND coalesce(is_treasury, false) = false;

  IF abs(v_holder_sum - v_lot_sum) > 0.00005 THEN
    RAISE EXCEPTION 'Assertion failed: holder totals (%) do not match snapshot total (%).', v_holder_sum, v_lot_sum;
  END IF;

  SELECT count(*) INTO v_bad FROM (
    SELECT l.shareholder_id,
           sum(l.entered_quantity) AS lots,
           (SELECT coalesce(sum(st.num_shares), 0) FROM share_transactions st
              WHERE st.id = ANY(v_new_ledger_ids) AND st.shareholder_id = l.shareholder_id) AS ledger,
           (SELECT coalesce(sh.num_shares, 0) FROM shareholders sh WHERE sh.id = l.shareholder_id) AS holder
    FROM ownership_snapshot_lots l
    WHERE l.snapshot_id = v_snapshot_id AND l.status = 'outstanding'
    GROUP BY l.shareholder_id
  ) x WHERE abs(x.lots - x.ledger) > 0.00005 OR abs(x.lots - x.holder) > 0.00005;
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'Assertion failed: % holder(s) disagree across lots, ledger and holdings.', v_bad;
  END IF;

  -- A2 declared-total reconciliation
  IF p_declared_total IS NULL OR abs(p_declared_total - v_lot_sum) > 0.00005 THEN
    RAISE EXCEPTION 'Assertion failed: entered total (%) does not reconcile to the declared total (%).',
      v_lot_sum, p_declared_total;
  END IF;

  -- A4 prior rows fully corrected
  SELECT count(*) INTO v_bad
  FROM ownership_snapshot_lots l
  JOIN share_transactions st ON st.id = l.share_transaction_id
  WHERE l.snapshot_id = p_prior_snapshot_id AND st.status <> 'corrected';
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'Assertion failed: % superseded ledger row(s) are still active.', v_bad;
  END IF;

  -- A5 no stale opening balances outside the new snapshot
  SELECT count(*) INTO v_bad
  FROM share_transactions st
  WHERE st.company_id = p_company_id
    AND st.entry_type = 'opening_balance'
    AND st.status <> 'corrected'
    AND NOT (st.id = ANY(v_new_ledger_ids));
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'Assertion failed: % stale opening-balance row(s) remain active outside the amendment.', v_bad;
  END IF;

  -- A8 lot/ledger pairing
  SELECT count(*) INTO v_bad
  FROM ownership_snapshot_lots l
  WHERE l.snapshot_id = v_snapshot_id AND l.status = 'outstanding'
    AND (l.share_transaction_id IS NULL OR NOT (l.share_transaction_id = ANY(v_new_ledger_ids)));
  IF v_bad > 0 THEN
    RAISE EXCEPTION 'Assertion failed: % lot(s) are not paired with a newly created ledger row.', v_bad;
  END IF;

  -- A10 authorized cap
  SELECT authorized_shares INTO v_authorized FROM companies WHERE id = p_company_id;
  IF v_authorized IS NOT NULL AND v_authorized > 0 AND v_lot_sum > v_authorized + 0.00005 THEN
    RAISE EXCEPTION 'Assertion failed: amended total (%) exceeds the authorized amount (%).', v_lot_sum, v_authorized;
  END IF;

  -- A11 certificate-step consistency
  IF NOT v_certificated AND (v_certs_created > 0 OR v_certs_cancelled > 0) THEN
    RAISE EXCEPTION 'Assertion failed: certificate rows were touched for an uncertificated entity.';
  END IF;

  -- ---------------------------------------------------------------------
  -- 7. Flip statuses (A6/A7 verified after the flip)
  -- ---------------------------------------------------------------------
  UPDATE ownership_snapshots SET status = 'amended' WHERE id = p_prior_snapshot_id;
  UPDATE ownership_snapshots
  SET status = 'locked', locked_at = now(), locked_by = auth.uid()
  WHERE id = v_snapshot_id;

  SELECT count(*) INTO v_locked_count
  FROM ownership_snapshots
  WHERE company_id = p_company_id AND share_class_key = v_class_key AND status = 'locked';
  IF v_locked_count <> 1 THEN
    RAISE EXCEPTION 'Assertion failed: % locked snapshot(s) exist for this class after the amendment.', v_locked_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM ownership_snapshots
    WHERE id = v_snapshot_id AND status = 'locked' AND supersedes_id = p_prior_snapshot_id
  ) OR NOT EXISTS (
    SELECT 1 FROM ownership_snapshots WHERE id = p_prior_snapshot_id AND status = 'amended'
  ) THEN
    RAISE EXCEPTION 'Assertion failed: supersede chain is not intact.';
  END IF;

  RETURN jsonb_build_object(
    'snapshot_id', v_snapshot_id,
    'prior_snapshot_id', p_prior_snapshot_id,
    'corrected_rows', v_corrected,
    'new_ledger_rows', v_new_rows,
    'computed_total', v_lot_sum,
    'certificated', v_certificated
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.amend_ownership_snapshot(uuid, uuid, date, text, text, text, numeric, text, uuid, boolean, numeric, jsonb) FROM public;
GRANT EXECUTE ON FUNCTION public.amend_ownership_snapshot(uuid, uuid, date, text, text, text, numeric, text, uuid, boolean, numeric, jsonb) TO authenticated;
GRANT EXECUTE ON FUNCTION public.amend_ownership_snapshot(uuid, uuid, date, text, text, text, numeric, text, uuid, boolean, numeric, jsonb) TO service_role;