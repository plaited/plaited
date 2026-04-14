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
- Preserve branch strategy in GitHub settings/workflows:
  - `main`: linear/squash-only clean release branch.
  - `dev`: integration trunk that allows merge commits for `main -> dev` sync.

Worktree Expectations
- Start from a fresh branch/worktree based on `origin/dev`.
- Run in an isolated git worktree.
- Target PRs at `dev` unless explicitly scoped to release/promotion work.
- Expect squash merge into `dev` for normal card work.
- Pull/sync `dev` with fast-forward only (`git fetch origin dev` then `git merge --ff-only origin/dev`).
- Keep tooling changes isolated from feature cards.
- After merge, trash/delete the card worktree.
- Do not continue work on a squash-merged branch.

Validation Expectations
- Run `biome check --write <affected files>`.
- Run `format-package --write package.json` if package metadata changes.
- Run `bun install --frozen-lockfile` if dependencies or lockfile change.
- Run command smoke tests for changed scripts/workflows where possible, or validate workflow YAML
  and permissions by direct inspection when not executable locally.
- Perform secret-safety checks for workflows and avoid broad GitHub permissions.
- Current Cline/OpenRouter path remains Cline-only unless explicitly requested otherwise.
- Do not re-enable required linear history on `dev` unless the release strategy changes.
- Do not introduce merge queue requirements yet.
- Do not add branch-mutating release workflows before the issue-first release-readiness workflow
  exists.

Summary/Handoff Expectations
- Report changed tooling surfaces, validation commands/results, and permission/secret safeguards.
- Call out any workflow risks and follow-up hardening needed.
