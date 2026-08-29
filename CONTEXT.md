# Domain glossary

The words this project uses, in the sense it uses them. These are user-facing
terms — they appear in the interface, in the code and here, and they should mean
the same thing in all three. Nothing about implementation belongs in this file.

Terms below are shared across every app in the family; add the app's own
vocabulary underneath as it settles, and add it the moment it settles rather
than in a batch at the end.

## Shared vocabulary

**Operating expenses** — what the landlord spends running the property and
seeks to recover from tenants: common-area maintenance, real estate taxes,
insurance, utilities, and the fees charged on top of them.

**Reconciliation** — the landlord's year-end statement setting actual operating
expenses against what the tenant paid in estimates, and billing or crediting the
difference.

**Statement** — one year of that reconciliation as the landlord presented it:
expense lines under their own captions, the fees, and what was charged to the
tenant.

**Line** — one caption on a statement with an amount for a year.

**Controllable / non-controllable** — the landlord's classification of an
expense according to whether they can influence what it costs. Caps usually
apply only to controllables, which is why the boundary is worth money.

**Cap** — a contractual ceiling on how much a category of expense may grow. Its
reading depends on the base, the rate, whether unused headroom carries forward,
and whether the ceiling compounds.

**Pro-rata share** — the fraction of a property's expenses this tenant bears,
and the arithmetic that produces it.

**Gross-up** — restating variable expenses to what they would have cost at a
stated occupancy, so a partly-empty building does not shift cost onto the tenants
who are actually there.

**Amortization** — spreading a capital cost over its useful life instead of
charging it in the year it was incurred.

**Finding** — one thing worth raising: what it is, which year, the arithmetic
behind it, and a sentence written to go into a finding letter.

**Synthetic lease / synthetic property** — invented material used for every
public example. Never a real client's lease, site, or numbers.

## This app's vocabulary

**Draft abstract** — the structured JSON an AI produces from the extraction
prompt: per field a value, the exact supporting quote, and a CLEAR/AMBIGUOUS
marker. A draft is not an abstract until a person has confirmed every field
against the lease.

**Flag, don't guess** — the extraction contract: where the clause honestly
supports more than one reading, the drafter marks the field AMBIGUOUS and
states the competing readings, never choosing. An ambiguity surfaced is a
finding; an ambiguity papered over is a liability.

**The three verdicts** — every reviewed field is *filled-correct* (value
right, quote checks out), *flagged* (an ambiguity a human would also raise —
good output), or *missed* (wrong value, stated confidently — the dangerous
quadrant, and the reason quotes get checked).

**The seven flags** — the ambiguity taxonomy, copied verbatim from the
AuditAbstract schema: BASIS_UNCLEAR, METHOD_UNSTATED, FIRST_YEAR_UNDEFINED,
CARVE_OUT_SCOPE, FEE_TREATMENT_UNSTATED, PARTIAL_YEAR_SILENT,
CARRY_PRECISION_UNSTATED.

**The spread** — the dollar difference between competing readings, computed
by running each reading's cap ladder over the same expense series. The
comparison table is itself a negotiation exhibit.

**The notwithstanding hunt** — the search for every "notwithstanding" proviso
touching operating costs. Six words in a rider can invalidate an abstract
built from a single section; the demo's Rider R-9 is the planted example.

**Resolution** — a person's recorded decision on one AMBIGUOUS field: the
reading chosen and why. Exports carry a **draft — unconfirmed** watermark
until every ambiguity has one.

**LeaseLite export** — the lease-terms JSON in the Red-Flag Scanner's own
shape (copied, never imported), so confirmed terms can one day be imported
there instead of typed.
