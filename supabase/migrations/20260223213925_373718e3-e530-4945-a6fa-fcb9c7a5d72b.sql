
-- Table for vehicles/equipment sold during the year
CREATE TABLE public.meeting_vehicle_sales (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  year_make_model TEXT NOT NULL DEFAULT '',
  vin TEXT,
  sale_date DATE,
  sale_price NUMERIC,
  buyer_name TEXT,
  business_use_description TEXT,
  reason_for_sale TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_vehicle_sales ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own meeting vehicle sales"
ON public.meeting_vehicle_sales
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM meetings m
    JOIN companies c ON c.id = m.company_id
    WHERE m.id = meeting_vehicle_sales.meeting_id AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM meetings m
    JOIN companies c ON c.id = m.company_id
    WHERE m.id = meeting_vehicle_sales.meeting_id AND c.user_id = auth.uid()
  )
);

-- Table for leases that ended during the year
CREATE TABLE public.meeting_lease_terminations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  property_description TEXT NOT NULL DEFAULT '',
  landlord_name TEXT,
  lease_end_date DATE,
  termination_reason TEXT,
  early_termination BOOLEAN DEFAULT false,
  penalty_amount NUMERIC,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.meeting_lease_terminations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own meeting lease terminations"
ON public.meeting_lease_terminations
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM meetings m
    JOIN companies c ON c.id = m.company_id
    WHERE m.id = meeting_lease_terminations.meeting_id AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM meetings m
    JOIN companies c ON c.id = m.company_id
    WHERE m.id = meeting_lease_terminations.meeting_id AND c.user_id = auth.uid()
  )
);
