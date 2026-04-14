Mode
- Cleanup

Scope
- Perform cleanup-only maintenance in explicitly assigned files.
- Remove stale references only when verified against current code and git history.

Files Allowed
- Assigned cleanup files only.

Non-Goals
- No feature behavior changes.
- No broad refactors.
- No policy rewrites outside assigned cleanup scope.

Required Repo Instructions
- Follow root `AGENTS.md`.
- Follow any nested `AGENTS.md` in touched scope.
- Follow the repo-local `plaited-development` skill.
- Keep slice narrow and evidence-backed.
- Fix forward; do not revert unrelated changes.

Worktree Expectations
- Run in an isolated git worktree.
- Keep cleanup branch/card isolated from implementation work.

Validation Expectations
- Run validation proportional to touched surface.
- For prose-only edits, state rationale when executable tests are skipped.
- Always run required formatting/search checks for touched files.
- If executable surfaces are touched, run targeted tests/smoke commands.

Summary/Handoff Expectations
- List exactly what stale references were removed/updated and verification basis.
- Include validation commands/results and residual risks.
