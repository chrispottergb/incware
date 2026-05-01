## Plan: Add property description options to Add Lease UI

**File:** `src/components/company/LeasesTab.tsx` (line 32)

Append four entries to the `leaseOptions` array used by the Property Description dropdown:

- Flex Space
- Showroom/Office Space
- Mixed-Use Commercial
- Service Center

### Change

```ts
const leaseOptions = [
  "Home Office",
  "Office Space",
  "Shared / Coworking Space",
  "Storage Unit",
  "Warehouse Space",
  "Garage",
  "Shed / Outbuilding",
  "Small Workshop",
  "Parking Area",
  "Small Land Parcel",
  "Flex Space",
  "Showroom/Office Space",
  "Mixed-Use Commercial",
  "Service Center",
];
```

No other changes required — the dropdown reads directly from this array, and stored values are free-form strings so existing leases are unaffected.
