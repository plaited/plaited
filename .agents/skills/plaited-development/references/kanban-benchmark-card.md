Mode
- Benchmark

Scope
- Compare Cline/OpenRouter implementation or review configurations for this repository.
- Use OpenRouter `minimax/minimax-m2.7` as the default baseline configuration.

Files Allowed
- Benchmark notes/results and explicitly assigned workflow/config files only.

Non-Goals
- No feature implementation outside benchmark scope.
- No direct OpenRouter API usage.

Required Repo Instructions
- Follow root `AGENTS.md`.
- Follow any nested `AGENTS.md` in touched scope.
- Follow the repo-local `plaited-development` skill policy.
- Keep benchmark setup reproducible and card-scoped.
- Use `search-cline-docs` when benchmark claims depend on Cline behavior.

Worktree Expectations
- Execute benchmark cards in isolated worktrees.
- Keep compared configurations clearly labeled and separated.

Validation Expectations
- Track true findings, missed findings, false positives, cost/latency (if available), and usability.
- Keep evaluation prompts/findings-first review criteria consistent across compared runs.
- Do not add direct OpenRouter API scripts.

Summary/Handoff Expectations
- Report baseline vs variant settings, metric outcomes, and recommendation.
- Call out confidence limits and follow-up checks needed.
