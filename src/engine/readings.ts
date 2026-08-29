/**
 * Expands an ambiguity flag into its candidate readings and, where the data
 * allows, prices each one: the ladders run side by side and the dollar spread
 * between them is the point. "That comparison table is itself a negotiation
 * exhibit."
 *
 * Where pricing would need data nobody entered, the flag is expanded as text
 * with the reason stated — never a guessed number. Flag, don't guess, applies
 * to this page too.
 */

import { computeLadder } from "./ladder.ts";
import type { LadderResult } from "./ladder.ts";
import type {
  CapAmbiguityFlag,
  CapBasis,
  CapMethod,
  DraftAbstract,
  ExpenseSeries,
  MonthlySeries,
} from "./types.ts";

export interface FlagExpansion {
  flag: CapAmbiguityFlag;
  title: string;
  question: string;
  /** Priced readings, when the data allows. */
  ladders: LadderResult[];
  /** max − min of the ladders' term totals, dollars. */
  spread?: number;
  /** Text-only readings, when pricing isn't possible; reason states why. */
  textReadings: string[];
  pricingNote?: string;
}

export const FLAG_INFO: Record<CapAmbiguityFlag, { title: string; question: string; readings: string[] }> = {
  BASIS_UNCLEAR: {
    title: "Basis unclear",
    question: "Does next year's percentage apply to the prior year's expenses, the prior year's amount paid, or the prior cap?",
    readings: ["5% over the prior year's amount paid", "5% over the prior year's actual expenses", "5% over the prior year's cap"],
  },
  METHOD_UNSTATED: {
    title: "Method unstated",
    question: "Cumulative, compounded, or neither — the clause names no method, and the words are not interchangeable.",
    readings: ["Non-cumulative (a low year drags the ceiling down)", "Cumulative (unused headroom carries)", "Compounded (the ceiling ratchets up on schedule)"],
  },
  FIRST_YEAR_UNDEFINED: {
    title: "First year undefined",
    question: 'The base is "the first year\'s expenses" — and the term did not start on January 1. Which period is the first year?',
    readings: [
      "The stub from commencement to December 31, as incurred",
      "The stub, annualized",
      "The first full calendar year",
      "The first twelve months of the term",
      "The Lease Year as defined (through the December 31 after the twelfth full month)",
    ],
  },
  CARVE_OUT_SCOPE: {
    title: "Carve-out scope",
    question: "Which categories fall outside the capped pool — is trash a utility? The lease's own definitions answer, not the invoice header.",
    readings: ["The carve-out list read narrowly (more stays under the cap)", "The carve-out list read broadly (more escapes it)"],
  },
  FEE_TREATMENT_UNSTATED: {
    title: "Fee treatment unstated",
    question: "Is the management/administrative fee inside the capped pool or outside it? A fee dropped outside escapes the cap entirely.",
    readings: ["Fee inside the capped pool", "Fee outside the cap"],
  },
  PARTIAL_YEAR_SILENT: {
    title: "Partial year silent",
    question: "No proration rule for the stub at commencement or expiration — an unannualized stub base understates every cap that follows.",
    readings: ["Stub periods prorated by term fraction", "Stub periods taken as incurred, unannualized"],
  },
  CARRY_PRECISION_UNSTATED: {
    title: "Carry precision unstated",
    question: "A cumulative cap needs a ledger, and the industry's own worked examples disagree on rounding — exact, rounded, or truncated points?",
    readings: ["Carry kept exact", "Carry rounded to 2 decimal points", "Carry truncated to 2 decimal points"],
  },
};

const METHOD_LABEL: Record<CapMethod, string> = {
  non_cumulative: "Non-cumulative over prior basis",
  cumulative: "Cumulative, headroom carried",
  compounded: "Compounded on the cap",
};

const BASIS_LABEL: Record<CapBasis, string> = {
  amount_paid: "over the prior amount paid",
  actual_expenses: "over the prior actual expenses",
  prior_cap: "on the prior cap",
};

function withSpread(exp: FlagExpansion): FlagExpansion {
  if (exp.ladders.length >= 2) {
    const totals = exp.ladders.map((l) => l.termAllowed);
    exp.spread = Math.round((Math.max(...totals) - Math.min(...totals)) * 100) / 100;
  }
  return exp;
}

/** Sum a month range [from, to] inclusive, "YYYY-MM" keys. */
function sumMonths(m: MonthlySeries, from: string, to: string): number {
  return m.months.filter((x) => x.month >= from && x.month <= to).reduce((s, x) => s + x.amount, 0);
}

export interface FirstYearReading {
  key: string;
  label: string;
  period: string;
  base: number;
}

/**
 * The five defensible readings of "the first year", priced from a monthly
 * series — the 6-to-18-month trap from the industry's cap-traps material,
 * reproduced on synthetic dates.
 */
