ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS oa_drafting_style text CHECK (oa_drafting_style IN ('units','percentage_only'));

UPDATE public.companies c
   SET oa_drafting_style = 'units'
 WHERE oa_drafting_style IS NULL
   AND EXISTS (SELECT 1 FROM public.share_transactions st WHERE st.company_id = c.id);