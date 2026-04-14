---
name: plaited-development
description: Repo-local workflow for agent-authored Plaited development, review, validation, integration, and promotion.
---

# plaited-development

Use this skill for agent-authored development work in this repository. Treat root `AGENTS.md` as
baseline policy; this skill adds a concise operational workflow for lanes, reviews, and promotion.

## 1. Purpose

- Applies only to development of this repository.
- Repo-local workflow only; not public framework documentation or cross-repo policy.
- This is the committed local workflow direction for agent-authored development.
- Cline CLI is the provider/auth/agent CLI surface in this workflow.

## 2. When To Use

- Before starting an agent-authored code change.
- Before opening, reviewing, or landing a PR/integration branch.
- Before promoting `dev` to `main`.
- During scheduled review/cleanup of agent-authored work.

## 3. Branch Strategy

- `dev` is the integration trunk and default branch.
- `main` is the clean release/publish branch.
- Normal agent/Kanban card PRs target `dev`.
- Agent/Kanban card PRs should squash-merge into `dev` unless explicitly doing
  release/sync work.
- Merged card branches/worktrees are disposable.
- After a card PR is merged, trash/delete the card worktree and start future work from fresh
  `origin/dev`.
- Do not keep working on a branch after its PR was squash-merged.
- Local `dev` sync should remain fast-forward only:

```bash
git fetch origin dev
git merge --ff-only origin/dev
```

- `dev -> main` release PRs should squash-merge.
- After any squash release from `dev -> main`, sync `main` back into `dev` using a merge commit.
- Never reset/rebase/force-push `dev`.
- `delete_branch_on_merge` is safe for short-lived PR head branches; it does not delete protected
  base branches like `dev`.
- `dev` may not yet require PRs at the GitHub ruleset level, but normal card work should still
  land through PRs into `dev`.
- Direct pushes to `dev` should be explicit integration/admin operations only.

## 4. Development Lane

- Cline Kanban is the primary local orchestration lane for Plaited agent work.
- Each Kanban card should run in its own git worktree.
- Keep slices narrow; avoid broad refactors unless explicitly requested.
- Do not push directly to `main` for normal card work.
- Fix forward and avoid reverting unrelated user/agent changes.

## 5. Kanban Policy

- Use task-scoped cards for `code`, `skill-pattern`, `skill-executable`, `tooling`, `review`,
  `cleanup`, `eval`, and `autoresearch`.
- Auto-commit and auto-PR are allowed for narrow, scoped cards.
- Linked/dependent cards are allowed when file boundaries and sequencing are clear.
- Move completed or abandoned cards to trash so ephemeral worktrees are cleaned up.
- Review card diffs before landing any card output.
- PRs opened from Kanban work should have the advisory Cline PR review workflow available.
- Keep human approval for `dev -> main` promotion.

## 5.1 Card Taxonomy

- `code` means shipped framework/runtime/library code, usually under `src/`.
- `skill-pattern` means prose/pattern/context guidance in skills.
- `skill-executable` means skill-owned scripts/tests/workflow wrappers.
- `tooling` means repo-level dev/CI/package/git/automation machinery not owned by a skill.
- `review` means read-only diff review.
- `cleanup` means stale reference/removal work, and each cleanup card must declare whether the
  cleanup lane is `code`, `skill-pattern`, `skill-executable`, or `tooling`.
- `eval` means structured agentic evaluation of models/prompts/cards/workflows/reviewers.
- `autoresearch` means bounded metric-driven autonomous mutation loops over a declared editable
  asset.
- Tooling is not the same as skills.
- Skills may contain tooling only when the tooling is owned by the skill workflow.
- Generic `docs/` should not be the default home for repo guidance; prefer skills for durable
  agent-facing patterns and workflow knowledge.
- Public/user-facing docs are still allowed when explicitly scoped.

## 6. Review Lane

- Report findings first, ordered by severity, with file/line references.
- Challenge contract bypasses, especially raw module/export paths that bypass
  `useExtension`/installer policy.
- Verify changed files and validation/test results before endorsing implementation claims.
- If no findings exist, say so explicitly and list residual risks/testing gaps.

## 7. Validation Contract

- Run targeted Bun tests for the changed surface.
- Run `biome check --write <affected files>` for touched files.
- If `package.json` is touched, run `format-package --write package.json`.
- Run `bun --bun tsc --noEmit` when TypeScript/executable code changes, shared types/schemas
  change, package/tooling changes affect TS resolution, or area impact is broad.
- If `tsc` fails from known repo drift, classify failure categories and state whether any failures
  point at touched files.
- Do not relabel new touched-file failures as existing drift.

### Skill-Specific Validation

- Do not treat all skill changes as docs-only.
- For prose-only `SKILL.md`/reference edits, executable tests may be skipped with rationale, but
  search validation and formatting must still run.
