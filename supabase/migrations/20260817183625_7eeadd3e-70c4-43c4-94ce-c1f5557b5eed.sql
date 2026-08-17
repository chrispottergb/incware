ALTER TABLE public.companies
  ADD COLUMN board_eliminated boolean NOT NULL DEFAULT false,
  ADD COLUMN board_elimination_article text NULL,
  ADD COLUMN board_elimination_date date NULL;

UPDATE public.companies SET board_eliminated = true WHERE statutory_close_corporation = true;

ALTER TABLE public.companies ADD CONSTRAINT board_eliminated_requires_close_corp
  CHECK (NOT board_eliminated OR statutory_close_corporation);