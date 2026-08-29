/**
 * Golden ladders. Every expected figure below was computed BY HAND from
 * base 502,200, rate 5%, actuals 515,000 / 552,000 / 560,000 — never from
 * the engine's own output.
 */
import { describe, expect, it } from "vitest";
import { computeLadder } from "../src/engine/ladder.ts";
import { expandFlag, firstYearReadings } from "../src/engine/readings.ts";
import { validateDraft } from "../src/engine/validate.ts";
import { DEMO_DRAFT_JSON, DEMO_MONTHLY, DEMO_SERIES } from "../src/data/demo.ts";

const SERIES = DEMO_SERIES.years;

function demoDraft() {
  const r = validateDraft(DEMO_DRAFT_JSON);
  if (!r.ok) throw new Error("demo draft failed validation");
  return r.draft;
}

describe("computeLadder — the three readings of one 5% clause", () => {
  it("compounded on the cap: the ceiling ratchets, irrespective of actuals", () => {
    const l = computeLadder({
      label: "compounded",
      base: 502_200,
      ratePct: 5,
      method: "compounded",
      basis: "prior_cap",
      series: SERIES,
    });
    expect(l.rows[0]!.cap).toBe(527_310); // 502,200 × 1.05
    expect(l.rows[0]!.allowed).toBe(515_000);
    expect(l.rows[1]!.cap).toBe(553_675.5); // 527,310 × 1.05
    expect(l.rows[1]!.allowed).toBe(552_000);
    expect(l.rows[2]!.cap).toBeCloseTo(581_359.275, 1); // 553,675.50 × 1.05
    expect(l.rows[2]!.allowed).toBe(560_000);
    expect(l.termAllowed).toBe(1_627_000); // nothing ever binds
  });

  it("non-cumulative over the amount paid: one bound year drags the ladder down", () => {
    const l = computeLadder({
      label: "non-cum paid",
      base: 502_200,
      ratePct: 5,
      method: "non_cumulative",
      basis: "amount_paid",
      series: SERIES,
    });
    expect(l.rows[0]!.cap).toBe(527_310);
    expect(l.rows[1]!.cap).toBe(540_750); // 515,000 × 1.05 — off what was PAID
    expect(l.rows[1]!.allowed).toBe(540_750); // the cap binds in 2027
    expect(l.rows[2]!.cap).toBe(567_787.5); // 540,750 × 1.05
    expect(l.rows[2]!.allowed).toBe(560_000);
    expect(l.termAllowed).toBe(1_615_750);
  });

  it("non-cumulative over actual expenses: the basis recovers even when the cap bound", () => {
    const l = computeLadder({
      label: "non-cum actual",
      base: 502_200,
      ratePct: 5,
      method: "non_cumulative",
      basis: "actual_expenses",
      series: SERIES,
    });
    expect(l.rows[1]!.cap).toBe(540_750);
    expect(l.rows[1]!.allowed).toBe(540_750);
    expect(l.rows[2]!.cap).toBe(579_600); // 552,000 × 1.05 — off ACTUALS, not paid
    expect(l.rows[2]!.allowed).toBe(560_000);
    expect(l.termAllowed).toBe(1_615_750);
  });

  it("cumulative: the 2026 headroom carries and 2027 clears the cap it would have hit", () => {
    const l = computeLadder({
      label: "cumulative",
      base: 502_200,
      ratePct: 5,
      method: "cumulative",
      basis: "actual_expenses",
      series: SERIES,
    });
    // 2026: 2.548785 pts used of 5, 2.451215 carried.
    expect(l.rows[0]!.cap).toBe(527_310);
    // 2027: 515,000 × (1 + 7.451215%) = 553,373.76 — the carried points are
    // exactly what lets 552,000 through.
    expect(l.rows[1]!.cap).toBeCloseTo(553_373.76, 2);
    expect(l.rows[1]!.allowed).toBe(552_000);
    expect(l.rows[2]!.allowed).toBe(560_000);
    expect(l.termAllowed).toBe(1_627_000);
    expect(l.rows[1]!.derivation).toMatch(/carried/);
  });

  it("is deterministic and rejects a non-positive base", () => {
    const input = { label: "x", base: 502_200, ratePct: 5, method: "compounded" as const, basis: "prior_cap" as const, series: SERIES };
    expect(computeLadder(input)).toEqual(computeLadder(input));
    expect(() => computeLadder({ ...input, base: 0 })).toThrow(/base must be positive/);
  });
});

