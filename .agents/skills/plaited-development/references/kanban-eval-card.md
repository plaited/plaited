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
- Security-fact capture quality (did the agent correctly identify deterministic
  `CodeQL`/`Dependabot`/`secret-scanning` facts).

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
- For manual worktree creation, prefer `.worktrees/<card-slug>/`.
- For manual Cline CLI runs, use `cline --cwd .worktrees/<card-slug>`.
- In Cline Worktrees UI, choose `.worktrees/<card-slug>/` when prompted for a folder path.
- If running through Cline Kanban, use the tool-managed task worktree path under
  `~/.cline/worktrees/<task-id>/<workspace-folder-label>/`.
- Target PRs at `dev` unless explicitly scoped to release/promotion work.
- Expect squash merge into `dev` for normal card work.
- Pull/sync `dev` with fast-forward only (`git fetch origin dev` then `git merge --ff-only origin/dev`).
- Keep baseline and variant configurations clearly labeled.
- Do not let experiment branches become long-lived shared branches.
- Adopt winning results through a normal PR to `dev`.
- Do not directly mutate `dev` from eval loops.
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
- Keep task corpus and rubric stable across baseline/variant runs.
- Use consistent findings-first criteria across compared runs.
- Ensure evidence is sufficient to support recommendation confidence.
- Score whether the evaluated reviewer/tooling flow catches deterministic GitHub security facts
  and treats them as authoritative.

Summary/Handoff Expectations
- Report baseline vs variant settings, metric outcomes, and recommendation.
- Call out confidence limits and follow-up checks needed.
- Feed repeatable failures back into skills/card templates/workflows.
