/**
 * The two take-aways. The confirmed abstract keeps everything — quotes,
 * flags, resolutions — and carries a draft watermark until every AMBIGUOUS
 * field has a person's resolution on it (the isConfirmed convention from the
 * AuditAbstract schema). The lease_lite export is field-for-field the
 * LeaseLite shape of the Red-Flag Scanner's ReconPackage
 * (red-flag-scanner/src/engine/types.ts @ 24329d3, schema 1.1) — a copied
 * shape, never an import; the scanner-side import affordance is future work
 * and the fixture pair that pins this seam belongs in the consumer's repo
 * when it lands.
 */

import type { DraftAbstract, FieldName, Resolution } from "./types.ts";

export const DRAFT_WATERMARK = "draft — unconfirmed: ambiguous fields remain unresolved";

/** The fields still needing a human decision. */
export function unresolvedFields(draft: DraftAbstract, resolutions: Resolution[]): FieldName[] {
  const resolved = new Set(resolutions.map((r) => r.field));
  const out: FieldName[] = [];
  for (const [name, field] of Object.entries(draft.fields)) {
    if (field && field.confidence === "AMBIGUOUS" && !resolved.has(name as FieldName)) {
      out.push(name as FieldName);
    }
  }
  return out;
}

export interface AbstractExport {
  kind: "cap_clause_abstract";
  status: "confirmed" | "draft";
  watermark?: string;
  fields: DraftAbstract["fields"];
  flags: DraftAbstract["flags"];
  notwithstanding: DraftAbstract["notwithstanding"];
  resolutions: Resolution[];
  provenance: {
    workflow: "LLM drafts, human confirms, engine computes — lease-interpreter";
    confirmed_at?: string;
  };
}

export function toAbstractExport(
  draft: DraftAbstract,
  resolutions: Resolution[],
  confirmedAt?: string,
): AbstractExport {
  const open = unresolvedFields(draft, resolutions);
  const confirmed = open.length === 0;
  return {
    kind: "cap_clause_abstract",
    status: confirmed ? "confirmed" : "draft",
    ...(confirmed ? {} : { watermark: DRAFT_WATERMARK }),
    fields: draft.fields,
    flags: draft.flags,
    notwithstanding: draft.notwithstanding,
    resolutions,
    provenance: {
      workflow: "LLM drafts, human confirms, engine computes — lease-interpreter",
      ...(confirmed && confirmedAt ? { confirmed_at: confirmedAt } : {}),
    },
  };
}

/** The scanner's LeaseLite shape (copied, never imported). */
export interface LeaseLiteExport {
  _source: string;
  _status: "confirmed" | "draft";
  _watermark?: string;
  lease_lite: {
    share: {
      numerator_sf: number;
      denominator_basis: "GLA" | "GLOA" | "unknown";
    };
    cap: {
      applies_to: "controllable" | "all_cam" | "total_opex";
      pct: number;
      method: "non_cumulative" | "cumulative" | "compounded";
      basis: "amount_paid" | "actual_expenses" | "prior_cap";
      fee_treatment: "inside_cap" | "outside_cap";
    };
    fees: {
      kind: "management" | "administrative";
      rate_pct: number;
      base: "cam_only" | "cam_plus_insurance" | "all_opex" | "receipts";
    }[];
  };
}

export function toLeaseLite(
  draft: DraftAbstract,
  resolutions: Resolution[],
  share: { numerator_sf: number; denominator_basis: "GLA" | "GLOA" | "unknown" },
): LeaseLiteExport {
  const open = unresolvedFields(draft, resolutions);
  const confirmed = open.length === 0;
  const feePct = draft.fields.fee_pct?.value;
  return {
    _source: "lease-interpreter — cap clause abstract, human-confirmed workflow",
    _status: confirmed ? "confirmed" : "draft",
    ...(confirmed ? {} : { _watermark: DRAFT_WATERMARK }),
    lease_lite: {
      share,
      cap: {
        applies_to: draft.fields.applies_to.value,
        pct: draft.fields.rate_pct.value,
        method: draft.fields.method.value,
        basis: draft.fields.basis.value,
        fee_treatment: draft.fields.fee_treatment.value,
      },
      fees:
        feePct !== undefined
          ? [{ kind: "management", rate_pct: feePct, base: "cam_only" }]
          : [],
    },
  };
}
