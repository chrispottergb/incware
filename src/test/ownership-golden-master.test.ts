/**
 * GOLDEN MASTER — ownership calculation.
 *
 * Captures the exact current output of `useShareCalculations` and
 * `getHoldingsByName` across the fixture set. Any change to these snapshots is
 * a change to how ownership is computed and must be deliberate: the shared
 * transaction-type extraction and the opening-ownership snapshot work must both
 * leave every value below byte-identical.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { FIXTURES, type FixtureCompany } from "./fixtures/ownership-fixtures";

let activeFixture: FixtureCompany = FIXTURES[0];

/** Minimal chainable stand-in for the PostgREST query builder. */
function makeBuilder(resolve: () => { data: any; error: null }) {
  const builder: any = {
    select: () => builder,
    eq: () => builder,
    order: () => builder,
    maybeSingle: async () => resolve(),
    then: (onFulfilled: any, onRejected?: any) =>
      Promise.resolve(resolve()).then(onFulfilled, onRejected),
  };
  return builder;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => {
      switch (table) {
        case "companies":
          return makeBuilder(() => ({
            data: { authorized_shares: activeFixture.authorized_shares },
            error: null,
          }));
        case "share_transactions":
          return makeBuilder(() => ({
            data: activeFixture.transactions,
            error: null,
          }));
        case "shareholders":
          return makeBuilder(() => ({
            data: activeFixture.shareholders,
            error: null,
          }));
        case "shareholder_name_history":
          return makeBuilder(() => ({
            data: activeFixture.nameHistory,
            error: null,
          }));
        default:
          return makeBuilder(() => ({ data: [], error: null }));
      }
    },
  },
}));

// Imported after the mock is registered.
const { useShareCalculations, getHoldingsByName } = await import(
  "@/hooks/useShareCalculations"
);

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return React.createElement(QueryClientProvider, { client }, children);
}

describe("golden master: useShareCalculations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  for (const fixture of FIXTURES) {
    it(`${fixture.key} — ${fixture.description}`, async () => {
      activeFixture = fixture;
      const { result } = renderHook(
        () => useShareCalculations(`company-${fixture.key}`),
        { wrapper }
      );

      await waitFor(() => expect(result.current.isLoading).toBe(false));
      await waitFor(() =>
        expect(Object.keys(result.current.shareholderHoldings).length).toBe(
          fixture.shareholders.length
        )
      );

      expect({
        authorizedShares: result.current.authorizedShares,
        totalIssuedShares: result.current.totalIssuedShares,
        availableShares: result.current.availableShares,
        shareholderHoldings: result.current.shareholderHoldings,
      }).toMatchSnapshot();
    });
  }
});

describe("golden master: getHoldingsByName", () => {
  for (const fixture of FIXTURES) {
    it(`${fixture.key} — holdings by name for every owner`, () => {
      const byName: Record<string, number> = {};
      for (const s of fixture.shareholders) {
        byName[s.name] = getHoldingsByName(
          fixture.transactions,
          s.name,
          fixture.shareholders,
          fixture.nameHistory
        );
      }
      expect(byName).toMatchSnapshot();
    });
  }

  it("resolves a pre-rename trust name to the current owner", () => {
    const fixture = FIXTURES.find((f) => f.key === "llc-renamed-trust")!;
    const underOldName = getHoldingsByName(
      fixture.transactions,
      "Ken & Louise Revocable Trust",
      fixture.shareholders,
      fixture.nameHistory
    );
    const underCurrentName = getHoldingsByName(
      fixture.transactions,
      "Louise Revocable Trust",
      fixture.shareholders,
      fixture.nameHistory
    );
    expect(underOldName).toBe(underCurrentName);
  });

  it("never returns a negative holding", () => {
    for (const fixture of FIXTURES) {
      for (const s of fixture.shareholders) {
        expect(
          getHoldingsByName(
            fixture.transactions,
            s.name,
            fixture.shareholders,
            fixture.nameHistory
          )
        ).toBeGreaterThanOrEqual(0);
      }
    }
  });
});

describe("treasury is issued but not outstanding", () => {
  it("excludes treasury holdings from totalIssuedShares", async () => {
    const fixture = FIXTURES.find((f) => f.key === "corp-treasury")!;
    activeFixture = fixture;
    const { result } = renderHook(
      () => useShareCalculations("company-corp-treasury"),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    await waitFor(() =>
      expect(Object.keys(result.current.shareholderHoldings).length).toBe(2)
    );

    // Issued: 1000 + 200 = 1200. Treasury holds 200 + 50 transferred in = 250.
    // Outstanding = 950, held entirely by Elena (1000 - 50).
    expect(result.current.shareholderHoldings["sh-tr"]).toBe(250);
    expect(result.current.shareholderHoldings["sh-e"]).toBe(950);
    expect(result.current.totalIssuedShares).toBe(950);
    expect(result.current.availableShares).toBe(5000 - 950);
  });
});
