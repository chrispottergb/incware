

# Fix .accdb Upload: Empty Table List

## Problem
When uploading an `.accdb` file, the wizard advances to "Select Tables" but shows no tables. This is NOT a 32-bit vs. 64-bit issue -- the `mdb-reader` library supports all Access versions (97 through 2019) regardless of bitness.

## Root Causes to Address

1. **Password-protected databases**: The library supports decryption but the code never asks for a password
2. **Silent empty results**: When zero tables are found, the user gets no explanation of why
3. **All tables filtered out**: System table filtering (`MSys*`, `~*`) may remove everything if no user tables exist

## Changes

### File: `src/pages/ImportAccess.tsx`

1. **Add a password prompt**
   - Add a state variable for an optional database password
   - When parsing fails OR returns zero tables, show a dialog asking if the database is password-protected
   - Re-attempt parsing with `new MDBReader(Buffer.from(buffer), { password })` when a password is provided

2. **Improve error diagnostics**
   - After `reader.getTableNames()`, if no tables are found, check how many total tables exist (including system tables) and report:
     - "No user tables found. The database contains X system tables only." or
     - "No tables found. The file may be corrupted or in an unsupported format."
   - Show the Access database version/creation date from the reader for debugging context

3. **Add a "Show system tables" toggle**
   - Add a checkbox on the table selection step: "Include system tables"
   - When enabled, show all tables (including `MSys*` prefixed ones) so users can verify the file was read correctly

4. **Better error toast messages**
   - Replace the generic "Failed to parse Access file" with more specific guidance based on the error type
   - If the error message contains "encryption" or "password", prompt for credentials automatically

## Technical Details

### Password flow
```text
1. User uploads .accdb
2. Parse without password
3. If error contains "password"/"encrypt" OR zero tables found:
   -> Show password input dialog
   -> Re-parse with: new MDBReader(Buffer.from(buffer), { password })
4. If still fails, show specific error
```

### Diagnostic info to display
After successful parse, show a small info line:
- Database created: [date from reader.getCreationDate()]
- Total tables: X user / Y system
- This helps the user confirm the file was read correctly

### No database or dependency changes needed
This is purely a UI/parsing logic fix in `ImportAccess.tsx`.

