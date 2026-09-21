# Annual Meeting Attendee Lists

## Changes
- Replace the annual-meeting attendee table in the shared meeting-minutes PDF renderer with an unframed bulleted list.
- Render only each attendee’s cleaned name, one name per line; omit addresses, titles, table headers, empty values, and placeholders.
- Apply the same presentation to the dedicated LLC and nonprofit annual-meeting PDF builders so all annual meeting entity and governance paths match.
- Preserve existing attendee deduplication and all unrelated meeting wording and sections.

## Verification
- Add focused PDF text assertions for corporation, LLC, and nonprofit annual meetings, including empty attendee records.
- Confirm generated text includes each valid name once and contains no attendee title, address, placeholder, or attendee-table header.
- Run targeted tests, TypeScript checks, and inspect generated PDFs visually for clean wrapping and page breaks.
