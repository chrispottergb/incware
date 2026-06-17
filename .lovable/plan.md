I confirmed the current code on disk at `src/lib/meeting-pdf-export.ts` lines 2980–3043 already has two `autoTable` calls inside `data.benefits.forEach(...)`, but Table 1 is missing explicit `columnStyles`, which can still allow bad wrapping/layout behavior.

Current relevant code on disk:

```ts
(data.benefits ?? []).forEach((b, index) => {
  const isLast = index === (data.benefits ?? []).length - 1;
  const cardBorder = [191, 219, 254] as [number, number, number];

  // Table 1 — shaded header row (benefit type, provider, agent, agency)
  autoTable(doc, {
    startY: y,
    theme: "grid",
    head: [[
      { content: "Benefit Type", styles: { fontStyle: "bold" } },
      "Provider",
      "Agent / Admin",
      "Insurance Agency",
    ]],
    body: [[
      b.benefit_type || b.benefit_description || "—",
      b.provider || "—",
      b.agent_administrator || "—",
      (b as any).insurance_agency || "—",
    ]],
    headStyles: { ...tableHeadStyles },
    bodyStyles: { fontSize: 10 },
    tableLineColor: cardBorder,
    tableLineWidth: 0.2,
    margin: { left: MARGIN, right: R_MARGIN },
  });

  const midY = (doc as any).lastAutoTable.finalY;

  // Table 2 — detail row (plan year, contribution, eligibility/comments)
  autoTable(doc, {
    startY: midY,
    theme: "grid",
    head: [["Plan Year", "Contribution", "Eligibility / Comments"]],
    body: [[
      b.plan_year?.toString() || "—",
      b.retirement_contribution != null ? fmt(b.retirement_contribution) : "—",
      b.eligibility_comments || "—",
    ]],
    headStyles: {
      fillColor: [255, 255, 255],
      textColor: [BLUE.r, BLUE.g, BLUE.b] as [number, number, number],
      lineColor: cardBorder,
      lineWidth: 0.2,
      fontStyle: "bold",
      fontSize: 8,
    },
    bodyStyles: {
      fontSize: 10,
      lineColor: cardBorder,
      lineWidth: 0.2,
    },
    columnStyles: {
      0: { cellWidth: 25 },
      1: { cellWidth: 35 },
      2: { cellWidth: "auto" },
    },
    tableLineColor: cardBorder,
    tableLineWidth: 0.2,
    margin: { left: MARGIN, right: R_MARGIN },
  });

  y = (doc as any).lastAutoTable.finalY + (isLast ? 10 : 5);
});
```

Plan:
1. Update only `src/lib/meeting-pdf-export.ts` inside the Benefits `data.benefits.forEach(...)` loop.
2. Keep exactly two `autoTable` calls per benefit:
   - Table 1: `Benefit Type | Provider | Agent / Admin | Insurance Agency`
   - Table 2: `Plan Year | Contribution | Eligibility / Comments`
3. Add explicit Table 1 widths:
   - Benefit Type: `45`
   - Provider: `50`
   - Agent/Admin: `40`
   - Insurance Agency: `45`
4. Keep Table 2 widths explicit:
   - Plan Year: `25`
   - Contribution: `35`
   - Eligibility/Comments: remaining width or explicit page-safe width if needed.
5. Add PDF table style options to avoid mid-word wrapping, using normal word wrapping and page-safe widths without touching data loading, other PDF sections, margins before the loop, or UI code.
6. Verify after editing by re-reading/searching the Benefits PDF loop and confirming there are exactly two `autoTable` calls in that loop and Table 1 includes `columnStyles` for all four columns.