
-- Table for vehicle purchases recorded at annual meetings
CREATE TABLE public.meeting_vehicle_purchases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  year_make_model TEXT NOT NULL DEFAULT '',
  vin TEXT,
  purchase_date DATE,
  purchase_price NUMERIC,
  seller TEXT,
  business_use_description TEXT,
  authorized_drivers TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for vehicle leases recorded at annual meetings
CREATE TABLE public.meeting_vehicle_leases (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  meeting_id UUID NOT NULL REFERENCES public.meetings(id) ON DELETE CASCADE,
  year_make_model TEXT NOT NULL DEFAULT '',
  vin TEXT,
  lease_start_date DATE,
  monthly_lease_payment NUMERIC,
  lessor_name TEXT,
  relationship_to_company TEXT,
  fmv_verified BOOLEAN DEFAULT false,
  fmv_notes TEXT,
  business_use_description TEXT,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.meeting_vehicle_purchases ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.meeting_vehicle_leases ENABLE ROW LEVEL SECURITY;

-- RLS for vehicle purchases
CREATE POLICY "Users can manage own meeting vehicle purchases"
ON public.meeting_vehicle_purchases
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM meetings m
    JOIN companies c ON c.id = m.company_id
    WHERE m.id = meeting_vehicle_purchases.meeting_id
    AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM meetings m
    JOIN companies c ON c.id = m.company_id
    WHERE m.id = meeting_vehicle_purchases.meeting_id
    AND c.user_id = auth.uid()
  )
);

-- RLS for vehicle leases
CREATE POLICY "Users can manage own meeting vehicle leases"
ON public.meeting_vehicle_leases
FOR ALL
USING (
  EXISTS (
    SELECT 1 FROM meetings m
    JOIN companies c ON c.id = m.company_id
    WHERE m.id = meeting_vehicle_leases.meeting_id
    AND c.user_id = auth.uid()
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM meetings m
    JOIN companies c ON c.id = m.company_id
    WHERE m.id = meeting_vehicle_leases.meeting_id
    AND c.user_id = auth.uid()
  )
);