- If a skill's `scripts/`, `tests/`, package metadata, command wrappers, or executable examples are
  touched, run relevant skill tests and/or smoke commands.
- For MCP/search skills with wrapper scripts, run at least one wrapper smoke check when wrapper
  code or invocation docs change.

## 8. Provider Policy (Cline + OpenRouter)

- OpenRouter is only used through Cline/Kanban in this workflow.
- Default provider/model is OpenRouter `minimax/minimax-m2.7`.
- Local setup should source `OPENROUTER_API_KEY` from Varlock.
- GitHub workflows may use repo secret `OPENROUTER_API_KEY`.
- Do not add direct OpenRouter API calls/scripts.
- Do not add non-Cline OpenRouter CI flows.
- Do not commit secrets.

## 9. Summary / Handoff Contract

- Summaries must include all of: changed files, behavior changed, validation commands/results,
  known failures/drift, and unrelated untracked files left untouched.
- Handoff prompts for follow-on sessions must include mode, scope, files, validation, and explicit
  non-goals.

## 10. Release / Promotion Strategy

- Land reviewed agent branches through `dev` before any promotion work.
- Release-readiness is issue-first for now:
  - scheduled/manual agent review covers `main..dev`
  - opens/updates a release-readiness issue
  - human decides whether to open `dev -> main` PR
- Later, a workflow may open/update the release PR automatically when readiness packets are
  trustworthy.
- Human approval remains required for `dev -> main`.
- Publish remains human-gated or release-environment-gated.
- `dev -> main` release PRs should squash-merge.
- After squash release, `main -> dev` sync merge commit is required.
- Do not reset/rebase/force-push `dev` to make release history line up.

### 10.1 Release-Readiness Agent Output Shape

```yaml
ready: true | false
reason: string
risk_level: P0 | P1 | P2 | none
suggested_version_bump: string
release_notes_draft: string
required_human_checks: string[]
blocking_items: string[]
included_prs_or_commits: string[]
changed_surfaces: string[]
validation_summary: string
main_to_dev_sync_required: true | false
```

### 10.2 Decision Rule

- If any `P0` exists: do not open a release PR; open/update readiness issue with blockers.
- If any `P1` exists: open/update readiness issue and recommend fixes before release.
- If only `P2`/`none` and checks pass: mark ready and recommend opening `dev -> main` PR.
- Publish still requires human approval.

### 10.3 P0/P1 Release-Readiness Rubric

`P0` blockers:
- secrets exposed
- package publishing broken
- runtime install/import broken
- core behavioral/agent contracts bypassed
- destructive GitHub workflow permissions
- failing touched-file tests
- tsc failures in touched files
- release PR would require reset/rebase/force-push of `dev`

`P1` blockers:
- missing tests for runtime behavior
- stale public exports
- stale skill instructions that affect future agents
- CI/review workflow silently disabled
- dependency/lockfile risk
- broad drift not classified
- missing `main -> dev` sync plan after squash release

### 10.4 Planned Release Workflows

1. Release-readiness issue workflow
   - scheduled/manual
   - reviews `main..dev`
   - opens/updates a release-readiness issue
   - does not mutate branches
2. Open-release-PR workflow
   - human-triggered at first
   - opens/updates `dev -> main` PR
   - includes readiness packet, release notes draft, validation summary, and `P0`/`P1` checklist
3. Post-release sync workflow
   - runs after squash merge to `main` or by manual dispatch
   - merges `main` back into `dev` with a merge commit
   - never resets/rebases/force-pushes `dev`

### 10.5 Merge Queue Policy

- Merge queues are deferred.
- Do not add merge queue requirements yet.
- Revisit when agent PR volume is high, required checks are stable, conflicts are frequent, and
  auto-merge into `dev` is trusted.

## 11. Hard Stops

- Stop and ask when unexpected unrelated changes appear.
- Stop before destructive Git operations.
- Stop if passing tests would require weakening installer/core contracts.
- Stop if requested implementation conflicts with verified current code.

## 12. Pi/Fanout Transition Note

- Existing `pi` and fanout tooling remains in place during this transition.
- Do not remove or refactor existing `pi`/fanout tooling in this slice.
- Any long-term lane replacement decision still requires human review of quality, reliability,
  cleanup hygiene, and cost.

## 13. Card Templates

- Use the reference templates in `references/` for copy-pasteable Kanban cards:
  `kanban-code-card.md`, `kanban-skill-pattern-card.md`,
  `kanban-skill-executable-card.md`, `kanban-tooling-card.md`,
  `kanban-review-card.md`, `kanban-cleanup-card.md`, `kanban-eval-card.md`, and
  `kanban-autoresearch-card.md`.
