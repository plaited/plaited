Mode
- Code

Scope
- Implement a narrow shipped-code slice for this repository.
- Prioritize framework/runtime/library changes, usually under `src/`.
- Keep touched files tightly scoped to the assigned lane.

Files Allowed
- Only files explicitly listed in the card.
- Runtime/library code, directly related tests, and directly related schema/type files.
- Do not touch unrelated docs, skills, or tooling surfaces.

Non-Goals
- No broad refactors outside assigned scope.
- No opportunistic cleanup outside assigned files.
- No direct OpenRouter API scripts.

Required Repo Instructions
- Follow root `AGENTS.md`.
- Follow any nested `AGENTS.md` in touched scope.
- Follow the repo-local `plaited-development` skill.
- Use `search-cline-docs` only when claims depend on Cline/Kanban/provider behavior.
- Fix forward; do not revert unrelated changes.

Worktree Expectations
- Start from a fresh branch/worktree based on `origin/dev`.
- Run card work in an isolated git worktree.
- Target PRs at `dev` unless explicitly scoped to release/promotion work.
- Expect squash merge into `dev` for normal card work.
- Pull/sync `dev` with fast-forward only (`git fetch origin dev` then `git merge --ff-only origin/dev`).
- After merge, trash/delete the card worktree.
- Do not continue work on a squash-merged branch.

Validation Expectations
- Run targeted Bun tests for the changed surface.
- Run `biome check --write <affected files>`.
- Run `bun --bun tsc --noEmit` when TypeScript/shared/runtime surfaces are affected.
- Run schema/frontier/UI/agent-specific tests as appropriate to touched behavior.
- If validation or typecheck fails from known drift, classify failure categories and state whether
  touched files are implicated.
- Do not relabel touched-file failures as existing drift.

Summary/Handoff Expectations
- Provide changed files, behavior changes, validation commands/results, known drift/failures,
  and confirmation of untouched unrelated files.
