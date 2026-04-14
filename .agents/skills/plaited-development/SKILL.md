---
name: plaited-development
description: Repo-local workflow for agent-authored Plaited development, review, validation, integration, and promotion.
---

# plaited-development

Use this skill for agent-authored development work in this repository. Treat root `AGENTS.md` as
the baseline policy; this skill adds a concise operational workflow for lanes, reviews, and
promotion.

## 1. Purpose

- Applies only to development in `/Users/eirby/Workspace/plaited`.
- Repo-local workflow only; it is not public framework documentation or cross-repo policy.
- Covers agent-authored feature/fix branches, review sessions, integration/promotion work, and
  scheduled cleanup/gardening.

## 2. When To Use

- Before starting an agent-authored code change.
- Before opening, reviewing, or landing a PR/integration branch.
- Before promoting `dev` to `main`.
- During scheduled review/cleanup of agent-authored work.

## 3. Development Lane

- Prefer short-lived implementation branches/worktrees named like `agent/<area>-<short-id>`.
- Do not push directly to `main`.
- Do not push directly to `dev` unless you are explicitly in integration mode.
- Treat `dev` as a temporary integration trunk while broad drift is known; it is not a dumping
  ground.
- Fix forward and avoid reverting unrelated user/agent changes.
- Keep slices narrow; do not run broad refactors unless explicitly requested.

## 4. Review Lane

- Report findings first, ordered by severity, with file/line references.
- Challenge contract bypasses, especially raw module/export paths that bypass
  `useExtension`/installer policy.
- Verify changed files and validation/test results before endorsing implementation claims.
- If no findings exist, say so explicitly and list residual risks/testing gaps.

## 5. Validation Contract

- Run targeted Bun tests for the changed surface.
- Run `bun --bun tsc --noEmit` when executable code changes, shared types/schemas change, or area
  impact is broad.
- If `tsc` fails from known repo drift, classify failure categories and state whether any failures
  point at touched files.
- Do not relabel new touched-file failures as existing drift.
- For docs/chore-only changes, executable validation may be skipped when behavior is unchanged;
  state that rationale explicitly.

## 6. Summary / Handoff Contract

- Implementation summaries must include all of: changed files, behavior changed, validation
  commands/results, known failures/drift, and unrelated untracked files left untouched.
- Handoff prompts for follow-on sessions must include mode, scope, files, validation, and explicit
  non-goals.

## 7. Integration / Promotion

- Land agent branches through review into `dev` while this workflow is maturing.
- Promote `dev -> main` only through explicit human approval or scheduled human review.
- Squash/rebase/promotion steps must preserve a clear conventional commit message.
- Do not mix cleanup/gardening with feature slices unless explicitly requested.

## 8. Hard Stops

- Stop and ask when unexpected unrelated changes appear.
- Stop before destructive Git operations.
- Stop if passing tests would require weakening installer/core contracts.
- Stop if requested implementation conflicts with verified current code.

## 9. Cline Kanban Pilot Policy

- Install Cline CLI and Kanban as repo-local `devDependencies`; run them through `bun run` scripts,
  not global installs.
- Treat Cline CLI as the provider-auth and agent CLI surface for local operator workflows.
- Cline Kanban may be used as the local orchestration board for Plaited agent work.
- Keep work card/task-scoped and run tasks in isolated git worktrees.
- Use Kanban cards across implementation, review, cleanup, and benchmarking slices.
- Review card diffs before landing any card output.
- Prefer opening PRs or landing reviewed commits over direct push to `dev`.
- Keep explicit human approval for promotion from `dev` to `main`.
- Treat Kanban autonomy as experimental risk: current docs note experimental features that bypass
  permissions/runtime hooks. Use worktree isolation and review outputs before landing.

## 10. Provider Policy (Cline + OpenRouter)

- OpenRouter is a model provider behind Cline/Kanban, not a direct Plaited repo API dependency in
  this workflow.
- Configure OpenRouter in Cline provider settings when needed; do not wire direct OpenRouter API
  calls into repo tooling.
- Do not add OpenRouter CI jobs for this repo-local development workflow.
- Do not add repo-owned OpenRouter scripts in this slice.
- Do not commit API keys.
- GitHub repo secret `OPENROUTER_API_KEY` may exist for future Cline/GitHub integrations, but this
  workflow must not assume direct in-repo OpenRouter API use.
- Keep local Cline/OpenRouter credentials in local provider config or approved secret management.

## 11. Pi/Fanout Transition Note

- If the Cline Kanban pilot proves reliable, it may replace current `pi`/manual fanout patterns
  over time.
- Do not remove or refactor existing `pi`/fanout tooling in this slice.
- Any replacement decision requires pilot validation of task decomposition, worktree cleanup,
  review quality, and cost.

## 12. Suggested Pilot Cards

- Reviewer card: run one known recent diff through a review card and verify finding quality.
- Cleanup card: make a narrow workflow doc/skill cleanup and validate lane hygiene.
- Benchmark card: compare two OpenRouter-backed Cline reviewer models on the same review prompt.
