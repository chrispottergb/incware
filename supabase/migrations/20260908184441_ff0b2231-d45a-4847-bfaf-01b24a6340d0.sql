INSERT INTO public.resources (title, category, content_type, sort_order, content)
SELECT 'Legal Disclaimer', 'Legal Disclaimer', 'markdown', 0, $md$## EntityIQ — Legal Disclaimer

**Not legal advice.** EntityIQ is document-assembly and recordkeeping software. It generates documents from standard templates using the information you enter and the options you select. It does not provide legal advice, legal opinions, or compliance determinations. EntityIQ is not a law firm, and no attorney-client relationship is created by your use of it.

**Automated selections are conveniences, not legal conclusions.** Certain templates, statutory citations, and document sections are selected automatically based on entity type, elections, and data you enter. You are solely responsible for confirming that the form, content, citations, dates, and figures in any document are correct and appropriate before signing, filing, or relying on it.

**Use for third parties.** If you use EntityIQ to prepare records for entities other than your own, you represent that you are authorized to do so. You are solely responsible for the services you provide to those parties and for compliance with the unauthorized-practice-of-law rules of every jurisdiction in which you operate. EntityIQ grants you no authority to practice law.

**Statutory content.** Statutory references and compliance materials reflect law as of the date displayed and may not be current. Laws change; EntityIQ does not commit to updating them.

**AI-assisted features.** AI features produce screening results and drafts only. They do not determine whether any entity is compliant with any law.

**Consult an attorney.** Have your attorney review any document before execution or filing.$md$
WHERE NOT EXISTS (SELECT 1 FROM public.resources WHERE category = 'Legal Disclaimer');