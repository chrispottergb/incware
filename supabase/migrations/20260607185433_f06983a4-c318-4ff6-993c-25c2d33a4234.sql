ALTER TABLE public.companies
  ADD COLUMN scheduled_meeting_ordinal text
    CHECK (scheduled_meeting_ordinal IS NULL OR scheduled_meeting_ordinal IN ('1st','2nd','3rd','4th','Last')),
  ADD COLUMN scheduled_meeting_day_of_week text
    CHECK (scheduled_meeting_day_of_week IS NULL OR scheduled_meeting_day_of_week IN ('Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday')),
  ADD COLUMN scheduled_meeting_month text
    CHECK (scheduled_meeting_month IS NULL OR scheduled_meeting_month IN ('January','February','March','April','May','June','July','August','September','October','November','December'));

UPDATE public.companies
SET
  scheduled_meeting_ordinal = CASE lower(m[1])
    WHEN '1st' THEN '1st' WHEN '2nd' THEN '2nd' WHEN '3rd' THEN '3rd'
    WHEN '4th' THEN '4th' WHEN 'last' THEN 'Last' END,
  scheduled_meeting_day_of_week = initcap(lower(m[2])),
  scheduled_meeting_month = initcap(lower(m[3]))
FROM (
  SELECT id,
    regexp_match(
      scheduled_annual_meeting,
      '^(1st|2nd|3rd|4th|Last)\s+(Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday)\s+in\s+(January|February|March|April|May|June|July|August|September|October|November|December)\s*$',
      'i'
    ) AS m
  FROM public.companies
  WHERE scheduled_annual_meeting IS NOT NULL
) src
WHERE companies.id = src.id AND src.m IS NOT NULL;

ALTER TABLE public.companies DROP COLUMN scheduled_annual_meeting;
ALTER TABLE public.companies ADD COLUMN scheduled_annual_meeting text
  GENERATED ALWAYS AS (
    CASE
      WHEN scheduled_meeting_ordinal IS NOT NULL
       AND scheduled_meeting_day_of_week IS NOT NULL
       AND scheduled_meeting_month IS NOT NULL
      THEN scheduled_meeting_ordinal || ' ' || scheduled_meeting_day_of_week || ' in ' || scheduled_meeting_month
      ELSE NULL
    END
  ) STORED;