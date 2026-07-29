# OKF — Open Knowledge Format

Reference for an agent assisting an engineer in **authoring, validating, and
maintaining an OKF knowledge bundle** using the Plaited framework's CLIs. OKF
(Open Knowledge Format, v0.2) is an open, human- and agent-friendly format for
*knowledge*: a directory tree of markdown files with YAML frontmatter. The
specification is external and self-contained — this reference does not restate
it. It bridges the format's requirements to the operator surface already in
this repo so an agent can drive OKF without bespoke tooling.

> **Source of truth:** the OKF spec at
> `GoogleCloudPlatform/knowledge-catalog` (`okf/SPEC.md`) defines the format.
> When this reference and the spec disagree, the spec wins. This document says
> *how to use `plaited markdown` against OKF*, not what OKF is.

## What OKF is, in one paragraph

A **bundle** is a directory of `.md` files. Each non-reserved `.md` is a
**concept** with YAML frontmatter (the only always-required key is `type`) and
a markdown body. Concepts link to each other with standard markdown links.
Reserved filenames are `index.md` (directory listing) and `log.md` (update
history). Provenance (`sources`), trust (`generated`/`verified`), lifecycle
(`status`/`stale_after`), and attested computation (§10) are optional
frontmatter families. Conformance (spec §11) is three checks; everything else
is producer discretion. The format is static and diffable by design.

## The static half maps onto `plaited markdown`

OKF's conformance and authoring surface is exactly what
[`plaited markdown`](../../markdown/SKILL.md) provides. No new CLI is needed.

| OKF need | `plaited markdown` mode | Notes |
|----------|-------------------------|-------|
| Parse a concept's frontmatter (conformance §11.1, §11.2) | `frontmatter` | Returns the object; agent checks `type` non-empty |
| Build the bundle's cross-link graph (spec §6) | `extract-links` | Local link targets with display text |
| Surface broken cross-links (§6 says tolerate, but you want to know) | `validate-links` with `rootRelative: true` | `directory` = bundle root |
| Read `index.md`/`log.md` structure | `frontmatter` + body inspection | Reserved files have no frontmatter except root `index.md`'s `okf_version` |

### Bundle-relative links: use `rootRelative: true`

OKF §6.1 recommends **bundle-relative** links beginning with `/`:

```markdown
See the [customers table](/tables/customers.md) for the join key.
```

`plaited markdown validate-links` treats a leading `/` as the filesystem root
by default (standard `path.resolve` semantics). For OKF, pass
`rootRelative: true` and `directory` = the bundle root, so `/tables/customers.md`
resolves against the bundle:

```bash
plaited markdown '{
  "mode": "validate-links",
  "directory": "./bundle",
  "markdownBody": "See [customers](/tables/customers.md) and [gone](/tables/gone.md)",
  "rootRelative": true
}'
```

Output preserves the original `/tables/customers.md` text in both `present` and
`missing`, so an engineer can locate the link in the source verbatim. See
[Markdown](../../markdown/SKILL.md) for the full semantics of the flag.

## Conformance check (spec §11) as an agent procedure

A bundle is conformant with OKF v0.2 if:

1. Every non-reserved `.md` in the tree has a parseable YAML frontmatter block.
2. Every frontmatter block has a non-empty `type`.
3. `index.md` / `log.md`, when present, follow §8 / §9 structure.

An agent checks this with a tree walk plus `plaited markdown`:

1. **Enumerate** the bundle with `Bun.Glob('**/*.md')` (or `find`), separating
   reserved filenames (`index.md`, `log.md`) from concept documents.
2. **Parse** each concept with `plaited markdown '{"mode":"frontmatter",...}'`.
   A `null` frontmatter result means no frontmatter block → fails §11.1.
3. **Check `type`** on each parsed frontmatter: must be present and non-empty
   → §11.2. Unknown `type` values are conformant; consumers MUST tolerate them.
4. **Validate cross-links** with `validate-links` + `rootRelative: true`,
   `directory` = bundle root. Broken links are **not** a conformance failure
   (§6: consumers MUST tolerate them), but surface them to the engineer as
   "not-yet-written knowledge" to review.
5. **Reserved files**: `index.md` bodies are directory listings under section
   headings; `log.md` bodies are date-grouped (`YYYY-MM-DD`) update lists. A
   root `index.md` MAY carry an `okf_version` frontmatter key — the only place
   frontmatter is permitted in an `index.md`.

Consumers MUST NOT reject a bundle for missing optional families, unknown
`type` values, extra frontmatter keys, broken links, or missing `index.md`.
Conformance is a floor, not a ceiling.

## Frontmatter families an author should populate

These are all optional; their absence is meaningful (an unverified concept is
distinguishable from a verified one). When authoring or upgrading a concept,
populate them per spec §5–§7. `plaited markdown frontmatter` returns the raw
object; the agent interprets these fields downstream.

- **`type`** (required) — short string; consumers route/filter on it. Example
  values: `BigQuery Table`, `Metric`, `Playbook`, `Reference`,
  `Attested Computation`. Not centrally registered.
