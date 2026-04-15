Mode
- Autoresearch

Scope
- Run a bounded metric-driven autonomous improvement loop over a declared editable asset.
- Use only when there is a clear metric, repeatable validation command, and explicit
  accept/reject rule.

Editable Asset
- Declare the specific file(s) or narrowly bounded surface that may mutate.

Metric
- Define a scalar or structured metric that determines improvement.
- Metric must be objective enough to support repeatable acceptance decisions.

Baseline
- Record baseline artifact/config/metric before mutation attempts.

Budget
- Declare max attempts, max elapsed time, and max files allowed to change.

Validation Command
- Provide the cheap repeatable command used for attempt scoring.

Acceptance Rule
- Define exact threshold/comparator for accepting a candidate over baseline.

Artifacts
- Produce attempt logs, best-result summary, failed hypotheses, and winning diff/commit if any.

Adoption
- Do not auto-merge to `dev`.
- Adopt winning results through a normal PR to `dev`.
- Do not directly mutate `dev` from loops.
- Require explicit human adoption decision for promoted outcomes.

Non-Goals
- Do not use for vague product implementation.
- Do not use when the metric is subjective only.
- Do not use when the task requires broad architectural judgment.
- Do not use without cheap repeatable validation.
- Do not mutate broad repo surfaces.
- Avoid core runtime contracts like `src/behavioral/use-installer.ts`,
  `src/agent/create-agent.ts`, and `src/ui/dom/control-document.ts` unless explicitly scoped
  with strong metrics and human review.
- First good targets are skills, eval prompts, review rubrics, search/query scripts, or small
  eval harnesses.

Required Repo Instructions
- Follow root `AGENTS.md`.
- Follow any nested `AGENTS.md` in touched scope.
- Follow the repo-local `plaited-development` skill.
- Keep mutation bounds and acceptance evidence explicit in the card.

Worktree Expectations
- Start from a fresh branch/worktree based on `origin/dev`.
- For manual worktree creation, prefer `.worktrees/<card-slug>/`.
- For manual Cline CLI runs, use `cline --cwd .worktrees/<card-slug>`.
- In Cline Worktrees UI, choose `.worktrees/<card-slug>/` when prompted for a folder path.
- If running through Cline Kanban, use the tool-managed task worktree path under
  `~/.cline/worktrees/<task-id>/<workspace-folder-label>/`.
- Keep manual and Kanban attempt artifacts durable and inspectable.
- Target PRs at `dev` unless explicitly scoped to release/promotion work.
- Expect squash merge into `dev` for normal card work.
- Pull/sync `dev` with fast-forward only (`git fetch origin dev` then `git merge --ff-only origin/dev`).
- Keep attempt outputs organized so failed and winning runs are inspectable.
- Do not let experiment branches become long-lived shared branches.
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
- Run `biome check --write <affected files>` when applicable.
- Run lane-appropriate targeted checks for the mutated asset surface.
- If TypeScript/shared/tooling resolution is affected, run `bun --bun tsc --noEmit`.

Summary/Handoff Expectations
- Provide baseline, budget usage, winning/failed attempts, and adoption recommendation.
- Include validation command/results and explicit acceptance-rule outcome.
