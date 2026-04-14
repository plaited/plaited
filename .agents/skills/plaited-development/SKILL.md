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

## 3. Development Lane

- Cline Kanban is the primary local orchestration lane for Plaited agent work.
- Each Kanban card should run in its own git worktree.
- Keep slices narrow; avoid broad refactors unless explicitly requested.
- Use `dev` as the integration trunk.
- Do not push directly to `main`.
- Local branches/worktrees should pull `dev` with fast-forward only where appropriate.
- Fix forward and avoid reverting unrelated user/agent changes.

## 4. Kanban Policy

- Use task-scoped cards for implementation, review, cleanup, and benchmarking.
- Auto-commit and auto-PR are allowed for narrow, scoped cards.
- Linked/dependent cards are allowed when file boundaries and sequencing are clear.
- Move completed or abandoned cards to trash so ephemeral worktrees are cleaned up.
- Review card diffs before landing any card output.
- PRs opened from Kanban work should have the advisory Cline PR review workflow available.
- Keep human approval for `dev -> main` promotion.

## 5. Review Lane

- Report findings first, ordered by severity, with file/line references.
- Challenge contract bypasses, especially raw module/export paths that bypass
  `useExtension`/installer policy.
- Verify changed files and validation/test results before endorsing implementation claims.
- If no findings exist, say so explicitly and list residual risks/testing gaps.

## 6. Validation Contract

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

## 7. Provider Policy (Cline + OpenRouter)

- OpenRouter is only used through Cline/Kanban in this workflow.
- Default provider/model is OpenRouter `minimax/minimax-m2.7`.
- Local setup should source `OPENROUTER_API_KEY` from Varlock.
- GitHub workflows may use repo secret `OPENROUTER_API_KEY`.
- Do not add direct OpenRouter API calls/scripts.
- Do not add non-Cline OpenRouter CI flows.
- Do not commit secrets.

## 8. Summary / Handoff Contract

- Summaries must include all of: changed files, behavior changed, validation commands/results,
  known failures/drift, and unrelated untracked files left untouched.
- Handoff prompts for follow-on sessions must include mode, scope, files, validation, and explicit
  non-goals.

## 9. Integration / Promotion

- Land reviewed agent branches through `dev` before mainline promotion.
- Promote `dev -> main` only through explicit human approval or scheduled human review.
- Squash/rebase/promotion steps must preserve clear conventional commit messaging.
- Do not mix cleanup/gardening with feature slices unless explicitly requested.

## 10. Hard Stops

- Stop and ask when unexpected unrelated changes appear.
- Stop before destructive Git operations.
- Stop if passing tests would require weakening installer/core contracts.
- Stop if requested implementation conflicts with verified current code.

## 11. Pi/Fanout Transition Note

- Existing `pi` and fanout tooling remains in place during this transition.
- Do not remove or refactor existing `pi`/fanout tooling in this slice.
- Any long-term lane replacement decision still requires human review of quality, reliability,
  cleanup hygiene, and cost.

## 12. Card Templates

- Use the reference templates in `references/` for copy-pasteable Kanban cards:
  `kanban-implementation-card.md`, `kanban-review-card.md`,
  `kanban-cleanup-card.md`, and `kanban-benchmark-card.md`.
