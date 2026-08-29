import { describe, expect, it } from "vitest";
import { DRAFT_WATERMARK, toAbstractExport, toLeaseLite, unresolvedFields } from "../src/engine/export.ts";
import { validateDraft } from "../src/engine/validate.ts";
import { DEMO_DRAFT_JSON } from "../src/data/demo.ts";
import type { Resolution } from "../src/engine/types.ts";

function demoDraft() {
  const r = validateDraft(DEMO_DRAFT_JSON);
  if (!r.ok) throw new Error("demo draft failed validation");
  return r.draft;
}

const RESOLVE_BASE: Resolution = {
  field: "base",
  chosen: "the first full calendar year",
  because: "The stub understates every cap that follows; landlord's own recon used calendar year 2025 as the Base Year.",
};

describe("unresolvedFields", () => {
  it("lists exactly the AMBIGUOUS fields without a resolution", () => {
    const d = demoDraft();
    expect(unresolvedFields(d, [])).toEqual(["base"]);
    expect(unresolvedFields(d, [RESOLVE_BASE])).toEqual([]);
  });
});

describe("toAbstractExport — the watermark rule", () => {
  it("carries the draft watermark while an ambiguity is unresolved", () => {
    const e = toAbstractExport(demoDraft(), []);
    expect(e.status).toBe("draft");
    expect(e.watermark).toBe(DRAFT_WATERMARK);
    expect(e.provenance.confirmed_at).toBeUndefined();
  });

  it("drops the watermark and stamps confirmed_at once every flag is resolved", () => {
    const e = toAbstractExport(demoDraft(), [RESOLVE_BASE], "2026-08-28");
    expect(e.status).toBe("confirmed");
    expect(e.watermark).toBeUndefined();
    expect(e.provenance.confirmed_at).toBe("2026-08-28");
    expect(e.resolutions).toEqual([RESOLVE_BASE]);
  });

  it("keeps the quotes, flags and notwithstanding trail in the file", () => {
    const e = toAbstractExport(demoDraft(), [RESOLVE_BASE], "2026-08-28");
    expect(e.fields.rate_pct.quote).toContain("one hundred five percent");
    expect(e.flags[0]!.flag).toBe("FIRST_YEAR_UNDEFINED");
    expect(e.notwithstanding[0]!.section).toContain("Rider 3");
  });
});

describe("toLeaseLite — the scanner-shaped export", () => {
  const share = { numerator_sf: 42_000, denominator_basis: "unknown" as const };

  it("maps the confirmed draft field-for-field onto the LeaseLite shape", () => {
    const e = toLeaseLite(demoDraft(), [RESOLVE_BASE], share);
    expect(e).toEqual({
      _source: "lease-interpreter — cap clause abstract, human-confirmed workflow",
      _status: "confirmed",
      lease_lite: {
        share: { numerator_sf: 42_000, denominator_basis: "unknown" },
        cap: {
          applies_to: "controllable",
          pct: 5,
          method: "compounded",
          basis: "actual_expenses",
          fee_treatment: "inside_cap",
        },
        fees: [{ kind: "management", rate_pct: 3, base: "cam_only" }],
      },
    });
  });

  it("watermarks the export while unresolved, so a draft cannot pass as terms", () => {
    const e = toLeaseLite(demoDraft(), [], share);
    expect(e._status).toBe("draft");
    expect(e._watermark).toBe(DRAFT_WATERMARK);
  });

  it("emits no fee when the draft carries no fee percentage — nothing invented", () => {
    const d = demoDraft();
    const noFee = { ...d, fields: { ...d.fields, fee_pct: undefined } };
    expect(toLeaseLite(noFee, [RESOLVE_BASE], share).lease_lite.fees).toEqual([]);
  });
});
