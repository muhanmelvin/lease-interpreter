# Lease Interpreter

[![CI](https://github.com/muhanmelvin/lease-interpreter/actions/workflows/ci.yml/badge.svg)](https://github.com/muhanmelvin/lease-interpreter/actions/workflows/ci.yml)

**The "LLM drafts, human confirms, engine computes" workflow as one static page — for the auditor who wants AI to read a cap clause without ever letting it decide what a number is.**

**Live:** https://interpreter.petriumalpha.com/ · **Offline:** download
[`index.html`](https://interpreter.petriumalpha.com/) and open it — the whole tool is one file.

## What it finds

Badly drafted cap language has several defensible readings — is the 5% applied
to the prior year's *cap* or its *actuals*? is "the first year" the October
stub or the first full calendar year? is the fee inside the capped pool? —
and the readings sit tens of thousands of dollars apart on the same words.
Someone at the management company has already answered those questions, in
software, in the landlord's favour.

This page runs the confirmation workflow: **build** a flag-don't-guess
extraction prompt here; **run it yourself** in the AI you already use (the
free tier is enough — this page never calls one); **paste** the draft JSON
back; the page validates it, walks every field with its supporting quote and
its CLEAR / AMBIGUOUS marker, and for each ambiguity runs the competing
readings side by side over a synthetic expense series so the disagreement has
a dollar figure on it. That comparison table is itself a negotiation exhibit.
A bundled synthetic clause and a canned draft — with one planted **miss**
(wrong value, stated confidently) — demonstrate the whole flow with no AI at
all, including why the quotes get checked.

## How it works

A pure engine validates the pasted draft (a filled field must cite its
clause), expands each ambiguity flag into its candidate readings, and computes
the cap ladders deterministically — the AI's output never touches the
arithmetic. Confirmation is explicit: every AMBIGUOUS field is resolved by a
person, and the exports carry a **draft — unconfirmed** watermark until none
remain. Two downloads: the confirmed abstract (with quotes, flags and
resolutions) and a scanner-shaped `lease_lite` JSON for the Red-Flag Scanner's
lease-terms form.

## Running it

```
npm install
npm run dev      # http://localhost:5177
npm test         # validator, ladder goldens, prompt pin, exports, privacy, client-data gate
npm run ci       # typecheck → test → build → client-data gate
```

## Architecture

- `src/engine/` — pure, DOM-free: the draft validator, the flag-to-readings
  expansion, the cap ladders (float dollars by ADR 0001, formatting via
  `money.ts`), the prompt builder, the exporters.
- `src/ui/` — thin render layer. Imports the engine; the engine never imports it.
- `src/data/` — the synthetic demo clause, its rider, and the canned draft.
- `gates/` — the client-data deny-list and the two gates that enforce it.
- `tests/` — the specification. Golden ladders pin hand-computed totals.

No framework, no router, no runtime dependencies at all.

## Privacy

This tool runs entirely in your browser. There is no server, no upload, and no
analytics inside the app: its Content-Security-Policy sets `connect-src 'none'`,
so the page cannot make a network request even if something tried — which is
also why it cannot and does not call an AI. **Pasting your lease into an
external AI service sends it to that service; this page never does.** Use the
bundled synthetic clause, or make that call yourself with your own policy in
front of you.

Everything in this repository runs on synthetic material — invented properties,
invented leases, invented numbers. A build gate scans the output and deletes it
rather than publish a client identifier.

## Disclaimer

Illustrative. Not legal, accounting, or tax advice. An extraction draft is not
an abstract until a person has confirmed every field against the lease.

## Licence

MIT — see [LICENSE](LICENSE).