- **`title`, `description`, `resource`, `tags`** (recommended) — `resource` is
  the canonical URI for the underlying asset; absent for abstract concepts.
- **`sources`** (§5.1) — list of materials a concept derives from. Each entry
  has `resource` (required), optional `id` (the footnote join key), `title`,
  and credibility signals `author` / `usage_count` / `last_modified`. A sibling
  `usage_window: { from, to }` frames `usage_count`. Attribute individual
  claims with markdown footnotes keyed to `sources[].id` (`[^ga4-schema]`), not
  positional indices — stable under reordering.
- **`generated`** (§5.2) — `{ by, at }`: the actor that produced the content
  and an ISO 8601 datetime of the last meaningful change.
- **`verified`** (§5.2) — list (or single mapping) of `{ by, at }` verification
  events. Drives the trust tier (§5.3): none → unverified; non-`human:` only →
  machine-confirmed; any `human:<id>` → human-reviewed.
- **`status`** (§5.4) — `draft` | `stable` (default) | `deprecated`.
- **`stale_after`** (§5.5) — absolute `YYYY-MM-DD`; stale when
  `today >= stale_after`. Absolute, not a TTL.
- **Actor convention** (§7) — `generated.by` / `verified[].by` use
  `<producer>/<version>` for agents, `human:<id>` for people, `process:<id>`
  for automated processes. Consumers key trust off the `human:` prefix.

## Attested computations (spec §10) are a runtime concern

A concept of `type: Attested Computation` carries a sanctioned way to compute a
value: `runtime`, `parameters`, `computation`, `executor`, and `attester`
frontmatter plus a `# Computation` body fence or file. **OKF does not execute
anything.** The spec is explicit (§1, §10.5, §12): the runtime protocol —
discover → load → parameterize → execute → receipt → attest → gate — produces
**runtime artifacts (receipts, verdicts) that are not stored in the bundle**.
The full runtime protocol, attester ABI, and attestation lifecycle are
"considered and deferred" to a future revision.

What this means for an agent:

- **Authoring** an Attested Computation concept is static: write the frontmatter
  and the `# Computation` fence/file. `plaited markdown frontmatter` validates
  the metadata is parseable; the agent checks the §10 fields are present and
  internally consistent (`runtime` present, `parameters` typed, `executor` and
  `attester` `resource` paths resolve). Nothing runs.
- **Executing and attesting** is a runtime coordination problem, not a markdown
  one. It maps onto the behavioral-programming runtime — b-threads per stage,
  `block` on failed attestations or `today >= stale_after`, `interrupt` on stale
  definitions, handlers firing executor/attester side effects. See
  [Behavioral](./behavioral.md) for that runtime. A pi extension under
  `packages/pi/` would be the right home for a persistent attestation
  orchestrator (watches a bundle, re-attests on change, gates display on the
  verdict) — but that is a separate build, not part of authoring or validating
  a bundle.
- **Verification (`verified`) ≠ attestation.** `verified` confirms the
  *definition* matches policy (doc-level, slow, stored). Attestation confirms a
  single *run* produced the value the sanctioned way (per-call, runtime, not
  stored). A stale definition can attest cleanly; a fresh definition still
  needs attestation per run. Both exist.

Do not try to run an Attested Computation by shelling out from
`plaited markdown`. The CLI handles the static contract; the runtime is
behavioral.

## Authoring loop

1. **Lay out the bundle** — a directory tree. Reserved filenames only at the
   levels they apply (`index.md` anywhere, `log.md` anywhere). Everything else
   is a concept.
2. **Write each concept** — frontmatter (`type` required; populate the
   families above as applicable) + markdown body. Use bundle-relative `/`
   links for cross-concept references (§6.1 recommendation).
3. **Self-check with `plaited markdown`** —
   `frontmatter` to confirm each concept parses and has `type`;
   `validate-links` with `rootRelative: true`, `directory` = bundle root, to
   surface broken cross-links.
4. **Run the conformance procedure** above.
5. **For Attested Computations**, author the contract now; wire execution/
   attestation via [Behavioral](./behavioral.md) only when a runtime is needed.

## A common mistake to avoid

Storing attestation results in the bundle. Receipts and verdicts are runtime
artifacts (§10.5); the bundle holds the *contract* (`executor`, `attester`,
`parameters`, `computation`), not the *evidence* of any particular run. If you
find yourself writing a `receipt` or `verdict` key into a concept's frontmatter,
stop — that belongs to the runtime layer, surfaced to consumers at display
time, not persisted in the static corpus.

The second mistake: treating broken cross-links as a build failure. §6 says
consumers MUST tolerate broken links — a link whose target doesn't exist "may
simply represent not-yet-written knowledge." Use `validate-links` to *surface*
them for the engineer, not to gate the bundle.

## See also

- [Markdown](../../markdown/SKILL.md) — the `plaited markdown` CLI this reference drives,
  including the `rootRelative` flag for bundle-relative `/` links.
- [Behavioral](./behavioral.md) — the runtime for the §10 attestation
  lifecycle that OKF deliberately leaves out of the bundle.
