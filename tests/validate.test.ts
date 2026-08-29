import { describe, expect, it } from "vitest";
import { validateDraft } from "../src/engine/validate.ts";
import { DEMO_DRAFT_JSON } from "../src/data/demo.ts";

function wrongShape(errs: RegExp[]): (r: ReturnType<typeof validateDraft>) => void {
  return (r) => {
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.kind).toBe("wrong-shape");
    for (const re of errs) expect(r.errors.join("\n")).toMatch(re);
  };
}

describe("validateDraft — the two failure registers", () => {
  it("malformed JSON gets the malformed message, not a shape lecture", () => {
    const r = validateDraft("this is not json {");
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.kind).toBe("malformed");
      expect(r.errors[0]).toMatch(/isn't JSON yet/);
      expect(r.errors.join(" ")).toMatch(/no markdown fences/);
    }
  });

  it("valid JSON that isn't a draft says what a draft is", () => {
    wrongShape([/kind must be "cap_clause_draft"/])(validateDraft('{"hello": "world"}'));
  });

  it("a filled field without a quote is rejected — no quote, no field", () => {
    const d = JSON.parse(DEMO_DRAFT_JSON);
    d.fields.rate_pct.quote = "";
    wrongShape([/rate_pct has a value but no supporting quote/])(validateDraft(JSON.stringify(d)));
  });

  it("an AMBIGUOUS field must state at least two readings", () => {
    const d = JSON.parse(DEMO_DRAFT_JSON);
    d.fields.base.readings = ["only one"];
    wrongShape([/base is AMBIGUOUS but does not state at least two competing readings/])(
      validateDraft(JSON.stringify(d)),
    );
  });

  it("enum values are policed with the draft's own value echoed back", () => {
    const d = JSON.parse(DEMO_DRAFT_JSON);
    d.fields.method.value = "escalating";
    wrongShape([/method\.value must be one of non_cumulative \| cumulative \| compounded — the draft said "escalating"/])(
      validateDraft(JSON.stringify(d)),
    );
  });

  it("a flag outside the seven-name taxonomy is rejected", () => {
    const d = JSON.parse(DEMO_DRAFT_JSON);
    d.flags.push({ flag: "VIBES_UNCLEAR", readings: ["a", "b"] });
    wrongShape([/must be one of the seven taxonomy flags/])(validateDraft(JSON.stringify(d)));
  });

  it("a missing notwithstanding array is rejected — an empty hunt is asserted, not omitted", () => {
    const d = JSON.parse(DEMO_DRAFT_JSON);
    delete d.notwithstanding;
    wrongShape([/notwithstanding must be an array/])(validateDraft(JSON.stringify(d)));
  });
});

describe("validateDraft — the canned demo draft", () => {
  it("validates clean, planted miss and all", () => {
    const r = validateDraft(DEMO_DRAFT_JSON);
    expect(r.ok).toBe(true);
    if (r.ok) {
      // The miss is a WRONG VALUE WITH A QUOTE — structurally valid by design.
      // The validator checks shape; the human checks the quote. That division
      // of labour is the lesson.
      expect(r.draft.fields.basis.value).toBe("actual_expenses");
      expect(r.draft.flags[0]!.flag).toBe("FIRST_YEAR_UNDEFINED");
      expect(r.warnings).toEqual([]);
    }
  });

  it("warns when a field is AMBIGUOUS but its taxonomy flag was not raised", () => {
    const d = JSON.parse(DEMO_DRAFT_JSON);
    d.flags = [];
    const r = validateDraft(JSON.stringify(d));
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.warnings.join(" ")).toMatch(/FIRST_YEAR_UNDEFINED flag was not raised/);
    }
  });

  it("tolerates unknown extra fields with a warning, not a rejection", () => {
    const d = JSON.parse(DEMO_DRAFT_JSON);
    d.fields.gross_up = { value: "all", quote: "x", confidence: "CLEAR" };
    const r = validateDraft(JSON.stringify(d));
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.warnings.join(" ")).toMatch(/gross_up is not part of the draft shape/);
  });
});
