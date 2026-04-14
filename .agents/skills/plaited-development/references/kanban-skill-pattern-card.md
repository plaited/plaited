Mode
- Skill-Pattern

Scope
- Edit skill prose/pattern/context guidance for agent workflow quality.
- Use for `SKILL.md` and prose-only references under `skills/*` or `.agents/skills/*`.
- Verify guidance against current code and `git log` history before rewriting policy text.

Files Allowed
- Assigned `SKILL.md`, skill references, and other prose-only skill assets.
- No executable scripts/tests/wrappers unless explicitly assigned.

Non-Goals
- No executable skill implementation unless explicitly in scope.
- No runtime/product feature implementation.
- No direct OpenRouter API scripts.

Required Repo Instructions
- Follow root `AGENTS.md`.
- Follow any nested `AGENTS.md` in touched scope.
- Follow the repo-local `plaited-development` skill.
- Keep skill guidance repo-local and evidence-backed.

Worktree Expectations
- Start from a fresh branch/worktree based on `origin/dev`.
- Run in an isolated git worktree.
- Target PRs at `dev` unless explicitly scoped to release/promotion work.
- Expect squash merge into `dev` for normal card work.
- Pull/sync `dev` with fast-forward only (`git fetch origin dev` then `git merge --ff-only origin/dev`).
- After merge, trash/delete the card worktree.
- Do not continue work on a squash-merged branch.

Validation Expectations
- Use search validation with `rg` checks for renamed/removed references and policy consistency.
- Run `biome check --write <affected files>` when applicable.
- Executable tests may be skipped only with an explicit prose-only rationale.
- If executable surfaces are touched, switch to `skill-executable` lane expectations.

Summary/Handoff Expectations
- List changed files and exact policy/template references updated.
- Include `rg`/format validation commands/results and explicit rationale when executable tests are
  skipped.
