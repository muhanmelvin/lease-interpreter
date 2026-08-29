/**
 * The cap ladder, trimmed to what the spread table needs: given one reading
 * of the clause (rate, method, basis) and an expense series, the per-year
 * cap, the lesser-of allowed, and the term total — with the derivation on
 * every row so the comparison table can go into a negotiation exhibit as is.
 *
 * Arithmetic is a copy (never an import) of the year-over-prior branches of
 * cap-trap-explorer/src/engine/capEngine.ts @ c0f1b78, trimmed: no CPI, no
 * base-year-excess model, no excess-expense ledger. The two copies diverge
 * freely. Dollars as floats by ADR 0001 (inherited from that engine's own
 * exemption): sub-cent intermediates are the industry's own convention here,
 * and rounding is applied to cents at each year like the source engine.
 */

import type { CapBasis, CapMethod, ExpenseSeries } from "./types.ts";

export interface LadderRow {
  year: number;
  cap: number;
  actual: number;
  /** min(actual, cap) — the lesser-of rule, unconditional. */
  allowed: number;
  derivation: string;
}

export interface LadderResult {
  /** e.g. "Compounded on the cap" — the reading this ladder prices. */
  label: string;
  method: CapMethod;
  basis: CapBasis;
  base: number;
  rows: LadderRow[];
  /** Sum of allowed over the capped years — the figure readings are compared on. */
  termAllowed: number;
}

export interface LadderInput {
  label: string;
  base: number;
  ratePct: number;
  method: CapMethod;
  basis: CapBasis;
  series: ExpenseSeries["years"];
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

function fmt(x: number): string {
  return x.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function computeLadder(input: LadderInput): LadderResult {
  const { label, base, ratePct, method, basis, series } = input;
  if (!(base > 0)) throw new Error(`computeLadder: base must be positive, got ${base}`);
  if (!(ratePct > 0 && ratePct < 100)) throw new Error(`computeLadder: ratePct out of range: ${ratePct}`);
  const r = ratePct / 100;

  const rows: LadderRow[] = [];
  let priorCap = base; // for compounded / prior_cap ladders
  let priorBasis = base; // for amount_paid / actual_expenses
  let carriedPts = 0; // cumulative headroom ledger, percentage points

  for (const y of series) {
    let cap: number;
    let derivation: string;

    if (method === "compounded" || basis === "prior_cap") {
      cap = round2(priorCap * (1 + r));
      derivation = `${y.year}: cap = prior cap ${fmt(priorCap)} × (1+${ratePct}%) = ${fmt(cap)} — grows on schedule, irrespective of actuals.`;
    } else if (method === "cumulative") {
      const availPts = ratePct + carriedPts;
      cap = round2(priorBasis * (1 + availPts / 100));
      derivation = `${y.year}: cap = prior ${basisWord(basis)} ${fmt(priorBasis)} × (1+${availPts.toFixed(2)}%) = ${fmt(cap)} (rate ${ratePct}% + carried ${carriedPts.toFixed(2)} pts).`;
    } else {
      cap = round2(priorBasis * (1 + r));
      derivation = `${y.year}: cap = ${ratePct}% over prior ${basisWord(basis)} ${fmt(priorBasis)} = ${fmt(cap)}.`;
    }

    const allowed = round2(Math.min(y.actual, cap));
    derivation += ` Actual ${fmt(y.actual)} → allowed ${fmt(allowed)} (lesser of actual/cap).`;

    if (method === "cumulative" && basis !== "prior_cap") {
      const increasePts = priorBasis > 0 ? Math.max(0, (y.actual / priorBasis - 1) * 100) : 0;
      const availPts = ratePct + carriedPts;
      const used = Math.min(availPts, increasePts);
      carriedPts = Math.round((availPts - used) * 1e6) / 1e6;
      derivation += ` Headroom: used ${used.toFixed(2)} pts, carried ${carriedPts.toFixed(2)} pts.`;
    }

    priorCap = cap;
    priorBasis = basis === "actual_expenses" ? y.actual : allowed;
    rows.push({ year: y.year, cap, actual: y.actual, allowed, derivation });
  }

  return {
    label,
    method,
    basis,
    base,
    rows,
    termAllowed: round2(rows.reduce((s, row) => s + row.allowed, 0)),
  };
}

function basisWord(basis: CapBasis): string {
  return basis === "amount_paid" ? "amount paid" : basis === "actual_expenses" ? "actual expenses" : "cap";
}
