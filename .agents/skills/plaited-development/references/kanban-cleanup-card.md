Mode
- Cleanup

Scope
- Perform cleanup-only maintenance in explicitly assigned files.
- Remove stale references only when verified against current code and git history.
- Declare the cleanup lane up front: `code`, `skill-pattern`, `skill-executable`, or `tooling`.

Files Allowed
- Assigned cleanup files only.
- Lane-specific files only for the declared cleanup lane.

Non-Goals
- No feature behavior changes.
- No broad refactors.
- No policy rewrites outside assigned cleanup scope.
- Cleanup must not become behavior change.

Required Repo Instructions
- Follow root `AGENTS.md`.
- Follow any nested `AGENTS.md` in touched scope.
- Follow the repo-local `plaited-development` skill.
- Keep slice narrow, lane-declared, and evidence-backed.
- Fix forward; do not revert unrelated changes.

Worktree Expectations
- Start from a fresh branch/worktree based on `origin/dev`.
- Run in an isolated git worktree.
- Target PRs at `dev` unless explicitly scoped to release/promotion work.
- Expect squash merge into `dev` for normal card work.
- Pull/sync `dev` with fast-forward only (`git fetch origin dev` then `git merge --ff-only origin/dev`).
- Keep cleanup branch/card isolated from implementation work.
- After merge, trash/delete the card worktree.
- Do not continue work on a squash-merged branch.

Validation Expectations
- Validation follows the declared cleanup lane (`code`, `skill-pattern`,
  `skill-executable`, or `tooling`).
- Run `biome check --write <affected files>` when applicable.
- For prose-only edits, state rationale when executable tests are skipped.
- If executable surfaces are touched, run targeted tests/smoke commands.
- If TypeScript/shared/tooling resolution is affected, run `bun --bun tsc --noEmit`.

Summary/Handoff Expectations
- List exactly what stale references were removed/updated and verification basis.
- Include declared cleanup lane, validation commands/results, and residual risks.
