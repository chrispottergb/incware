
CREATE TABLE public.user_address_book (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  full_name TEXT NOT NULL,
  address TEXT,
  address_2 TEXT,
  city TEXT,
  state TEXT,
  zip TEXT,
  company_id UUID REFERENCES public.companies(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(user_id, full_name, address)
);

ALTER TABLE public.user_address_book ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own address book" ON public.user_address_book FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own address book" ON public.user_address_book FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own address book" ON public.user_address_book FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own address book" ON public.user_address_book FOR DELETE USING (auth.uid() = user_id);

CREATE INDEX idx_user_address_book_user_id ON public.user_address_book(user_id);
CREATE INDEX idx_user_address_book_name ON public.user_address_book(user_id, full_name);
