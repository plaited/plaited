# Build the `git-context` skill

You are working in a Linux sandbox with [Bun](https://bun.sh) preinstalled and no
network access. Your goal is to **author a skill** named `git-context` and
**install it** where a compliant agent would discover it.

The complete contract — skill directory layout, SKILL.md frontmatter rules, the
CLI's input/output JSON shapes, install locations, and edge cases — is in
**`/app/SPEC.md`**. Read it first; it is the source of truth for grading.

In short:

1. **Create the skill directory** with a `SKILL.md` (YAML frontmatter with
   `name` and `description`, plus a Markdown body that tells an agent how and
   when to invoke the script) and a self-contained executable CLI script at
   `scripts/git-context` (or `scripts/git-context.ts`).
2. **Implement the CLI** as JSON-in / JSON-out: a JSON string as the first
   positional argument (or JSON on stdin) in, a single JSON object on stdout
   out, mode-discriminated on `mode`. Four modes: `status`, `history`,
   `worktrees`, `context`.
3. **Install the skill** at the project-level discovery location
   `/app/.agents/skills/git-context/`. Installing it user-level as well
   (`~/.agents/skills/git-context/`) is optional.

A deterministic git fixture builder is baked into the sandbox at
`/opt/fixtures/build-git-fixture.sh` — use it to test your CLI before you
finish. The grader rebuilds fresh fixtures and recomputes expected values from
git itself, so correctness matters on every mode.
