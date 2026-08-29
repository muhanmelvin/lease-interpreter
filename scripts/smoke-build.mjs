/**
 * Build smoke check (family pattern, from cap-trap-explorer@c0f1b78). Runs
 * after `vite build`, alongside the client-data gate: the unit suite proves
 * the figures are right, this proves they were actually shipped.
 *
 *   node scripts/smoke-build.mjs            # checks dist/
 *   node scripts/smoke-build.mjs dist-single
 */

import { readdirSync, readFileSync, statSync, existsSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const target = resolve(
  root,
  process.argv[2] ?? (process.env.SINGLE_FILE === "1" ? "dist-single" : "dist"),
);

if (!existsSync(target)) {
  console.error(`smoke: ${relative(root, target)} does not exist — run the build first.`);
  process.exit(1);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const files = walk(target);
const read = (re) =>
  files.filter((f) => re.test(f)).map((f) => readFileSync(f, "utf8")).join("\n");

const html = read(/\.html$/);
const js = read(/\.(js|html)$/); // single-file builds inline the script
const css = read(/\.(css|html)$/);

const checks = [
  // The page shell
  ["the page is titled", () => html.includes("<title>Lease Interpreter</title>")],
  ["the CSP forbids outbound connections", () => html.includes("connect-src 'none'")],
  ["nothing is loaded from another host", () =>
    !/<(?:link|script|img|iframe|source)\b[^>]*\b(?:src|href)="https?:\/\//i.test(html)],

  // The workflow actually shipped
  ["the prompt builder shipped with its contract", () =>
    js.includes("FLAG, DON'T GUESS") && js.includes("EVERY FILLED FIELD CITES ITS CLAUSE")],
  ["all seven taxonomy flags reached the bundle", () =>
    [
      "BASIS_UNCLEAR",
      "METHOD_UNSTATED",
      "FIRST_YEAR_UNDEFINED",
      "CARVE_OUT_SCOPE",
      "FEE_TREATMENT_UNSTATED",
      "PARTIAL_YEAR_SILENT",
      "CARRY_PRECISION_UNSTATED",
    ].every((s) => js.includes(s))],
  ["the demo clause travels with the page", () =>
    js.includes("Controllable Operating Costs") && js.includes("Rider 3")],
  ["the planted miss is taught, not hidden", () =>
    js.includes("the dangerous quadrant")],
  ["the ladder engine reached the bundle", () =>
    js.includes("lesser of actual/cap")],
  ["the negotiation-exhibit line shipped", () =>
    js.includes("negotiation exhibit")],
  ["the draft watermark rule shipped", () =>
    js.includes("draft — unconfirmed")],
  ["the external-AI honesty line shipped", () =>
    js.includes("sends it to that service")],

  // The theme
  ["the badges are styled", () =>
    [".badge-clear", ".badge-ambiguous", ".is-miss"].every((s) => css.includes(s))],
  ["dark mode survived the build", () => css.includes("prefers-color-scheme")],
];

let failed = 0;
for (const [label, fn] of checks) {
  let ok = false;
  try {
    ok = Boolean(fn());
  } catch {
    ok = false;
  }
  if (!ok) {
    console.error(`smoke: FAILED — ${label}`);
    failed++;
  }
}

if (failed > 0) {
  console.error(
    `\nsmoke: ${failed} of ${checks.length} checks failed against ${relative(root, target)}.`,
  );
  process.exit(1);
}

console.log(
  `smoke: ${checks.length} checks passed — ${files.length} file(s) in ${relative(root, target)}.`,
);
