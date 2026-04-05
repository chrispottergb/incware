ALTER TABLE share_transactions ALTER COLUMN num_shares TYPE numeric(18,4);
ALTER TABLE shareholders ALTER COLUMN num_shares TYPE numeric(18,4);
ALTER TABLE stock_certificates ALTER COLUMN num_shares TYPE numeric(18,4);
ALTER TABLE bills_of_sale ALTER COLUMN num_shares TYPE numeric(18,4);