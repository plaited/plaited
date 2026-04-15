Mode
- Tooling

Scope
- Change repo-level dev/CI/package/git/automation machinery not owned by one skill.
- Typical surfaces include `package.json`, `bun.lock`, `.github/workflows/*`, `.hooks/*`, and
  root-level `scripts/*` not owned by a skill.

Files Allowed
- Assigned repo tooling/config/workflow files only.
- No runtime/product implementation unless explicitly assigned.

Non-Goals
- No broad feature implementation outside tooling scope.
- No direct OpenRouter API scripts unless explicitly requested.
- Do not treat tooling as equivalent to skills.

Required Repo Instructions
- Follow root `AGENTS.md`.
- Follow any nested `AGENTS.md` in touched scope.
- Follow the repo-local `plaited-development` skill.
- Keep permissions and secrets posture tight for automation changes.
- Keep GitHub workflow permissions minimal and scoped to job needs.
- Do not weaken GitHub security settings/checks without explicit human approval.
- CodeQL default setup query suite is expected to be `extended` (security-extended equivalent).
- For issue-backed cards, ingest only after maintainer-applied `agent-ready` plus exactly one
  card-type label (`card/code`, `card/tooling`, `card/skill-pattern`, `card/skill-executable`,
  `card/eval`, `card/autoresearch`, or `card/cleanup`).
- Preserve branch strategy in GitHub settings/workflows:
  - `main`: linear/squash-only clean release branch.
  - `dev`: integration trunk that allows merge commits for `main -> dev` sync.

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
- Keep tooling changes isolated from feature cards.
- Include GitHub issue linkage in title/branch for issue-backed cards:
  - title format: `[GH-123] <short task>`
  - branch format: `agent/gh-123-<short-slug>`
- After merge, trash/delete the card worktree.
- For Kanban task worktrees, rely on card trash/delete cleanup.
- Do not continue work on a squash-merged branch.

Validation Expectations
- Run `biome check --write <affected files>`.
- Run `format-package --write package.json` if package metadata changes.
- Run `bun install --frozen-lockfile` if dependencies or lockfile change.
- Run command smoke tests for changed scripts/workflows where possible, or validate workflow YAML
  and permissions by direct inspection when not executable locally.
- Perform secret-safety checks and GitHub security-analysis checks for workflow/settings changes.
- Avoid broad GitHub permissions and ensure security-related permissions are read-only unless write
  is explicitly required.
- Current Cline/OpenRouter path remains Cline-only unless explicitly requested otherwise.
- Do not re-enable required linear history on `dev` unless the release strategy changes.
- Do not introduce merge queue requirements yet.
- Do not add branch-mutating release workflows before the issue-first release-readiness workflow
  exists.

Summary/Handoff Expectations
- Report changed tooling surfaces, validation commands/results, and permission/secret safeguards.
- Call out any workflow risks and follow-up hardening needed.
