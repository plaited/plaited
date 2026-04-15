Mode
- Skill-Executable

Scope
- Implement or modify skill-owned executable surfaces.
- Use when touching `skills/*/scripts`, `skills/*/tests`, `.agents/skills/*/scripts`,
  executable examples, or command wrappers.

Files Allowed
- Assigned skill executable files and directly related skill docs/wrappers.
- No unrelated runtime feature work.

Non-Goals
- No broad refactors outside assigned skill scope.
- No direct OpenRouter API scripts.
- Do not claim "skill-only" means docs-only when executable files change.

Required Repo Instructions
- Follow root `AGENTS.md`.
- Follow any nested `AGENTS.md` in touched scope.
- Follow the repo-local `plaited-development` skill.
- Use `search-cline-docs` only when validating Cline/Kanban/provider behavior.

Worktree Expectations
- Start from a fresh branch/worktree based on `origin/dev`.
- For manual worktree creation, prefer `.worktrees/<card-slug>/`.
- For manual Cline CLI runs, use `cline --cwd .worktrees/<card-slug>`.
- In Cline Worktrees UI, choose `.worktrees/<card-slug>/` when prompted for a folder path.
- If running through Cline Kanban, use the tool-managed task worktree path under
  `~/.cline/worktrees/<task-id>/<workspace-folder-label>/`.
- Target PRs at `dev` unless explicitly scoped to release/promotion work.
- Expect squash merge into `dev` for normal card work.
- Pull/sync `dev` with fast-forward only (`git fetch origin dev` then `git merge --ff-only origin/dev`).
- Keep skill execution changes isolated from unrelated cards.
- After merge, trash/delete the card worktree.
- For Kanban task worktrees, rely on card trash/delete cleanup.
- Do not continue work on a squash-merged branch.

Before final handoff
- Fetch `origin/dev`.
- Update this PR branch from `origin/dev` using a normal merge/update-branch flow.
- Resolve conflicts in this worktree if they occur.
- Rerun affected validation after the update.
- Do not rebase/force-push shared PR branches unless explicitly instructed.

Validation Expectations
- Run relevant skill tests and/or smoke commands for touched executable surfaces.
- Run `biome check --write <affected files>`.
- Run `bun --bun tsc --noEmit` when TypeScript/tooling/shared resolution is affected.
- If MCP/search wrapper code or invocation docs change, run at least one wrapper smoke check.
- If `tsc` fails from known drift, classify failure categories and identify touched-file impact.

Summary/Handoff Expectations
- Provide changed files, executable behavior changes, and validation commands/results.
- Call out any known drift with touched-file vs non-touched-file attribution.
