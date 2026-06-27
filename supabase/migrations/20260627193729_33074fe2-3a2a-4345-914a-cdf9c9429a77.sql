ALTER TABLE public.shareholders
  ADD COLUMN owner_kind text NOT NULL DEFAULT 'individual'
    CHECK (owner_kind IN ('individual', 'entity')),
  ADD COLUMN representative_name  text,
  ADD COLUMN representative_title text;

ALTER TABLE public.meeting_shareholders
  ADD COLUMN owner_kind text NOT NULL DEFAULT 'individual'
    CHECK (owner_kind IN ('individual', 'entity')),
  ADD COLUMN representative_name  text,
  ADD COLUMN representative_title text;