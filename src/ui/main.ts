/**
 * Entry point. Four steps on one page: build the prompt, paste the draft,
 * confirm field by field, take the exports away. The UI reads state, calls
 * the engine, renders — it never computes a number the engine could compute,
 * and nothing here calls a network (the CSP forbids it; so does the family).
 */

import "../shared/tokens.css";
import "../shared/app.css";
import "./styles.css";

import { buildPrompt } from "../engine/prompt.ts";
import { validateDraft } from "../engine/validate.ts";
import type { ValidationResult } from "../engine/validate.ts";
import { expandFlag } from "../engine/readings.ts";
import { toAbstractExport, toLeaseLite, unresolvedFields, DRAFT_WATERMARK } from "../engine/export.ts";
import type { DraftAbstract, ExpenseSeries, FieldName, Resolution } from "../engine/types.ts";
import {
  DEMO_DRAFT_JSON,
  DEMO_LEASE_TEXT,
  DEMO_MISS_EXPLANATION,
  DEMO_MISS_FIELD,
  DEMO_MONTHLY,
  DEMO_SERIES,
} from "../data/demo.ts";
import { $, clear, h } from "./dom.ts";

// ── State ───────────────────────────────────────────────────────────────────

interface State {
  huntNotwithstanding: boolean;
  showDemoClause: boolean;
  draftText: string;
  validation: ValidationResult | null;
  demoLoaded: boolean;
  resolutions: Resolution[];
  series: { base: string; y1: string; y2: string; y3: string };
  share: { sf: string; basis: "GLA" | "GLOA" | "unknown" };
}

const state: State = {
  huntNotwithstanding: true,
  showDemoClause: false,
  draftText: "",
  validation: null,
  demoLoaded: false,
  resolutions: [],
  series: { base: "", y1: "", y2: "", y3: "" },
  share: { sf: "", basis: "unknown" },
};

function currentDraft(): DraftAbstract | null {
  return state.validation && state.validation.ok ? state.validation.draft : null;
}

function currentSeries(): ExpenseSeries | undefined {
  const nums = [state.series.base, state.series.y1, state.series.y2, state.series.y3].map((s) => Number(s));
  if (state.series.base.trim() === "" || nums.some((n) => !Number.isFinite(n) || n <= 0)) return undefined;
  return {
    base: nums[0]!,
    years: [
      { year: 1, actual: nums[1]! },
      { year: 2, actual: nums[2]! },
      { year: 3, actual: nums[3]! },
    ],
  };
}

/** The demo's own series keeps its real years and monthly detail. */
function seriesForPricing(): { series: ExpenseSeries | undefined; monthly: typeof DEMO_MONTHLY | undefined } {
  if (state.demoLoaded) return { series: DEMO_SERIES, monthly: DEMO_MONTHLY };
  return { series: currentSeries(), monthly: undefined };
}

