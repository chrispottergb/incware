
-- Auto-cancel certificates when a transaction references them via surrendered_certificate_number
CREATE OR REPLACE FUNCTION public.auto_cancel_surrendered_certificate()
RETURNS trigger AS $$
BEGIN
  IF NEW.surrendered_certificate_number IS NOT NULL THEN
    UPDATE public.stock_certificates
    SET status = 'cancelled',
        cancelled_date = COALESCE(NEW.effective_date, NEW.transaction_date, CURRENT_DATE),
        cancelled_reason = 'Cancelled by Cert #' || NEW.issued_certificate_number::text
    WHERE company_id = NEW.company_id
      AND certificate_number = NEW.surrendered_certificate_number
      AND (status IS NULL OR status != 'cancelled');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Attach trigger to share_transactions
CREATE TRIGGER on_share_transaction_cancel_cert
  AFTER INSERT OR UPDATE ON public.share_transactions
  FOR EACH ROW
  EXECUTE FUNCTION public.auto_cancel_surrendered_certificate();

-- Retroactively fix any existing certificates that should be cancelled
UPDATE public.stock_certificates sc
SET status = 'cancelled',
    cancelled_date = COALESCE(st.effective_date, st.transaction_date, CURRENT_DATE),
    cancelled_reason = 'Cancelled by Cert #' || st.issued_certificate_number::text
FROM public.share_transactions st
WHERE st.company_id = sc.company_id
  AND st.surrendered_certificate_number = sc.certificate_number
  AND st.surrendered_certificate_number IS NOT NULL
  AND (sc.status IS NULL OR sc.status != 'cancelled');
