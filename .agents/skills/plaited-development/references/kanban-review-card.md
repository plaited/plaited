Mode
- Review

Scope
- Review an existing diff/change set only.
- Review actual changed files and claims made in the change summary.

Files Allowed
- Read-only review of files in the provided diff.
- No code or docs edits.

Non-Goals
- No implementation changes.
- No speculative redesign outside findings.

Required Repo Instructions
- Follow root `AGENTS.md` review posture.
- Follow any nested `AGENTS.md` in touched scope.
- Follow the repo-local `plaited-development` skill.
- Findings first, ordered by severity, with file/line references.
- If no findings, state that explicitly and include residual risks/testing gaps.

Worktree Expectations
- Read-only review can run without creating a worktree.
- If a manual review worktree is needed, prefer `.worktrees/<review-slug>/` from `origin/dev`.
- For manual Cline CLI review sessions, use `cline --cwd .worktrees/<review-slug>`.
- In Cline Worktrees UI, choose `.worktrees/<review-slug>/` when prompted for a folder path.
- If review is run as a Cline Kanban card, use the tool-managed task worktree path under
  `~/.cline/worktrees/<task-id>/<workspace-folder-label>/`.
- If a Kanban review card creates a task worktree, move the card to trash/delete when review is
  complete so cleanup runs.
- Do not modify source files while reviewing.

Review freshness
- Check whether the PR branch is current/mergeable against `dev`.
- If stale or conflicted, request the owning agent update from fresh `origin/dev`.
- Do not recommend workflow-based auto-updates unless explicitly requested.

Validation Expectations
- Verify validation claims against changed surface.
- Verify normal card PRs target `dev`.
- Verify release PRs target `main` only when explicitly scoped.
- Consume deterministic GitHub security facts when provided (`CodeQL`, `Dependabot`,
  `secret-scanning`) before making security conclusions.
- Do not override deterministic security findings by opinion.
- Flag any reset/rebase/force-push instruction for `dev`.
- If reviewing release/promotion work, verify a `main -> dev` sync plan exists after squash
  release.
- If reviewing workflow/settings changes, verify they do not accidentally require linear history on
  `dev`.
- Flag open high/critical security alerts that touch changed files.
- Challenge contract bypasses (`installer`/`useExtension` bypasses, raw core event paths).
- Challenge stale docs, validation overclaims, and lane mismatch.
- Flag touched-file TypeScript errors mislabeled as existing drift.
- Flag missing targeted tests.
- Flag missing `biome check --write`.
- Flag missing `format-package --write package.json` when `package.json` changed.

Summary/Handoff Expectations
- Findings first.
- Include open questions/assumptions and any residual risk.
