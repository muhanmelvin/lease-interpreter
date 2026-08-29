/**
 * Hand-rolled validator for the pasted draft JSON. No AJV in the bundle
 * (family precedent: the scanner's upload path). Two failure registers:
 * malformed JSON, and valid JSON that is not a draft abstract — each with
 * errors a person can act on.
 *
 * The one rule with teeth: a filled field must cite its clause. A value
 * without a quote is unverifiable, and unverifiable is how a miss — wrong
 * value, stated confidently — gets past a reviewer.
 */

import { CAP_AMBIGUITY_FLAGS, REQUIRED_FIELDS } from "./types.ts";
import type { CapAmbiguityFlag, DraftAbstract, FieldName } from "./types.ts";

export type ValidationResult =
  | { ok: true; draft: DraftAbstract; warnings: string[] }
  | { ok: false; kind: "malformed" | "wrong-shape"; errors: string[] };

const ENUMS: Record<string, readonly string[]> = {
  applies_to: ["controllable", "all_cam", "total_opex"],
  method: ["non_cumulative", "cumulative", "compounded"],
  basis: ["amount_paid", "actual_expenses", "prior_cap"],
  base: ["first_year_actual", "stated_amount", "base_year_expenses"],
  fee_treatment: ["inside_cap", "outside_cap"],
  cap_type: ["year_over_prior", "year_over_base_year"],
  first_year_definition: [
    "first_lease_year",
    "first_full_calendar_year",
    "first_calendar_year",
    "first_12_months",
  ],
};

const NUMERIC_FIELDS = new Set(["rate_pct", "fee_pct"]);
const OPTIONAL_FIELDS = new Set(["cap_type", "first_year_definition", "fee_pct"]);

function isRecord(x: unknown): x is Record<string, unknown> {
  return typeof x === "object" && x !== null && !Array.isArray(x);
}

function checkField(name: string, raw: unknown, errors: string[]): void {
  if (!isRecord(raw)) {
    errors.push(`fields.${name} must be an object { value, quote, confidence } — the draft has ${JSON.stringify(raw)}`);
    return;
  }
  const { value, quote, confidence, readings } = raw;

  if (NUMERIC_FIELDS.has(name)) {
    if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value >= 100) {
      errors.push(`fields.${name}.value must be a percentage number between 0 and 100 — the draft said ${JSON.stringify(value)}`);
    }
  } else {
    const allowed = ENUMS[name];
    if (allowed && (typeof value !== "string" || !allowed.includes(value))) {
      errors.push(`fields.${name}.value must be one of ${allowed.join(" | ")} — the draft said ${JSON.stringify(value)}`);
    }
  }

  if (typeof quote !== "string" || quote.trim().length === 0) {
    errors.push(`fields.${name} has a value but no supporting quote — a filled field must cite its clause`);
  }

  if (confidence !== "CLEAR" && confidence !== "AMBIGUOUS") {
    errors.push(`fields.${name}.confidence must be "CLEAR" or "AMBIGUOUS" — the draft said ${JSON.stringify(confidence)}`);
  } else if (confidence === "AMBIGUOUS") {
    if (!Array.isArray(readings) || readings.length < 2 || !readings.every((r) => typeof r === "string" && r.trim() !== "")) {
      errors.push(`fields.${name} is AMBIGUOUS but does not state at least two competing readings — flag, don't gesture`);
    }
  }
}

export function validateDraft(text: string): ValidationResult {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch (e) {
    return {
      ok: false,
      kind: "malformed",
      errors: [
        `This isn't JSON yet: ${e instanceof Error ? e.message : String(e)}`,
        "Paste the model's JSON output only — no surrounding prose, no markdown fences.",
      ],
    };
  }

  const errors: string[] = [];
  const warnings: string[] = [];

  if (!isRecord(parsed)) {
    return { ok: false, kind: "wrong-shape", errors: ["The draft must be a JSON object — this is valid JSON, but not a draft abstract."] };
  }
  if (parsed.kind !== "cap_clause_draft") {
    errors.push(`kind must be "cap_clause_draft" — the prompt states the exact output shape; this file says ${JSON.stringify(parsed.kind)}`);
  }
  const fields = parsed.fields;
  if (!isRecord(fields)) {
    errors.push("fields is missing or not an object");
  } else {
    for (const name of REQUIRED_FIELDS) {
      if (!(name in fields)) errors.push(`fields.${name} is missing — required for a cap clause draft`);
      else checkField(name, fields[name], errors);
    }
    for (const [name, raw] of Object.entries(fields)) {
      if ((REQUIRED_FIELDS as readonly string[]).includes(name)) continue;
      if (OPTIONAL_FIELDS.has(name)) checkField(name, raw, errors);
      else warnings.push(`fields.${name} is not part of the draft shape — kept in the file, ignored by the walk`);
    }
  }

  const flags = parsed.flags;
  if (!Array.isArray(flags)) {
    errors.push("flags must be an array (empty is fine — it means the drafter found no ambiguity)");
  } else {
    flags.forEach((f, i) => {
      if (!isRecord(f) || typeof f.flag !== "string" || !(CAP_AMBIGUITY_FLAGS as readonly string[]).includes(f.flag)) {
        errors.push(`flags[${i}].flag must be one of the seven taxonomy flags: ${CAP_AMBIGUITY_FLAGS.join(", ")}`);
      } else if (!Array.isArray(f.readings) || f.readings.length < 2) {
        errors.push(`flags[${i}] (${f.flag}) must state at least two competing readings — a flag without readings is a shrug`);
      }
    });
  }

  const nw = parsed.notwithstanding;
  if (!Array.isArray(nw)) {
    errors.push('notwithstanding must be an array (empty means the hunt found none — say so, don\'t omit it)');
  } else {
    nw.forEach((n, i) => {
      if (!isRecord(n) || typeof n.section !== "string" || typeof n.quote !== "string" || typeof n.effect !== "string") {
        errors.push(`notwithstanding[${i}] must carry section, quote and effect`);
      }
    });
  }

  if (errors.length > 0) return { ok: false, kind: "wrong-shape", errors };

  // Cross-checks that are warnings, not rejections.
  const d = parsed as unknown as DraftAbstract;
  const flagged = new Set(d.flags.map((f) => f.flag));
  for (const [name, field] of Object.entries(d.fields)) {
    if (field && field.confidence === "AMBIGUOUS") {
      const expected: Partial<Record<string, CapAmbiguityFlag>> = {
        basis: "BASIS_UNCLEAR",
        method: "METHOD_UNSTATED",
        base: "FIRST_YEAR_UNDEFINED",
        first_year_definition: "FIRST_YEAR_UNDEFINED",
        fee_treatment: "FEE_TREATMENT_UNSTATED",
      };
      const want = expected[name];
      if (want && !flagged.has(want)) {
        warnings.push(`fields.${name} is AMBIGUOUS but the ${want} flag was not raised — the flag list and the field markers should agree`);
      }
    }
  }

  return { ok: true, draft: d, warnings };
}
