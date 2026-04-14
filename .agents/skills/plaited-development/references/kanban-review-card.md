Mode
- Review

Scope
- Review an existing diff/change set only.
- Review actual changed files and claims made in the implementation summary.

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
- Use isolated review worktree/session when needed.
- Do not modify source files while reviewing.

Validation Expectations
- Verify validation claims against changed surface.
- Challenge contract bypasses (`installer`/`useExtension` bypasses, raw core event paths).
- Challenge stale docs and overclaimed validation.
- Flag touched-file TypeScript errors mislabeled as existing drift.
- Flag missing targeted tests.
- Flag missing `biome check --write`.
- Flag missing `format-package --write package.json` when `package.json` changed.

Summary/Handoff Expectations
- Findings first.
- Include open questions/assumptions and any residual risk.
