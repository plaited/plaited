# Build the `typescript-lsp` skill

You are working in a Linux sandbox with [Bun](https://bun.sh) preinstalled and
no network access. Your goal is to **author a skill** named `typescript-lsp`
and **install it** where a compliant agent would discover it.

The complete contract — skill directory layout, SKILL.md frontmatter rules,
the CLI's input/output JSON shapes, install locations, and edge cases — is in
**`/app/SPEC.md`**. Read it first; it is the source of truth for grading.

In short:

1. **Create the skill directory** with a `SKILL.md` (YAML frontmatter with
   `name` and `description`, plus a Markdown body that tells an agent how and
   when to invoke the script) and a self-contained executable CLI script at
   `scripts/typescript-lsp` (or `scripts/typescript-lsp.ts`).
2. **Implement the CLI** as JSON-in / JSON-out: a JSON string as the first
   positional argument (or JSON on stdin) in, a single JSON object on stdout
   out, mode-discriminated on `mode`. Two modes: `execute` (LSP-style requests
   against a file via the TypeScript 7 native API) and `discover` (list
   supported methods).
3. **Install the skill** at the project-level discovery location
   `/app/.agents/skills/typescript-lsp/`. Installing it user-level as well
   (`~/.agents/skills/typescript-lsp/`) is optional.

The TypeScript 7 native preview package is preinstalled at
`/app/node_modules/typescript` (version pinned in the image) — your script,
once installed under `/app/.agents/skills/`, resolves it through normal Node
module resolution. A sample TypeScript fixture is baked in at
`/opt/fixtures/sample.ts` — use it to test your CLI before you finish. The
grader recomputes expected symbols and positions from that fixture with the
TypeScript API itself, so correctness matters on every field.