function usd0(x: number): string {
  return "$" + x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function offerDownload(filename: string, content: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: "application/json" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function copyText(text: string, button: HTMLButtonElement): void {
  navigator.clipboard
    .writeText(text)
    .then(() => {
      const old = button.textContent;
      button.textContent = "Copied.";
      setTimeout(() => {
        button.textContent = old;
      }, 1200);
    })
    .catch(() => {
      button.textContent = "Select and copy manually";
    });
}

// ── Step 1: build the prompt ────────────────────────────────────────────────

function renderStep1(): HTMLElement {
  const prompt = buildPrompt({ huntNotwithstanding: state.huntNotwithstanding });
  const copyBtn = h("button", { class: "ghost", type: "button" }, "Copy the prompt");
  copyBtn.addEventListener("click", () => copyText(prompt, copyBtn));

  const hunt = h("input", { type: "checkbox" });
  hunt.checked = state.huntNotwithstanding;
  hunt.addEventListener("change", () => {
    state.huntNotwithstanding = hunt.checked;
    renderAll();
  });

  return h(
    "section",
    { class: "zone step" },
    h("h2", { class: "zone-title" }, "Step 1 — Build the prompt"),
    h(
      "p",
      { class: "step-note" },
      "This page never calls an AI. Copy the prompt into the one you already use, paste your clause after the divider, and bring the JSON back. ",
      h("strong", {}, "Pasting a lease into an external AI service sends it to that service — this page never does."),
      " Use the synthetic demo clause, or make that call yourself with your own policy in front of you.",
    ),
    h(
      "label",
      { class: "check-row" },
      hunt,
      h("span", {}, "Include the notwithstanding hunt (recommended — cap language hides in riders, and six words can invalidate a one-section abstract)"),
    ),
    h("textarea", { class: "prompt-box mono", readonly: true, rows: "14", "aria-label": "The extraction prompt" }, prompt),
    h(
      "div",
      { class: "button-row" },
      copyBtn,
      h(
        "button",
        {
          class: "ghost",
          type: "button",
          onclick: () => {
            state.showDemoClause = !state.showDemoClause;
            renderAll();
          },
        },
        state.showDemoClause ? "Hide the demo clause" : "Show the synthetic demo clause",
      ),
    ),
    state.showDemoClause
      ? h(
          "div",
          { class: "demo-clause" },
          h(
            "p",
            { class: "step-note" },
            "Maplewood Commerce Center — synthetic, from the AI-for-Auditors course, Appendix B. The Term commences October 1, and Rider R-9 is the planted override the hunt must find.",
          ),
          h("blockquote", {}, DEMO_LEASE_TEXT),
        )
      : null,
  );
}

// ── Step 2: paste the draft ─────────────────────────────────────────────────

function renderStep2(): HTMLElement {
  const ta = h(
    "textarea",
    {
      class: "paste-box mono",
      rows: "10",
      "aria-label": "Paste the draft JSON",
      placeholder: "Paste the model's JSON draft here — the JSON object only, no prose, no fences.",
    },
    state.draftText,
  );
  ta.addEventListener("change", () => {
    state.draftText = ta.value;
    state.validation = ta.value.trim() === "" ? null : validateDraft(ta.value);
    state.demoLoaded = ta.value === DEMO_DRAFT_JSON;
    state.resolutions = [];
    renderAll();
  });

  const v = state.validation;
  let verdict: HTMLElement | null = null;
  if (v && !v.ok) {
    verdict = h(
      "div",
      { class: "error-box" },
      h("h3", {}, v.kind === "malformed" ? "Not JSON yet" : "Valid JSON, but not a draft abstract"),
      h("ul", {}, ...v.errors.map((e) => h("li", {}, e))),
    );
  } else if (v && v.ok) {
    verdict = h(
      "div",
      { class: "ok-box" },
      h("p", {}, "The draft parses and every filled field carries a quote. Now the part no validator can do: check each quote against the clause."),
      v.warnings.length > 0 ? h("ul", { class: "warn-list" }, ...v.warnings.map((w) => h("li", {}, w))) : null,
    );
  }

  return h(
    "section",
    { class: "zone step" },
    h("h2", { class: "zone-title" }, "Step 2 — Paste the draft"),
    ta,
    h(
      "div",
      { class: "button-row" },
      h(
        "button",
        {
          class: "ghost",
          type: "button",
          onclick: () => {
            state.draftText = DEMO_DRAFT_JSON;
            state.validation = validateDraft(DEMO_DRAFT_JSON);
            state.demoLoaded = true;
            state.resolutions = [];
            renderAll();
          },
        },
        "Load the canned demo draft (no AI needed)",
      ),
    ),
    verdict,
  );
}

// ── Step 3: confirm ─────────────────────────────────────────────────────────

const FIELD_LABEL: Record<string, string> = {
  applies_to: "What the cap applies to",
  rate_pct: "The rate",
  method: "The method",
  basis: "The basis",
  base: "The base",
  fee_treatment: "Fee treatment",
  cap_type: "Cap type",
  first_year_definition: "First-year definition",
  fee_pct: "Fee percentage",
};

const FLAG_FOR_FIELD: Partial<Record<string, DraftAbstract["flags"][number]["flag"]>> = {
  basis: "BASIS_UNCLEAR",
  method: "METHOD_UNSTATED",
  base: "FIRST_YEAR_UNDEFINED",
  first_year_definition: "FIRST_YEAR_UNDEFINED",
  fee_treatment: "FEE_TREATMENT_UNSTATED",
};

function resolutionFor(field: FieldName): Resolution | undefined {
  return state.resolutions.find((r) => r.field === field);
}

function renderLadders(exp: ReturnType<typeof expandFlag>): HTMLElement {
  if (exp.ladders.length === 0) {
    return h(
      "div",
      { class: "readings-text" },
      h("ul", {}, ...exp.textReadings.map((r) => h("li", {}, r))),
      exp.pricingNote ? h("p", { class: "pricing-note" }, exp.pricingNote) : null,
    );
  }
  const table = h(
    "table",
    { class: "spread-table" },
    h("thead", {}, h("tr", {}, h("th", {}, "Reading"), h("th", { class: "num" }, "Term total allowed"))),
    h(
      "tbody",
      {},
      ...exp.ladders.map((l) =>
        h(
          "tr",
          {},
          h(
            "td",
            {},
            h(
              "details",
              {},
              h("summary", {}, l.label),
              h("ul", { class: "derivations" }, ...l.rows.map((row) => h("li", { class: "mono" }, row.derivation))),
            ),
          ),
          h("td", { class: "num mono" }, usd0(l.termAllowed)),
        ),
      ),
    ),
  );
  return h(
    "div",
    { class: "readings-priced" },
    h("div", { class: "table-scroll" }, table),
    exp.spread !== undefined && exp.spread > 0
      ? h("p", { class: "spread-line" }, `The readings sit ${usd0(exp.spread)} apart on this series. That comparison table is itself a negotiation exhibit.`)
      : h("p", { class: "pricing-note" }, "On this series the readings happen to land together — the ambiguity is still real; a different series decides differently."),
    exp.pricingNote ? h("p", { class: "pricing-note" }, exp.pricingNote) : null,
  );
}

function renderSeriesInputs(): HTMLElement {
  if (state.demoLoaded) {
    return h(
      "p",
      { class: "step-note" },
      `Priced against the demo's synthetic series: base ${usd0(DEMO_SERIES.base)} (the first full calendar year), then actuals ${DEMO_SERIES.years
        .map((y) => usd0(y.actual))
        .join(", ")} — plus the monthly detail behind the first-year readings.`,
    );
  }
  const input = (label: string, key: keyof State["series"]): HTMLElement => {
    const el = h("input", { type: "number", min: "0", step: "0.01", value: state.series[key] || undefined, placeholder: "$" });
    el.addEventListener("change", () => {
      state.series[key] = el.value.trim();
      renderAll();
    });
    return h("label", { class: "series-field" }, h("span", {}, label), el);
  };
  return h(
    "div",
    { class: "series-row" },
    h(
      "p",
      { class: "step-note" },
      "To price the readings, enter a base and three years of the capped pool's actuals (synthetic or rounded figures are fine — the spread is the point, not the pennies):",
    ),
    h("div", { class: "series-grid" }, input("Base", "base"), input("Year 1 actual", "y1"), input("Year 2 actual", "y2"), input("Year 3 actual", "y3")),
  );
}

function renderFieldCard(
  name: string,
  field: NonNullable<DraftAbstract["fields"][FieldName]>,
  draft: DraftAbstract,
  series: ExpenseSeries | undefined,
  monthly: typeof DEMO_MONTHLY | undefined,
): HTMLElement {
  const fieldName = name as FieldName;
  const ambiguous = field.confidence === "AMBIGUOUS";
  const res = resolutionFor(fieldName);
  const isMiss = state.demoLoaded && name === DEMO_MISS_FIELD;

  let ambiguityBlock: HTMLElement | null = null;
  if (ambiguous) {
    const flag = FLAG_FOR_FIELD[name];
    const exp = flag ? expandFlag(flag, draft, series, monthly) : null;
    const readings = field.readings ?? [];

    const becauseInput = h("input", {
      type: "text",
      class: "because-input",
      placeholder: "why — what in the lease or the negotiation settles it",
      value: res?.because ?? undefined,
    });
    becauseInput.addEventListener("change", () => {
      const existing = resolutionFor(fieldName);
      if (existing) existing.because = becauseInput.value.trim();
    });
    const radios = readings.map((r) => {
      const radio = h("input", { type: "radio", name: `resolve-${name}` });
      radio.checked = res?.chosen === r;
      radio.addEventListener("change", () => {
        state.resolutions = state.resolutions.filter((x) => x.field !== fieldName);
        state.resolutions.push({ field: fieldName, chosen: r, because: becauseInput.value.trim() });
        renderAll();
      });
      return h("label", { class: "radio-row" }, radio, h("span", {}, r));
    });

    ambiguityBlock = h(
      "div",
      { class: "ambiguity-block" },
      exp ? h("h4", {}, exp.title + " — " + exp.question) : null,
      exp ? renderLadders(exp) : null,
      h(
        "div",
        { class: "resolve-box" },
        h("h4", {}, "Resolve it — a person's decision, recorded"),
        ...radios,
        becauseInput,
        res
          ? h("p", { class: "resolved-line" }, `Resolved: ${res.chosen}${res.because ? ` — ${res.because}` : ""}`)
          : h("p", { class: "unresolved-line" }, "Unresolved — the exports stay watermarked draft until this is decided."),
      ),
    );
  }

  return h(
    "article",
    { class: "field-card" + (ambiguous ? " is-ambiguous" : "") + (isMiss ? " is-miss" : "") },
    h(
      "header",
      { class: "field-head" },
      h("h3", {}, FIELD_LABEL[name] ?? name),
      h("span", { class: ambiguous ? "badge badge-ambiguous" : "badge badge-clear" }, field.confidence),
    ),
    h("p", { class: "field-value mono" }, String(field.value)),
    h("blockquote", { class: "field-quote" }, "“", field.quote, "”"),
    isMiss
      ? h("div", { class: "miss-box" }, h("h4", {}, "The planted miss — wrong value, stated confidently"), h("p", {}, DEMO_MISS_EXPLANATION))
      : null,
    ambiguityBlock,
  );
}

function renderStep3(): HTMLElement | null {
  const draft = currentDraft();
  if (!draft) return null;
  const { series, monthly } = seriesForPricing();

  const cards = Object.entries(draft.fields)
    .filter((e): e is [string, NonNullable<DraftAbstract["fields"][FieldName]>] => Boolean(e[1]))
    .map(([name, field]) => renderFieldCard(name, field, draft, series, monthly));

  const nw =
    draft.notwithstanding.length > 0
      ? h(
          "div",
          { class: "nw-block" },
          h("h3", {}, "The notwithstanding trail"),
          h(
            "ul",
            {},
            ...draft.notwithstanding.map((n) => h("li", {}, h("strong", {}, n.section + ": "), h("em", {}, "“" + n.quote + "” "), "— ", n.effect)),
          ),
        )
      : h("p", { class: "step-note" }, "The draft asserts the notwithstanding hunt found nothing — verify that against the rider list before believing it.");

  return h(
    "section",
    { class: "zone step" },
    h("h2", { class: "zone-title" }, "Step 3 — Confirm, field by field"),
    h(
      "p",
      { class: "step-note" },
      "Three verdicts per field: ",
      h("strong", {}, "filled-correct"),
      " (the quote checks out), ",
      h("strong", {}, "flagged"),
      " (an ambiguity surfaced — good output, not failure), and ",
      h("strong", {}, "missed"),
      " (wrong value, stated confidently — the dangerous quadrant, and the reason every quote gets checked against the clause: the words, not the label, decide).",
    ),
    renderSeriesInputs(),
    ...cards,
    nw,
  );
}

// ── Step 4: take it away ────────────────────────────────────────────────────

function renderStep4(): HTMLElement | null {
  const draft = currentDraft();
  if (!draft) return null;
  const open = unresolvedFields(draft, state.resolutions);
  const confirmed = open.length === 0;

  const sfInput = h("input", { type: "number", min: "1", step: "1", value: state.share.sf || undefined, placeholder: "premises SF" });
  sfInput.addEventListener("change", () => {
    state.share.sf = sfInput.value.trim();
    renderAll();
  });
  const basisSel = h(
    "select",
    {},
    ...(["unknown", "GLA", "GLOA"] as const).map((b) => {
      const o = h("option", { value: b }, b);
      o.selected = state.share.basis === b;
      return o;
    }),
  );
  basisSel.addEventListener("change", () => {
    state.share.basis = basisSel.value as State["share"]["basis"];
    renderAll();
  });

  const sf = Number(state.share.sf);
  const shareOk = Number.isFinite(sf) && sf > 0;

  return h(
    "section",
    { class: "zone step" },
    h("h2", { class: "zone-title" }, "Step 4 — Take it away"),
    confirmed
      ? h("p", { class: "ok-box" }, "Every ambiguity carries a person's resolution. The exports are confirmed.")
      : h("p", { class: "warn-box" }, `${DRAFT_WATERMARK} — still open: ${open.join(", ")}.`),
    h(
      "div",
      { class: "button-row" },
      h(
        "button",
        {
          class: "ghost",
          type: "button",
          onclick: () =>
            offerDownload(
              confirmed ? "cap-abstract.confirmed.json" : "cap-abstract.draft.json",
              JSON.stringify(toAbstractExport(draft, state.resolutions, confirmed ? new Date().toISOString().slice(0, 10) : undefined), null, 2) + "\n",
            ),
        },
        "Download the abstract (quotes, flags, resolutions)",
      ),
    ),
    h(
      "div",
      { class: "share-row" },
      h("p", { class: "step-note" }, "For the scanner-shaped lease-terms export, the share block needs two facts the cap clause cannot supply:"),
      h("label", { class: "series-field" }, h("span", {}, "Premises SF"), sfInput),
      h("label", { class: "series-field" }, h("span", {}, "Denominator basis"), basisSel),
      h(
        "button",
        {
          class: "ghost",
          type: "button",
          disabled: !shareOk || undefined,
          onclick: () =>
            offerDownload(
              confirmed ? "lease-lite.confirmed.json" : "lease-lite.draft.json",
              JSON.stringify(toLeaseLite(draft, state.resolutions, { numerator_sf: sf, denominator_basis: state.share.basis }), null, 2) + "\n",
            ),
        },
        "Download lease-terms JSON (LeaseLite shape)",
      ),
    ),
    h(
      "p",
      { class: "step-note" },
      'The lease-terms file is field-for-field the Red-Flag Scanner’s LeaseLite shape — the seed of its "lease terms derived, not typed" roadmap. Files are assembled in this page and saved by your browser; nothing is uploaded.',
    ),
  );
}

// ── Shell ───────────────────────────────────────────────────────────────────

function renderColophon(): HTMLElement {
  return h(
    "section",
    { class: "colophon" },
    h(
      "p",
      {},
      "The workflow is: LLM drafts, human confirms, engine computes. Every dollar figure on this page comes from computeLadder() — deterministic arithmetic pinned by golden tests with hand-computed totals; the AI's draft never touches it. An ambiguity the model surfaces is a finding; an ambiguity it papers over is a liability.",
    ),
  );
}

function renderAll(): void {
  const root = $("app");
  clear(root);
  root.appendChild(renderStep1());
  root.appendChild(renderStep2());
  const s3 = renderStep3();
  if (s3) root.appendChild(s3);
  const s4 = renderStep4();
  if (s4) root.appendChild(s4);
  root.appendChild(renderColophon());
}

renderAll();
