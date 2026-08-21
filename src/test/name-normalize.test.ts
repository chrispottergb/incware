import { describe, it, expect } from "vitest";
import {
  normalizeEntryText,
  matchKey,
  levenshtein,
  isNearMatch,
  findNearMatch,
} from "@/lib/name-normalize";
import { resolveUpsertPlan } from "@/hooks/useAddressBook";

describe("normalizeEntryText", () => {
  it("trims ends", () => {
    expect(normalizeEntryText("  Delta Dental  ")).toBe("Delta Dental");
  });

  it("collapses internal whitespace runs", () => {
    expect(normalizeEntryText("Robertson   Ryan  &   Associates")).toBe("Robertson Ryan & Associates");
  });

  it("strips trailing commas but preserves trailing periods", () => {
    expect(normalizeEntryText("Acme Holdings, ")).toBe("Acme Holdings");
    expect(normalizeEntryText("Acme Holdings.")).toBe("Acme Holdings.");
    expect(normalizeEntryText("John Smith Jr. ")).toBe("John Smith Jr.");
    expect(normalizeEntryText("Acme Widgets, Inc.")).toBe("Acme Widgets, Inc.");
  });

  it("never changes case and never expands abbreviations", () => {
    expect(normalizeEntryText("123 N. Main St.")).toBe("123 N. Main St.");
    expect(normalizeEntryText("mcDONALD trust")).toBe("mcDONALD trust");
    expect(normalizeEntryText("St. Mary's Foundation")).toBe("St. Mary's Foundation");
  });

  it("handles null and undefined", () => {
    expect(normalizeEntryText(null)).toBe("");
    expect(normalizeEntryText(undefined)).toBe("");
  });
});

describe("levenshtein", () => {
  it("computes basic distances", () => {
    expect(levenshtein("kitten", "sitting")).toBe(3);
    expect(levenshtein("abc", "abc")).toBe(0);
    expect(levenshtein("", "abc")).toBe(3);
  });
});

describe("isNearMatch", () => {
  it("ignores exact matches", () => {
    expect(isNearMatch("Delta Dental", "delta dental")).toBe(false);
  });

  it("matches when only punctuation or spacing differs", () => {
    expect(isNearMatch("Robertson Ryan and Associates", "Robertson-Ryan and Associates")).toBe(true);
  });

  it("matches on a prefix of at least 5 characters", () => {
    expect(isNearMatch("Robertson Ryan", "Robertson Ryan & Associates")).toBe(true);
    expect(isNearMatch("Rob", "Robertson Ryan & Associates")).toBe(false);
  });

  it("matches within Levenshtein distance 2 for strings of 6+ characters", () => {
    expect(isNearMatch("Robertsen Ryan", "Robertson Ryan")).toBe(true);
    expect(isNearMatch("Delta Dentl", "Delta Dental")).toBe(true);
    expect(isNearMatch("Acme Corp", "Zebra Trust")).toBe(false);
  });
});

describe("findNearMatch", () => {
  const list = [
    { id: "1", full_name: "Robertson Ryan & Associates" },
    { id: "2", full_name: "Delta Dental" },
    { id: "3", full_name: "Northwestern Mutual" },
  ];

  it("returns one suggestion for a close typed value", () => {
    expect(findNearMatch("Robertson Ryan", list)?.id).toBe("1");
  });

  it("returns nothing on an exact match", () => {
    expect(findNearMatch("delta dental", list)).toBeNull();
  });

  it("returns nothing when nothing is close", () => {
    expect(findNearMatch("Zebra Holdings LLC", list)).toBeNull();
  });
});

describe("resolveUpsertPlan — hidden entries must never come back", () => {
  const hidden = [{ id: "h1", full_name: "Delta Dental", is_hidden: true }];
  const visible = [{ id: "v1", full_name: "Delta Dental", is_hidden: false }];

  it("skips a hidden match on the exact name", () => {
    expect(resolveUpsertPlan("Delta Dental", hidden)).toEqual({ action: "skip_hidden", id: "h1" });
  });

  it("skips a hidden match differing only by case", () => {
    expect(resolveUpsertPlan("DELTA DENTAL", hidden)).toEqual({ action: "skip_hidden", id: "h1" });
  });

  it("skips a hidden match differing only by whitespace", () => {
    expect(resolveUpsertPlan("  Delta   Dental ", hidden)).toEqual({ action: "skip_hidden", id: "h1" });
  });

  it("never inserts a second row for a hidden value", () => {
    for (const variant of ["Delta Dental", "delta dental", " Delta  Dental  ", "Delta Dental."]) {
      expect(resolveUpsertPlan(variant, hidden).action).not.toBe("insert");
    }
  });

  it("updates a visible match in place", () => {
    expect(resolveUpsertPlan("delta  dental", visible)).toEqual({ action: "update", id: "v1" });
  });

  it("inserts only when no normalized match exists", () => {
    expect(resolveUpsertPlan("Guardian Life", hidden)).toEqual({ action: "insert", id: null });
  });
});

describe("matchKey", () => {
  it("folds case and whitespace but keeps punctuation", () => {
    expect(matchKey("  Delta   DENTAL ")).toBe("delta dental");
    expect(matchKey("St. Mary's")).toBe("st. mary's");
  });
});
