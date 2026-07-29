---
name: markdown
description: Parse, link-check, and extract YAML frontmatter from markdown documents via the `plaited markdown` CLI. Three modes — extract-links, validate-links (with rootRelative for bundle-relative `/` links), and frontmatter. Use when resolving local references, validating a documentation tree's cross-links, or reading metadata before editing docs.
license: ISC
compatibility: Requires bun and the plaited CLI
allowed-tools: Bash
---

# Markdown

Reference for an agent assisting an engineer in parsing, link-checking, and
frontmatter-extracting markdown documents. `plaited markdown` returns
structured JSON instead of scraping rendered output, so an agent can resolve
local references, validate a documentation tree, and read YAML frontmatter
without re-implementing a markdown parser. It is the tool to reach for before
editing docs, validating cross-links in a bundle, or inspecting the metadata
an author embedded at the top of a file.

## Operator surface

`plaited markdown` is a CLI command (JSON-in / JSON-out over stdio),
registered under `bin/plaited.ts`. It is **not** a library import — there is
no `plaited/markdown` public module. Invoke it as a subprocess and parse its
stdout JSON.

```bash
plaited markdown '{"mode":"extract-links","markdown":"See [guide](docs/guide.md)"}'
```

Run `plaited markdown --help` for the usage block, or
`plaited markdown --schema input` for the full Zod-derived input schema
(every mode and field, with descriptions).

## The three modes

| Mode | Input | Returns |
|------|-------|---------|
| `extract-links` | `markdown` | Sorted, de-duplicated local link targets with display text |
| `validate-links` | `directory`, `markdownBody`, optional `rootRelative` | `present` and `missing` link sets, resolved against `directory` |
| `frontmatter` | `markdown` | Parsed frontmatter object plus remaining body, or `null`/full-text fallback |

All inputs are JSON objects with a `mode` discriminator. Outputs echo the
`mode` and carry a `result`.

### `extract-links` — what links are in this text?

```bash
plaited markdown '{"mode":"extract-links","markdown":"See [guide](docs/guide.md) and ![logo](assets/logo.png)"}'
```

Returns a sorted array of `{ value, text }` for every **local** link target.
Local means: not `http(s)://`, not `mailto:`, not a fragment-only `#`. Both
markdown links (`[text](dest)`) and inline HTML (`<a href>`, `<img src>`) are
extracted; image links are included. `value` is the normalized target
(`node:path.normalize` collapses `./` and `../` segments); `text` is the link
label or the target itself when no label is present. External and
fragment-only links are dropped — this mode answers "what local files does
this document reference?", not "what URLs does it point at?".

### `validate-links` — do those links resolve?

```bash
plaited markdown '{"mode":"validate-links","directory":"./docs","markdownBody":"See [guide](guide.md) and [missing](gone.md)"}'
```

Takes a `directory` (the base to resolve against) and a `markdownBody`, runs
the same extraction as `extract-links`, then checks each target for a file at
`resolve(directory, link.value)`. Returns `{ present: [...], missing: [...] }`,
each entry `{ value, text }`. The `value` reported is the **original** link
text as written, so an engineer can find it in the source.

**`rootRelative` (default `false`).** The one option worth knowing cold. A
leading `/` in a markdown link has two reasonable meanings, and the flag
selects between them:

- `rootRelative: false` (default) — `path.resolve` semantics. A leading `/`
  is the **filesystem root**, so `directory` is discarded for that link.
  `[guide](/docs/guide.md)` checks `/docs/guide.md` on your machine, almost
  certainly not what a docs-tree link intends. This is the legacy behavior and
  is preserved as the default so existing callers don't shift silently.
- `rootRelative: true` — a leading `/` marks a **project/bundle-root-relative**
  path. The slash is stripped for resolution against `directory`, so
  `[guide](/docs/guide.md)` with `directory: "./docs-site"` checks
  `./docs-site/docs/guide.md`. The output still reports the original
  `/docs/guide.md` so error messages stay faithful to the source.

Use `rootRelative: true` for any convention that recommends leading-`/` as
root-relative — OKF bundles (see the [plaited-framework](../plaited-framework/references/okf.md) skill's OKF reference), Docusaurus, VitePress,
GitHub repo-root links. Leave it off when your links are already relative
(`./guide.md`, `guide.md`, `../index.md`) — those resolve against `directory`
either way.

### `frontmatter` — read the YAML block

```bash
plaited markdown '{"mode":"frontmatter","markdown":"---\ntype: Guide\ntitle: Hello\n---\n# Body"}'
```

Returns `{ frontmatter: { ... }, body: "..." }`. The frontmatter is returned
as a plain object (parsed as YAML, validated only as a string-keyed record);
the body is the markdown after the closing `---`, trimmed. The body is `null`
when empty (e.g. a block with no content after the closing `---`), never an
empty string.

Two cases fall back to `{ frontmatter: null, body: <the original markdown> }`:

- No frontmatter block (missing delimiters).
- The block is present but unparseable as a record — including an empty
  `---\n---` block, because empty YAML parses to `null`, which is not a
  string-keyed record. An empty block is therefore indistinguishable from no
  block by the result alone; a caller that needs to tell them apart must
  inspect the raw text.

The `null`-with-full-body shape is the signal "no usable frontmatter here".
A block with at least one key yields the object and a (possibly `null`) body.

## When to use which

| Need | Mode | Notes |
|------|------|-------|
| "What local files does this doc reference?" | `extract-links` | No filesystem access; pure parse |
| "Are this doc's local links broken?" | `validate-links` | One round-trip per document |
| "Validate a whole docs tree's cross-links" | `validate-links` per file, `directory` = repo/docs root | Add `rootRelative: true` if the tree uses leading-`/` root-relative links |
| "Read a doc's metadata before editing" | `frontmatter` | Returns the raw object; check `type`/`status`/etc. downstream |
| "Does this file have frontmatter at all?" | `frontmatter` | `null` result = no block |

## A common wiring mistake to avoid

Using `validate-links` on a tree that uses leading-`/` root-relative links
**without `rootRelative: true`**. Every such link resolves to the filesystem
root and reports `missing`, swamping the real broken links. The symptom: a
docs tree you know is healthy shows every root-relative link as missing. The
fix is the flag, not rewriting the links — the links are following a
recommended convention, the resolver just needs to know which one.

The second mistake: passing `directory` as the file's own directory when your
links are root-relative. `directory` is the **link root**, not the source
file's location. For root-relative conventions, `directory` is the bundle/docs
root the leading `/` is measured from. For relative-link conventions, pass
each file's own directory so `./guide.md` resolves next to the file.

## Inspecting the contract

`plaited markdown` is a tool to use, not code to explore. Its contract is
exposed by the standard CLI flags:

- `plaited markdown --help` — the usage block (modes, one-line summaries).
- `plaited markdown --schema input` — the full Zod-derived input schema,
  including `rootRelative`'s description. The authoritative source for what
  each mode accepts.
- `plaited markdown --schema output` — the output schema, what each mode
  returns.

## See also

- [OKF](../plaited-framework/references/okf.md) — the Open Knowledge Format,
  a markdown-plus-frontmatter convention whose bundle-relative `/` links are
  exactly the case `rootRelative: true` was added for.
- [Git context](../git-context/SKILL.md) — a sibling structured-context CLI;
  same JSON-in / JSON-out shape, different domain.
