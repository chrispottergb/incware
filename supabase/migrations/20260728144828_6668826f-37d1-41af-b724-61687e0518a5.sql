REVOKE EXECUTE ON FUNCTION public.decrypt_company_bank(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.decrypt_master_firm_bank(uuid, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.encrypt_company_bank(uuid, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.encrypt_master_firm_bank(uuid, text, text, text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.block_plaintext_bank_numbers() FROM PUBLIC;