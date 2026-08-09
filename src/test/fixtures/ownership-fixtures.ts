/**
 * Golden-master fixtures for ownership calculation.
 *
 * These exist so that any refactor of the ownership math — extracting the
 * duplicated transaction-type lists, adding snapshot awareness, anything —
 * can be proven byte-identical against the behavior captured here.
 *
 * Coverage required by the opening-ownership design review:
 *  - multiple share classes
 *  - status = "corrected" rows (must be skipped)
 *  - future effective_date rows (must be skipped)
 *  - transfers by free-text name resolved through the alias index, including
 *    a renamed trust
 *  - treasury holdings
 *  - fractional quantities at numeric(18,4) precision
 *  - an entity with existing opening_balance rows
 *  - an entity with none
 */
import type { NameHistoryRow } from "@/lib/owner-aliases";

export interface FixtureShareholder {
  id: string;
  name: string;
  is_treasury?: boolean;
}

export interface FixtureCompany {
  key: string;
  description: string;
  authorized_shares: number | null;
  shareholders: FixtureShareholder[];
  nameHistory: NameHistoryRow[];
  transactions: any[];
}

const nh = (
  id: string,
  shareholder_id: string,
  previous_name: string,
  new_name: string,
  effective_date: string
): NameHistoryRow =>
  ({
    id,
    shareholder_id,
    previous_name,
    new_name,
    effective_date,
    reason: "legal_name_change",
    note: null,
    created_at: "2020-01-01T00:00:00Z",
  }) as unknown as NameHistoryRow;

/** Far enough out that it stays future-dated for the life of this suite. */
export const FUTURE_DATE = "2099-01-01";

export const FIXTURES: FixtureCompany[] = [
  {
    key: "corp-multiclass",
    description:
      "Corporation, Common + Preferred, a corrected row, a future-dated row, and fractional shares",
    authorized_shares: 10000,
    shareholders: [
      { id: "sh-a", name: "Alice Nguyen" },
      { id: "sh-b", name: "Bruno Ortiz" },
      { id: "sh-c", name: "Cascade Holdings, Inc." },
    ],
    nameHistory: [],
    transactions: [
      {
        id: "t1",
        transaction_type: "initial_issuance",
        entry_type: "opening_balance",
        share_class: "Common",
        num_shares: 1000,
        transaction_date: "2019-03-01",
        effective_date: "2019-03-01",
        shareholder_id: "sh-a",
        status: "active",
      },
      {
        id: "t2",
        transaction_type: "Issuance",
        share_class: "Preferred",
        num_shares: 250.5,
        transaction_date: "2020-06-15",
        effective_date: "2020-06-15",
        shareholder_id: "sh-b",
        status: "active",
      },
      {
        id: "t3",
        transaction_type: "Issuance",
        share_class: "Common",
        num_shares: 400,
        transaction_date: "2020-07-01",
        effective_date: "2020-07-01",
        shareholder_id: "sh-c",
        // Superseded by a correction — must not count.
        status: "corrected",
      },
      {
        id: "t4",
        transaction_type: "Issuance",
        share_class: "Common",
        num_shares: 450,
        transaction_date: "2020-07-01",
        effective_date: "2020-07-01",
        shareholder_id: "sh-c",
        status: "active",
      },
      {
        id: "t5",
        transaction_type: "Issuance",
        share_class: "Common",
        num_shares: 999,
        transaction_date: FUTURE_DATE,
        effective_date: FUTURE_DATE,
        shareholder_id: "sh-a",
        // Not yet effective — must not count.
        status: "active",
      },
      {
        id: "t6",
        transaction_type: "Redemption",
        share_class: "Common",
        num_shares: 100.25,
        transaction_date: "2021-02-01",
        effective_date: "2021-02-01",
        shareholder_id: "sh-a",
        status: "active",
      },
    ],
  },
  {
    key: "llc-renamed-trust",
    description:
      "LLC where a transfer was recorded under a trust's prior name; alias index must credit the current owner",
    authorized_shares: 1000,
    shareholders: [
      { id: "sh-t", name: "Louise Revocable Trust" },
      { id: "sh-d", name: "Dana Whitfield" },
    ],
    nameHistory: [
      nh(
        "h1",
        "sh-t",
        "Ken & Louise Revocable Trust",
        "Louise Revocable Trust",
        "2023-05-10"
      ),
    ],
    transactions: [
      {
        id: "u1",
        transaction_type: "membership_issuance",
        entry_type: "opening_balance",
        share_class: "Membership",
        num_shares: 600,
        transaction_date: "2018-01-01",
        effective_date: "2018-01-01",
        shareholder_id: "sh-t",
        status: "active",
      },
      {
        id: "u2",
        transaction_type: "membership_issuance",
        entry_type: "opening_balance",
        share_class: "Membership",
        num_shares: 400,
        transaction_date: "2018-01-01",
        effective_date: "2018-01-01",
        shareholder_id: "sh-d",
        status: "active",
      },
      {
        id: "u3",
        transaction_type: "interest_transfer",
        share_class: "Membership",
        num_shares: 150,
        transaction_date: "2022-09-01",
        effective_date: "2022-09-01",
        // Recorded under the trust's pre-rename name.
        from_shareholder: "Ken & Louise Revocable Trust",
        to_shareholder: "Dana Whitfield",
        status: "active",
      },
    ],
  },
  {
    key: "corp-treasury",
    description:
      "Corporation holding treasury shares — treasury is issued but not outstanding",
    authorized_shares: 5000,
    shareholders: [
      { id: "sh-e", name: "Elena Marsh" },
      { id: "sh-tr", name: "Treasury", is_treasury: true },
    ],
    nameHistory: [],
    transactions: [
      {
        id: "v1",
        transaction_type: "initial_issuance",
        share_class: "Common",
        num_shares: 1000,
        transaction_date: "2017-04-01",
        effective_date: "2017-04-01",
        shareholder_id: "sh-e",
        status: "active",
      },
      {
        id: "v2",
        transaction_type: "Issuance",
        share_class: "Common",
        num_shares: 200,
        transaction_date: "2017-04-01",
        effective_date: "2017-04-01",
        shareholder_id: "sh-tr",
        status: "active",
      },
      {
        id: "v3",
        transaction_type: "transfer",
        share_class: "Common",
        num_shares: 50,
        transaction_date: "2021-11-01",
        effective_date: "2021-11-01",
        from_shareholder: "Elena Marsh",
        to_shareholder: "Treasury",
        status: "active",
      },
    ],
  },
  {
    key: "empty-entity",
    description: "Entity with no transactions at all",
    authorized_shares: 100,
    shareholders: [{ id: "sh-z", name: "Zoe Karras" }],
    nameHistory: [],
    transactions: [],
  },
  {
    key: "no-authorized-cap",
    description: "Entity with no authorized cap set — availableShares must stay null",
    authorized_shares: null,
    shareholders: [{ id: "sh-y", name: "Yusuf Amin" }],
    nameHistory: [],
    transactions: [
      {
        id: "w1",
        transaction_type: "opening_balance",
        entry_type: "opening_balance",
        share_class: "Common",
        num_shares: 33.3333,
        transaction_date: "2016-01-01",
        effective_date: "2016-01-01",
        shareholder_id: "sh-y",
        status: "active",
      },
    ],
  },
];
