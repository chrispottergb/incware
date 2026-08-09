/**
 * Treasury exclusion — document generators.
 *
 * No entity in production has ever held a treasury position, so every
 * downstream treasury path is untested against real data. The opening-ownership
 * importer will create the first ones. A treasury holder appearing on an
 * executed operating agreement's member schedule would be a legal defect, so
 * this is asserted at the generator level, not just in the cap-table math.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const textCalls: string[] = [];
const tableRows: any[][] = [];

vi.mock("@/lib/arial-font", () => ({ registerArialFont: () => {} }));

vi.mock("jspdf-autotable", () => ({
  default: (_doc: any, opts: any) => {
    for (const row of opts.body ?? []) tableRows.push(row);
  },
}));

vi.mock("jspdf", () => {
  class FakeDoc {
    internal = {
      pageSize: { getWidth: () => 210, getHeight: () => 297 },
    };
    lastAutoTable = { finalY: 100 };
    setFontSize() { return this; }
    setFont() { return this; }
    setTextColor() { return this; }
    setDrawColor() { return this; }
    setFillColor() { return this; }
    setLineHeightFactor() { return this; }
    setLineWidth() { return this; }
    line() { return this; }
    rect() { return this; }
    roundedRect() { return this; }
    addPage() { return this; }
    setPage() { return this; }
    getNumberOfPages() { return 2; }
    getTextWidth() { return 10; }
    addImage() { return this; }
    splitTextToSize(t: string) { return [t]; }
    text(t: any) {
      if (Array.isArray(t)) textCalls.push(...t.map(String));
      else textCalls.push(String(t));
      return this;
    }
    output() { return ""; }
    save() { return this; }
  }
  return { default: FakeDoc };
});

const { generateOperatingAgreementPDF } = await import(
  "@/lib/operating-agreement-pdf"
);

const TREASURY_NAME = "Company Treasury Account";
const REAL_MEMBER = "Marguerite Delacroix";

const members = [
  {
    id: "m1",
    name: REAL_MEMBER,
    address: "10 Main St",
    city: "Madison",
    state: "WI",
    zip: "53703",
    ownership_percentage: 100,
    status: "active",
    is_treasury: false,
  },
  {
    id: "m2",
    name: TREASURY_NAME,
    address: "10 Main St",
    city: "Madison",
    state: "WI",
    zip: "53703",
    ownership_percentage: null,
    status: "active",
    is_treasury: true,
  },
];

describe("operating agreement: treasury holders never reach the member schedule", () => {
  beforeEach(() => {
    textCalls.length = 0;
    tableRows.length = 0;
  });

  for (const draftingStyle of ["units", "percentage_only"] as const) {
    it(`excludes the treasury holder (${draftingStyle} drafting style)`, () => {
      generateOperatingAgreementPDF({
        company: {
          name: "Delacroix Holdings, LLC",
          entity_type: "LLC",
          state_of_incorporation: "Wisconsin",
          incorporation_date: "2015-02-01",
        },
        members,
        officers: [],
        managementType: "member-managed",
        shareholderHoldings: { m1: 900, m2: 100 },
        totalIssuedUnits: 900,
        draftingStyle,
      });

      const scheduleNames = tableRows.map((r) => String(r[0]));
      expect(scheduleNames).toContain(REAL_MEMBER);
      expect(scheduleNames).not.toContain(TREASURY_NAME);

      const everything = [...textCalls, ...tableRows.flat().map(String)].join("\n");
      expect(everything).not.toContain(TREASURY_NAME);
    });
  }

  it("computes interest against outstanding units, not issued units", () => {
    generateOperatingAgreementPDF({
      company: {
        name: "Delacroix Holdings, LLC",
        entity_type: "LLC",
        state_of_incorporation: "Wisconsin",
        incorporation_date: "2015-02-01",
      },
      members,
      officers: [],
      managementType: "member-managed",
      // 900 outstanding after excluding the 100 treasury units.
      shareholderHoldings: { m1: 900, m2: 100 },
      totalIssuedUnits: 900,
      draftingStyle: "units",
    });

    const row = tableRows.find((r) => String(r[0]) === REAL_MEMBER)!;
    expect(row.map(String).join(" ")).toContain("100.00");
  });
});