export function firstYearReadings(m: MonthlySeries): FirstYearReading[] {
  const [yStr, mStr] = m.commencement.split("-");
  const y = Number(yStr);
  const startMonth = `${yStr}-${mStr}`;
  const decSame = `${y}-12`;
  const nextY = y + 1;
  const stub = sumMonths(m, startMonth, decSame);
  const stubMonths = 12 - Number(mStr) + 1;
  const fullCal = sumMonths(m, `${nextY}-01`, `${nextY}-12`);
  // First 12 months of the term.
  const endM = Number(mStr) - 1;
  const first12To = endM === 0 ? `${y}-12` : `${nextY}-${String(endM).padStart(2, "0")}`;
  const first12 = sumMonths(m, startMonth, first12To);
  // Lease Year: through the December 31 after the twelfth full month.
  const leaseYear = sumMonths(m, startMonth, `${nextY}-12`);

  const readings: FirstYearReading[] = [
    {
      key: "first_calendar_year",
      label: "First calendar year (the stub, as incurred)",
      period: `${m.commencement} – ${y}-12-31 (${stubMonths} months)`,
      base: stub,
    },
    {
      key: "stub_annualized",
      label: "The stub, annualized",
      period: `${m.commencement} – ${y}-12-31, × 12/${stubMonths}`,
      base: Math.round(((stub * 12) / stubMonths) * 100) / 100,
    },
    {
      key: "first_full_calendar_year",
      label: "First full calendar year",
      period: `${nextY}-01-01 – ${nextY}-12-31 (12 months)`,
      base: fullCal,
    },
    {
      key: "first_12_months",
      label: "First twelve months of the term",
      period: `${m.commencement} – ${first12To} (12 months)`,
      base: first12,
    },
    {
      key: "first_lease_year",
      label: "Lease Year as defined",
      period: `${m.commencement} – ${nextY}-12-31 (${stubMonths + 12} months)`,
      base: leaseYear,
    },
  ];
  return readings;
}

export function expandFlag(
  flag: CapAmbiguityFlag,
  draft: DraftAbstract,
  series: ExpenseSeries | undefined,
  monthly: MonthlySeries | undefined,
): FlagExpansion {
  const info = FLAG_INFO[flag];
  const out: FlagExpansion = { flag, title: info.title, question: info.question, ladders: [], textReadings: [] };
  const rate = draft.fields.rate_pct.value;
  const noSeries = "Dollar spread needs an expense series — enter one (or load the demo) and the readings get priced.";

  switch (flag) {
    case "BASIS_UNCLEAR": {
      if (!series) {
        out.textReadings = info.readings;
        out.pricingNote = noSeries;
        break;
      }
      const bases: CapBasis[] = ["amount_paid", "actual_expenses", "prior_cap"];
      out.ladders = bases.map((b) =>
        computeLadder({
          label: `${rate}% ${BASIS_LABEL[b]}`,
          base: series.base,
          ratePct: rate,
          // "Three different ladders": the basis question IS the ladder
          // question, so each candidate is priced as its own year-over-prior
          // reading — a compounded method would collapse them into one.
          method: b === "prior_cap" ? "compounded" : "non_cumulative",
          basis: b,
          series: series.years,
        }),
      );
      out.pricingNote = "Each basis priced as its own ladder — three readings of what the percentage applies to.";
      break;
    }
    case "METHOD_UNSTATED": {
      if (!series) {
        out.textReadings = info.readings;
        out.pricingNote = noSeries;
        break;
      }
      const methods: CapMethod[] = ["non_cumulative", "cumulative", "compounded"];
      out.ladders = methods.map((mth) =>
        computeLadder({
          label: METHOD_LABEL[mth],
          base: series.base,
          ratePct: rate,
          method: mth,
          basis: mth === "compounded" ? "prior_cap" : draft.fields.basis.value,
          series: series.years,
        }),
      );
      out.pricingNote = "Priced with the draft's basis as stated; the method is what varies here.";
      break;
    }
    case "FEE_TREATMENT_UNSTATED": {
      const feePct = draft.fields.fee_pct?.value;
      if (!series || feePct === undefined) {
        out.textReadings = info.readings;
        out.pricingNote = series
          ? "Dollar spread needs the fee percentage — the draft carries none, and this page will not invent one."
          : noSeries;
        break;
      }
      const scale = 1 + feePct / 100;
      out.ladders = [
        computeLadder({
          label: `Fee inside the cap (pool × ${scale.toFixed(2)})`,
          base: Math.round(series.base * scale * 100) / 100,
          ratePct: rate,
          method: draft.fields.method.value,
          basis: draft.fields.basis.value,
          series: series.years.map((yr) => ({ year: yr.year, actual: Math.round(yr.actual * scale * 100) / 100 })),
        }),
        computeLadder({
          label: `Fee outside the cap (${feePct}% escapes the limit)`,
          base: series.base,
          ratePct: rate,
          method: draft.fields.method.value,
          basis: draft.fields.basis.value,
          series: series.years,
        }),
      ];
      out.pricingNote = `Outside the cap, the ${feePct}% fee is billed on top of the allowed figures with no ceiling — the ladders compare the capped pools; the uncapped fee is the difference that never shows.`;
      break;
    }
    case "FIRST_YEAR_UNDEFINED": {
      if (!monthly || !series) {
        out.textReadings = info.readings;
        out.pricingNote = "Dollar spread needs a monthly series from commencement — the demo clause shows the shape.";
        break;
      }
      out.ladders = firstYearReadings(monthly).map((rdg) =>
        computeLadder({
          label: `${rdg.label} — base ${rdg.base.toLocaleString("en-US", { minimumFractionDigits: 2 })} (${rdg.period})`,
          base: rdg.base,
          ratePct: rate,
          method: draft.fields.method.value,
          basis: draft.fields.basis.value,
          series: series.years,
        }),
      );
      out.pricingNote = "Five defensible periods for the same three words — the base moves by months of spend, and every cap in the term follows it.";
      break;
    }
    default:
      out.textReadings = info.readings;
      out.pricingNote =
        flag === "CARRY_PRECISION_UNSTATED"
          ? "Priced only when a cumulative ledger runs long enough for the rounding to bite — read the clause's words; they control."
          : "A dollar figure here would need the lease's own category definitions — the readings are the finding.";
  }
  return withSpread(out);
}
