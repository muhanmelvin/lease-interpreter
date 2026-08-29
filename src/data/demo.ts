/**
 * The bundled demonstration: the whole flow with no AI at all.
 *
 * The clause and rider are the AI-for-Auditors course's Appendix B fixtures
 * (B-1 and B-2), synthetic by construction — the fictional Maplewood Commerce
 * Center and its fictional tenant Brightline Retail Group. Copied verbatim
 * from "Lease Audit Training Material/AI for Auditors/ai-for-auditors-course.html";
 * never replace them with client documents.
 *
 * The canned draft is hand-authored to teach the three-verdict review:
 *  - filled-correct: rate_pct (the quote checks out);
 *  - flagged: base is AMBIGUOUS with the first-year readings stated — good
 *    output, not failure (the Term commences October 1);
 *  - THE PLANTED MISS: basis says "actual_expenses", stated CLEAR, quoting
 *    "…the amount actually incurred in such preceding year" — but the clause
 *    says IRRESPECTIVE of the amount actually incurred: the words point at
 *    prior-cap ("maximum amount … payable"). Wrong value, stated confidently,
 *    with a quote that cuts the other way — the dangerous quadrant, and the
 *    reason quotes get checked.
 */

import type { DraftAbstract, ExpenseSeries, MonthlySeries } from "../engine/types.ts";

export const DEMO_CLAUSE = `§ 6.4 — Notwithstanding the foregoing, Tenant's obligation for Controllable Operating Costs in any calendar year after the Base Year shall not exceed one hundred five percent (105%) of the maximum amount of Controllable Operating Costs payable for the immediately preceding calendar year, irrespective of the amount actually incurred in such preceding year. Controllable Operating Costs for the Base Year means the actual Controllable Operating Costs incurred during the first calendar year of the Term. Real estate taxes, insurance premiums, utilities, and snow removal shall not constitute Controllable Operating Costs.`;

export const DEMO_RIDER = `Addendum Rider 3, ¶ R-9 — Notwithstanding § 6.4 of the Lease, in no event shall Landlord's management or administrative fees, however denominated, exceed three percent (3%) of the sum of Base Rent and Operating Costs actually paid by Tenant in the applicable year, and all such fees shall be included within Controllable Operating Costs for purposes of the limitation in § 6.4.`;

/** What the extraction prompt would hand the AI, for the copy box. */
export const DEMO_LEASE_TEXT = DEMO_CLAUSE + "\n\n" + DEMO_RIDER;

/**
 * The canned model draft, as JSON text exactly as a model would return it —
 * paste it in step 2 and the flow runs end to end offline.
 */
export const DEMO_DRAFT_JSON = JSON.stringify(
  {
    kind: "cap_clause_draft",
    fields: {
      applies_to: {
        value: "controllable",
        quote: "Tenant's obligation for Controllable Operating Costs in any calendar year",
        confidence: "CLEAR",
      },
      rate_pct: {
        value: 5,
        quote: "shall not exceed one hundred five percent (105%) of the maximum amount",
        confidence: "CLEAR",
      },
      method: {
        value: "compounded",
        quote: "one hundred five percent (105%) of the maximum amount of Controllable Operating Costs payable for the immediately preceding calendar year",
        confidence: "CLEAR",
      },
      basis: {
        value: "actual_expenses",
        quote: "the amount actually incurred in such preceding year",
        confidence: "CLEAR",
      },
      base: {
        value: "first_year_actual",
        quote: "the actual Controllable Operating Costs incurred during the first calendar year of the Term",
        confidence: "AMBIGUOUS",
        readings: [
          "the three-month stub from the October 1 commencement to December 31",
          "the first full calendar year of the Term",
        ],
      },
      fee_treatment: {
        value: "inside_cap",
        quote: "all such fees shall be included within Controllable Operating Costs for purposes of the limitation in § 6.4",
        confidence: "CLEAR",
      },
      cap_type: {
        value: "year_over_prior",
        quote: "for the immediately preceding calendar year",
        confidence: "CLEAR",
      },
      fee_pct: {
        value: 3,
        quote: "shall not exceed three percent (3%) of the sum of Base Rent and Operating Costs actually paid",
        confidence: "CLEAR",
      },
    },
    flags: [
      {
        flag: "FIRST_YEAR_UNDEFINED",
        readings: [
          "the three-month stub from the October 1 commencement to December 31",
          "the first full calendar year of the Term",
        ],
        note: "The Term commences October 1 and the clause does not define \"the first calendar year of the Term\".",
      },
    ],
    notwithstanding: [
      {
        section: "Addendum Rider 3, ¶ R-9",
        quote: "Notwithstanding § 6.4 of the Lease, in no event shall Landlord's management or administrative fees, however denominated, exceed three percent (3%) …",
        effect: "Caps the fee at 3% and pulls it INSIDE the § 6.4 expense cap — reversing what a reader of § 6.4 alone would conclude.",
      },
    ],
  },
  null,
  2,
);

/**
 * Where the planted miss lives, for the teaching card. The clause words —
 * "maximum amount … payable … irrespective of the amount actually incurred" —
 * make the basis the prior CAP; the draft says actual_expenses and quotes the
 * half-sentence that sounds like support while omitting "irrespective of".
 */
export const DEMO_MISS_FIELD = "basis" as const;
export const DEMO_MISS_EXPLANATION =
  'The draft reads "the amount actually incurred in such preceding year" as support for an actual-expenses basis — but the clause says the cap applies IRRESPECTIVE of the amount actually incurred, off the maximum amount PAYABLE. Those words make it compounded on the prior cap. The value is wrong, the confidence says CLEAR, and the quote cuts the other way once you read the whole sentence. This is the miss the review exists to catch: check the quote against the clause, every time.';

/**
 * Synthetic controllable-cost series for pricing the readings. Monthly from
 * the October 1, 2024 commencement through December 2025 (for the first-year
 * readings), then annual actuals for the capped years.
 */
export const DEMO_MONTHLY: MonthlySeries = {
  commencement: "2024-10-01",
  months: [
    { month: "2024-10", amount: 41_200 },
    { month: "2024-11", amount: 42_800 },
    { month: "2024-12", amount: 44_000 },
    { month: "2025-01", amount: 43_400 },
    { month: "2025-02", amount: 42_100 },
    { month: "2025-03", amount: 41_800 },
    { month: "2025-04", amount: 40_900 },
    { month: "2025-05", amount: 40_200 },
    { month: "2025-06", amount: 39_800 },
    { month: "2025-07", amount: 40_600 },
    { month: "2025-08", amount: 40_900 },
    { month: "2025-09", amount: 41_500 },
    { month: "2025-10", amount: 42_300 },
    { month: "2025-11", amount: 43_600 },
    { month: "2025-12", amount: 45_100 },
  ],
};

/** Base = the first full calendar year (2025), the draft's stated base as one reading. */
export const DEMO_SERIES: ExpenseSeries = {
  base: 502_200, // Jan–Dec 2025, from the monthly series above
  years: [
    { year: 2026, actual: 515_000 },
    { year: 2027, actual: 552_000 },
    { year: 2028, actual: 560_000 },
  ],
};
