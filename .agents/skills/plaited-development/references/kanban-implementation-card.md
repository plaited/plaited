Mode
- Implementation

Scope
- Implement a narrow code/doc/tooling slice for this repository.
- Read git history first (`git log --oneline -20`) and inspect current tree state (`git status --short`).
- Keep touched files tightly scoped to the assigned slice.

Files Allowed
- Only files explicitly listed in the card.
- Do not touch unrelated docs/source files.

Non-Goals
- No broad refactors.
- No opportunistic cleanup outside assigned files.
- No direct OpenRouter API scripts.

Required Repo Instructions
- Follow root `AGENTS.md`.
- Follow any nested `AGENTS.md` in touched scope.
- Follow the repo-local `plaited-development` skill.
- Use `search-cline-docs` when validating Cline CLI/Kanban/provider/PR-review guidance.
- Fix forward; do not revert unrelated changes.

Worktree Expectations
- Run card work in an isolated git worktree.
- Keep branch/card ownership clear.
- Pull `dev` fast-forward only where appropriate.

Validation Expectations
- Run targeted Bun tests for the changed surface.
- Run `biome check --write <affected files>`.
- If `package.json` changes, run `format-package --write package.json`.
- Run `bun --bun tsc --noEmit` when TypeScript/tooling/shared surfaces are affected.
- If `tsc` fails, classify known drift categories and state whether touched files are implicated.
- Do not relabel touched-file failures as existing drift.

Summary/Handoff Expectations
- Provide changed files, behavior changes, validation commands/results, known drift/failures,
  and confirmation of untouched unrelated files.
