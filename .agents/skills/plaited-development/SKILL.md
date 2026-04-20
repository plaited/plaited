---
name: plaited-development
description: Repo-local workflow for agent-authored Plaited development, review, validation, integration, and promotion.
---

# plaited-development

Use this skill for agent-authored development work in this repository. Treat root `AGENTS.md` as
baseline policy; this skill adds the current repo-local workflow for planning, reviews, and
promotion.

## 1. Purpose

- Applies only to development of this repository.
- Repo-local workflow only; not public framework documentation or cross-repo policy.
- Captures the current lightweight workflow after retiring the old issue-ingestion and local board
  automation.
- Does not define a durable backlog system. Use maintainer prompts, PRs, and explicit handoff files
  as the current source of task scope.

## 2. When To Use

- Before starting an agent-authored code change.
- Before opening, reviewing, or landing a PR/integration branch.
- Before promoting `dev` to `main`.
- During scheduled review/cleanup of agent-authored work.

## 3. Branch Strategy

- `dev` is the integration trunk and default development base.
- `main` is the clean release/publish branch.
- Normal agent-authored PRs target `dev`.
- Start feature/fix work from fresh `origin/dev` unless the task explicitly says otherwise.
- Prefer manual task worktrees under `.worktrees/<task-slug>/`.
- Merged worktrees are disposable; do not keep working on a branch after its PR was squash-merged.
- Local `dev` sync should remain fast-forward only:

```bash
git fetch origin dev
git merge --ff-only origin/dev
```

- `dev -> main` release PRs should squash-merge.
- After any squash release from `dev -> main`, sync `main` back into `dev` using a merge commit.
- Never reset/rebase/force-push `dev`.
- Direct pushes to `dev` should be explicit integration/admin operations only.

## 4. Development Lane

- Work is prompt-driven and review-driven for now.
- Keep slices narrow; avoid broad refactors unless explicitly requested.
- Use worktrees for independent coding sessions, PR reviews, and redo attempts.
- Do not assume any issue-label ingestion, board sync, direct agent executor, or advisory reviewer
  workflow exists.
- Fix forward and avoid reverting unrelated user/agent changes.
- When a task depends on a handoff prompt such as `.agent-mss-slice-prompts.md`, read that prompt
  and current `origin/dev` before reviewing or authoring work.

## 5. Review Lane

- Default to a code-review stance when asked to review a PR or worktree.
- Findings lead, ordered by severity.
- Ground findings in file/line references and concrete behavior.
- Challenge architectural drift, especially when a slice violates declared module boundaries.
- Keep summaries secondary and short.
- If no issues are found, say so and name remaining validation gaps or residual risk.

## 6. Prompt Handoffs

- Write prompts for separate coding sessions when implementation should be delegated.
- Prompts must include:
  - base branch or worktree source, usually fresh `origin/dev`
  - owned files and forbidden files
  - architectural boundary being protected
  - expected tests and typecheck commands
  - PR target branch
  - PR template requirement: read `.github/pull_request_template.md`, preserve every required
    heading exactly, and check `gh pr checks <pr-number> --repo plaited/plaited` after opening
  - review risks to call out in the final handoff
- For MSS/module slices, prefer explicit flat module files under `src/modules/` when the prompt says
  the slice belongs to the core module surface.
- Do not resurrect removed research, issue-ingestion, or local board automation unless the maintainer
  explicitly reintroduces that workflow.

## 7. Validation

- Use Bun as the default runner.
- Minimum code gate:
  1. `bun --bun tsc --noEmit`
  2. targeted tests for the changed surface
- Use broader validation when runtime behavior, shared schemas, module contracts, or CI/package
  configuration changes.
- Docs/skill-only cleanup may skip executable validation when it does not change behavior; state that
  choice in the handoff.
- If package dependencies change, update `bun.lock` with `bun install`.

## 8. Integration And Promotion

- PRs into `dev` should carry a clear description of scope, validation, and follow-up risks.
- Before opening or editing a PR, read `.github/pull_request_template.md` and preserve every
  required heading exactly.
- After opening or editing a PR, run `gh pr checks <pr-number> --repo plaited/plaited`.
- If `pr-description-lint` fails, inspect the failing job with `gh run view` and update the PR body
  with `gh pr edit` until the required heading check passes.
- Keep `dev` ahead of normal feature work; use fresh branches for redo attempts.
- Human approval is required for `dev -> main` promotion.
- Release or promotion automation may be rebuilt later, but no retired workflow should be treated as
  available unless it exists in `.github/workflows/` and current docs describe it.

## 9. Current MSS Review Boundary

- The flat module rule is active for MSS/module runtime work.
- `src/modules.ts` is the public modules boundary.
- Core module actors should be single flat files under `src/modules/` unless a newer prompt says
  otherwise.
- Do not create nested `src/modules/<feature>/` implementation folders for these slices.
- Do not preserve legacy module files just to avoid migration when the prompt requires replacement.
- Review Slice 5 and later work against the exact files and forbidden paths in
  `.agent-mss-slice-prompts.md`.
