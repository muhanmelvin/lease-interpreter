/**
 * The draft abstract: what the extraction prompt asks the AI to produce, and
 * what a person confirms field by field. Modelled on the CapModel block of
 * the Recon Forensics AuditAbstract schema (recon-forensics/schema/types.ts,
 * schema 0.1, as mirrored in cap-trap-explorer@c0f1b78) — a copy, never an
 * import, trimmed to the fields the confirmation walk needs.
 *
 * The ambiguity-flag taxonomy is copied verbatim from that schema: seven
 * flags, each a named way one cap clause can honestly be read twice. A flag
 * the model raises is GOOD output; a wrong value stated confidently — the
 * miss — is the dangerous quadrant.
 */

export type Confidence = "CLEAR" | "AMBIGUOUS";

/** Every filled field must cite the words it came from. */
export interface Field<T> {
  value: T;
  /** The exact clause language supporting the value. Required — no quote, no field. */
  quote: string;
  confidence: Confidence;
  /** For AMBIGUOUS fields: the competing readings, stated, never resolved by the AI. */
  readings?: string[];
}

export type AppliesTo = "controllable" | "all_cam" | "total_opex";
export type CapType = "year_over_prior" | "year_over_base_year";
export type CapMethod = "non_cumulative" | "cumulative" | "compounded";
export type CapBasis = "amount_paid" | "actual_expenses" | "prior_cap";
export type BaseKind = "first_year_actual" | "stated_amount" | "base_year_expenses";
export type FirstYearDefinition =
  | "first_lease_year"
  | "first_full_calendar_year"
  | "first_calendar_year"
  | "first_12_months";
export type FeeTreatment = "inside_cap" | "outside_cap";

/** The seven flags, verbatim from the AuditAbstract schema. */
export const CAP_AMBIGUITY_FLAGS = [
  "BASIS_UNCLEAR",
  "METHOD_UNSTATED",
  "FIRST_YEAR_UNDEFINED",
  "CARVE_OUT_SCOPE",
  "FEE_TREATMENT_UNSTATED",
  "PARTIAL_YEAR_SILENT",
  "CARRY_PRECISION_UNSTATED",
] as const;
export type CapAmbiguityFlag = (typeof CAP_AMBIGUITY_FLAGS)[number];

export interface FlagEntry {
  flag: CapAmbiguityFlag;
  /** The competing readings, in the drafter's words. */
  readings: string[];
  note?: string;
}

export interface NotwithstandingEntry {
  section: string;
  quote: string;
  /** What the proviso overrides, in one sentence. */
  effect: string;
}

/** The shape the prompt instructs the AI to return. */
export interface DraftAbstract {
  kind: "cap_clause_draft";
  fields: {
    applies_to: Field<AppliesTo>;
    rate_pct: Field<number>;
    method: Field<CapMethod>;
    basis: Field<CapBasis>;
    base: Field<BaseKind>;
    fee_treatment: Field<FeeTreatment>;
    cap_type?: Field<CapType>;
    first_year_definition?: Field<FirstYearDefinition>;
    fee_pct?: Field<number>;
  };
  flags: FlagEntry[];
  /** Every "notwithstanding" proviso found — the six words that invalidate a one-section abstract. */
  notwithstanding: NotwithstandingEntry[];
}

export const REQUIRED_FIELDS = [
  "applies_to",
  "rate_pct",
  "method",
  "basis",
  "base",
  "fee_treatment",
] as const;
export type RequiredFieldName = (typeof REQUIRED_FIELDS)[number];
export type FieldName = keyof DraftAbstract["fields"];

/** A person's decision on one AMBIGUOUS field. */
export interface Resolution {
  field: FieldName;
  /** The reading chosen, in words. */
  chosen: string;
  /** Why — what in the lease or the negotiation settles it. */
  because: string;
}

/** The annual expense series the ladders price readings against. */
export interface ExpenseSeries {
  /** The base amount the first ladder year grows from, dollars. */
  base: number;
  years: { year: number; actual: number }[];
}

/** A monthly series, for pricing the first-year readings. */
export interface MonthlySeries {
  /** Term commencement, "YYYY-MM-DD". */
  commencement: string;
  /** Consecutive months from commencement, "YYYY-MM" + dollars. */
  months: { month: string; amount: number }[];
}
