# ADR 0001 — The cap ladder computes in float dollars, not integer cents

Status: accepted, 2026-08-28.

## Context

The family rule is integer cents everywhere, dollars only at the file
boundary (`src/engine/money.ts`). This app's `src/engine/ladder.ts` is a
trimmed copy of cap-trap-explorer's cap engine
(`cap-trap-explorer/src/engine/capEngine.ts @ c0f1b78`), whose own ADR 0001
exempts cap arithmetic from that rule: cap clauses state per-square-foot
figures and percentage carries whose intermediates are legitimately sub-cent,
and *where* rounding lands is a per-lease model knob rather than an
implementation detail — the industry's own worked examples disagree on it.

## Decision

The exemption travels with the copy. `ladder.ts` computes in float dollars,
rounds to cents at each year the way the source engine does, and cleans
binary noise from percentage-point carries. `money.ts` stays in the repo for
formatting and for any future integer-cents surface, and is not used inside
the ladder.

## Consequences

- Golden tests pin hand-computed dollar figures, so a drift in rounding
  behaviour is a red test, not a quiet divergence.
- The two engine copies (here and cap-trap-explorer) diverge freely — copy,
  never import, no sync obligation. This ladder deliberately dropped CPI
  rates, the base-year-excess model and the excess-expense ledger; anyone
  tempted to re-add them should read the source engine first.
- The spread figures shown on the page are comparisons of like-rounded
  ladders, which is what makes the comparison table usable as an exhibit.
