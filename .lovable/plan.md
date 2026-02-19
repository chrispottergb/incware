

## Fix LLC Terminology in Organizational Meeting PDF

### Problem
The organizational meeting boilerplate uses corporate terminology (shares, election, shareholders) for LLCs, which is legally incorrect. LLCs have membership interests, not shares, and appoint managers rather than electing officers.

### Changes (all in `src/lib/meeting-pdf-export.ts`)

**1. Officers Section (lines 354-357) -- "Election" to "Appointment"**
- Change section title from "Election of Officers" to "Appointment of Managers/Officers" for LLCs
- Change resolution language from "elected as the initial managers/officers" to "appointed as the initial managers/officers"

**2. Members Section (lines 383-398) -- "Shares" to "Membership Interests"**
- When displaying LLC members, show "membership interest" or "percentage interest" instead of "shares"
- Update resolution language: instead of referencing stock issuance concepts, reference "membership interests as set forth in the Operating Agreement"

**3. Section 1244 Stock Plan (line 496) -- Exclude LLCs entirely**
- Add `&& !isLLC` check so Section 1244 never appears on LLC documents (Section 1244 is a stock-specific provision under IRC that does not apply to membership interests)

**4. S-Corp Election (lines 423-432) -- Fix member terminology**
- Change "all shareholders consenting" to "all members consenting" when entity is an LLC
- This section correctly CAN appear for LLCs since they may elect S-Corp treatment via Form 2553

### Summary of Terminology Mapping

| Corporate Term | LLC Equivalent |
|---|---|
| Shares / Stock | Membership Interests / Units |
| Shareholders | Members |
| Election of Officers | Appointment of Managers/Officers |
| Elected | Appointed |
| Stock Issuance | Capital Contributions |
| Section 1244 | Not applicable (remove) |

