---
name: css-schemas
description: Refresh or drift-check the generated CSS property schemas from @webref/css via the plaited CLI. Covers when to regenerate, review discipline, drift checking, and failure modes.
license: ISC
compatibility: Requires `plaited` CLI, `bun`, and a repo checkout with `@webref/css` and `css-tree` installed
---

# CSS Schemas Skill

Use this skill when working with the generated CSS property schemas at
`src/client/css.schemas.ts`. The schemas classify each CSS property into
one of three Zod schema shapes (pure keyword enum, enum-or-number, or
string-or-number catchall) parsed from `@webref/css` data.

## CLI Command

```bash
plaited --version                          # Version check
plaited css-schemas --schema input         # Discover the JSON input shape
plaited css-schemas '{"mode":"diff"}'      # Check for drift
plaited css-schemas '{"mode":"generate"}'  # Regenerate the file
plaited css-schemas --help                 # Show full usage
```

## When to Run

- After bumping `@webref/css` or `css-tree` in package.json
- When new CSS properties land in browsers and the schemas should reflect them
- When `plaited css-schemas '{"mode":"diff"}'` reports `changed: true`
  (drift detected between the committed file and what the generator would
  produce)

## The Review Discipline

1. Check for drift first:
   ```bash
   plaited css-schemas '{"mode":"diff"}'
   ```

2. If drift detected, regenerate:
   ```bash
   plaited css-schemas '{"mode":"generate"}'
   ```

3. Review the diff:
   ```bash
   git diff src/client/css.schemas.ts
   ```

4. Look for:
   - New CSS properties being classified correctly
   - Changes to existing property classifications (a property that was
     `z.union([z.string(), z.number()])` becoming a pure enum, or vice
     versa — this affects how the client validates CSS values at runtime)
   - The `keywordEnumCount` in the output helps gauge how many pure-enum
     classifications changed

5. Commit with a conventional commit message:
   ```bash
   git add src/client/css.schemas.ts
   git commit -m "chore(client): regenerate css schemas from @webref/css@<version>"
   ```

## The Drift Check (CI Gate)

Wire `plaited css-schemas '{"mode":"diff"}'` into normal CI as a gate to
catch stale or hand-edited schemas:

```yaml
- name: Check CSS schemas are up to date
  run: bun bin/plaited.ts css-schemas '{"mode":"diff"}'
```

If `changed: true`, the CI step fails with a diff showing what would
change. The fix is to regenerate and commit the update.

## Do NOT Wire into Publish CI

The `publish.yml` workflow must NOT run `plaited css-schemas`. Doing so
would silently ship unreviewed schema changes tied to whatever version of
`@webref/css` that `bun install` resolves at publish time. Schema changes
must always be reviewed and committed explicitly.

## Failure Modes

| Symptom | Cause | Fix |
|---------|-------|-----|
| `@webref/css not installed` | Running outside a repo checkout, or devDeps not installed | `bun add -d @webref/css css-tree` from the repo root |
| `changed: true` with no meaningful diff | Running against a published npm package where devDeps aren't installed | Run from a full repo checkout |
| Generated file differs in formatting | Git pre-commit hook (biome) reformats the output | Accept the hook's formatting; run generate and commit normally |

## See Also

- `bun-runtime` skill — Bun.file / Bun.write usage in the CLI command
- `code-documentation` skill — TSDoc conventions on the generator module
- `src/client/css-schema-generator.ts` — the pure generation function
- `src/cli/css-schemas.ts` — the CLI command handler
- `src/client/UI-GENERATION-PATTERNS.md` section 3a — the $host/$root/$top
  context the schemas serve