describe("firstYearReadings — five defensible periods for the same three words", () => {
  it("prices the October 1 trap from the monthly series, by hand-checked sums", () => {
    const r = firstYearReadings(DEMO_MONTHLY);
    const byKey = Object.fromEntries(r.map((x) => [x.key, x.base]));
    expect(byKey["first_calendar_year"]).toBe(128_000); // Oct+Nov+Dec 2024
    expect(byKey["stub_annualized"]).toBe(512_000); // × 12/3
    expect(byKey["first_full_calendar_year"]).toBe(502_200); // Jan–Dec 2025
    expect(byKey["first_12_months"]).toBe(499_200); // Oct 2024 – Sep 2025
    expect(byKey["first_lease_year"]).toBe(630_200); // Oct 2024 – Dec 2025
    expect(r).toHaveLength(5);
  });
});

describe("expandFlag — the spread is the exhibit", () => {
  const draft = demoDraft();

  it("BASIS_UNCLEAR: three ladders, $11,250 apart on this series", () => {
    const e = expandFlag("BASIS_UNCLEAR", draft, DEMO_SERIES, DEMO_MONTHLY);
    expect(e.ladders).toHaveLength(3);
    expect(e.spread).toBe(11_250); // 1,627,000 − 1,615,750
  });

  it("METHOD_UNSTATED: three ladders, and the label alone would not have told you", () => {
    const e = expandFlag("METHOD_UNSTATED", draft, DEMO_SERIES, DEMO_MONTHLY);
    expect(e.ladders).toHaveLength(3);
    expect(e.spread).toBe(11_250);
  });

  it("FIRST_YEAR_UNDEFINED: five readings, $1,203,304 apart — the base decides the term", () => {
    const e = expandFlag("FIRST_YEAR_UNDEFINED", draft, DEMO_SERIES, DEMO_MONTHLY);
    expect(e.ladders).toHaveLength(5);
    // stub base 128,000 → term 423,696 (every year cap-bound at 5% compounding);
    // roomy bases → term 1,627,000 (never bound).
    expect(e.spread).toBe(1_203_304);
  });

  it("FEE_TREATMENT_UNSTATED prices only because the draft carries a fee percentage", () => {
    const e = expandFlag("FEE_TREATMENT_UNSTATED", draft, DEMO_SERIES, DEMO_MONTHLY);
    expect(e.ladders).toHaveLength(2);
    const noFee = { ...draft, fields: { ...draft.fields, fee_pct: undefined } };
    const e2 = expandFlag("FEE_TREATMENT_UNSTATED", noFee, DEMO_SERIES, DEMO_MONTHLY);
    expect(e2.ladders).toHaveLength(0);
    expect(e2.pricingNote).toMatch(/will not invent one/);
  });

  it("flags that need the lease's own definitions stay text-only, with the reason stated", () => {
    const e = expandFlag("CARVE_OUT_SCOPE", draft, DEMO_SERIES, DEMO_MONTHLY);
    expect(e.ladders).toHaveLength(0);
    expect(e.textReadings.length).toBeGreaterThanOrEqual(2);
    expect(e.pricingNote).toMatch(/readings are the finding/);
  });

  it("without a series, priced flags degrade to text with the reason stated", () => {
    const e = expandFlag("BASIS_UNCLEAR", draft, undefined, undefined);
    expect(e.ladders).toHaveLength(0);
    expect(e.pricingNote).toMatch(/needs an expense series/);
  });
});
