Mode
- Eval

Scope
- Run structured agentic evaluation for model, prompt, card template, skill instruction,
  workflow, validation gate, reviewer, or decomposition strategy.
- Keep evaluation card-scoped, reproducible, and decision-oriented.

Files Allowed
- Eval prompts/configs/results and explicitly assigned workflow files.
- No product implementation files outside evaluation scope.

Inputs
- Fixed task/diff/corpus.
- Expected risks or rubric.
- Baseline configuration.
- Variant configuration.

Outputs
- True findings.
- Missed findings.
- False positives.
- Validation quality.
- Cost/latency when available.
- Usability/operator notes.
- Recommendation.

Non-Goals
- No product implementation.
- No direct OpenRouter API usage.

Required Repo Instructions
- Follow root `AGENTS.md`.
- Follow any nested `AGENTS.md` in touched scope.
- Follow the repo-local `plaited-development` skill.
- Use `search-cline-docs` when eval claims depend on Cline/Kanban/provider behavior.

Worktree Expectations
- Start from a fresh branch/worktree based on `origin/dev`.
- Execute eval cards in isolated worktrees.
- Target PRs at `dev` unless explicitly scoped to release/promotion work.
- Expect squash merge into `dev` for normal card work.
- Pull/sync `dev` with fast-forward only (`git fetch origin dev` then `git merge --ff-only origin/dev`).
- Keep baseline and variant configurations clearly labeled.
- Do not let experiment branches become long-lived shared branches.
- Adopt winning results through a normal PR to `dev`.
- Do not directly mutate `dev` from eval loops.
- After merge, trash/delete the card worktree.
- Do not continue work on a squash-merged branch.

Validation Expectations
- Keep task corpus and rubric stable across baseline/variant runs.
- Use consistent findings-first criteria across compared runs.
- Ensure evidence is sufficient to support recommendation confidence.

Summary/Handoff Expectations
- Report baseline vs variant settings, metric outcomes, and recommendation.
- Call out confidence limits and follow-up checks needed.
- Feed repeatable failures back into skills/card templates/workflows.
