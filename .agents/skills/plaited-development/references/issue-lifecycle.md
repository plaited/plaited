# Issue Lifecycle Reference

This reference describes the lifecycle planner/apply command:

- `bun run agent:issues:lifecycle -- '<json>'`

## Scope

- Computes proposed GitHub issue label/comment mutations.
- Default is read-only (`apply: false`).
- Explicit apply mode (`apply: true`) mutates labels/comments only.
- Does not close issues in this slice.
- Does not start Kanban or Cline execution.
- Does not open PRs.
- Does not add cron/polling/workflow automation.

## Contract

- JSON input/output is default.
- Supports `--schema input|output`.
- Supports shared `--dry-run` semantics.
- Supports `--human` summary output.
- Does not support `--json`.

## Input

- `apply?: boolean` (default `false`)
- `repo?: string`
  - required when `apply: true`
  - optional for read-only mode unless live label reads are needed
- `issue: number`
- `transition: "plan-started" | "pr-opened" | "blocked" | "completed" | "abandoned"`
- `currentLabels?: string[]` (preferred for deterministic offline planning in read-only mode)
- `prUrl?: string`
- `reason?: string`
- `resolution?: "full" | "partial" | "unknown"` (canonical values only)
- `commentBody?: string`

## Output

- `issue: number`
- `transition: string`
- `willMutate: boolean`
- `didMutate: boolean`
- `mutationCommands?: string[][]`
- `appliedLabelsToAdd?: string[]`
- `appliedLabelsToRemove?: string[]`
- `appliedComment?: string`
- `proposedLabelsToAdd: string[]`
- `proposedLabelsToRemove: string[]`
- `proposedComment: string`
- `warnings: string[]`
- `requiresApply: boolean`
- `closeIssue: false`
- `wouldCloseIssue: boolean`
- `stateSummary: string`

## Apply Behavior

- Read-only default:
  - compute only
  - no `gh issue edit`
  - no `gh issue comment`
- Apply mode (`apply: true`):
  - requires `repo`
  - requires live `agent-ready`; otherwise exits with an error before mutation commands
  - always fetches live current labels via `gh issue view` before computing mutations
  - runs mutation commands in order:
    - add labels (`gh issue edit ... --add-label ...`)
    - remove labels (`gh issue edit ... --remove-label ...`)
    - add comment (`gh issue comment ... --body ...`) when present
  - throws on first command failure
  - no rollback in this slice
  - `didMutate` is `true` only after all mutation commands succeed

## Transition Rules

### `plan-started`

- add `agent-active`
- remove `needs-triage` when present

### `pr-opened`

- requires `prUrl`
- add `agent-pr-open`, `agent-active`
- remove `needs-triage` when present

### `blocked`

- requires `reason`
- add `agent-needs-human`, `agent-blocked`

### `completed`

- omitted `resolution` is treated as `unknown` and emits a maintainer-classification warning
- `full`
  - add `agent-done`
  - remove `agent-active`, `agent-pr-open`, `agent-blocked`, `agent-needs-human`, `needs-triage`
  - `wouldCloseIssue: true`
  - warns that issue closing is deferred and must be done manually after reviewing the lifecycle
    comment
- `partial`
  - remove `agent-active`, `agent-pr-open`
  - add `agent-needs-human`
  - `wouldCloseIssue: false`
- `unknown`
  - add `agent-needs-human`
  - `wouldCloseIssue: false`

### `abandoned`

- requires `reason`
- remove `agent-active`, `agent-pr-open`
- add `agent-needs-human`

## Guardrails

- Never remove `agent-ready`.
- Never remove `card/*` taxonomy labels.
- Never add/remove `cline-review`.
- Never add/remove `agent-planning`.
- Never propose both add and remove for the same label.

## Operating Pattern

1. Run read-only first (`apply` omitted or `false`).
2. Inspect proposed labels/comment and warnings.
3. Run explicit apply (`apply: true`) only after review.
4. If `wouldCloseIssue: true`, close manually after reviewing the applied lifecycle comment.

## Examples

```bash
bun run agent:issues:lifecycle -- '{"issue":123,"transition":"plan-started","currentLabels":["agent-ready","agent-planning","needs-triage"]}'
bun run agent:issues:lifecycle -- '{"issue":123,"transition":"completed","currentLabels":["agent-ready","agent-active","agent-pr-open"],"resolution":"full","prUrl":"https://github.com/plaited/plaited/pull/999"}' --human
bun run agent:issues:lifecycle -- '{"apply":true,"repo":"plaited/plaited","issue":123,"transition":"plan-started"}'
```
