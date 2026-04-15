# Issue Lifecycle Dry-Run Reference

This reference describes the read-only lifecycle planner command:

- `bun run agent:issues:lifecycle -- '<json>'`

## Scope

- Computes proposed GitHub issue label/comment mutations.
- Does not apply mutations.
- Does not open/close issues.
- Does not start Kanban or Cline execution.

## Contract

- JSON input/output is default.
- Supports `--schema input|output`.
- Supports shared `--dry-run` semantics.
- Supports `--human` summary output.
- Does not support `--json`.

## Input

- `repo?: string` (used only when live label read is needed)
- `issue: number`
- `transition: "plan-started" | "pr-opened" | "blocked" | "completed" | "abandoned"`
- `currentLabels?: string[]` (preferred for deterministic offline planning)
- `prUrl?: string`
- `reason?: string`
- `resolution?: "fully-resolved" | "partial" | "unknown"`
- `commentBody?: string`

## Output

- `issue: number`
- `transition: string`
- `willMutate: false`
- `labelsToAdd: string[]`
- `labelsToRemove: string[]`
- `comment: string`
- `warnings: string[]`
- `requiresApply: true`
- `closeIssue: false`
- `wouldCloseIssue?: boolean`
- `stateSummary: string`

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

- requires `resolution`
- `fully-resolved`
  - add `agent-done`
  - remove `agent-active`, `agent-pr-open`, `agent-blocked`, `agent-needs-human`
  - `wouldCloseIssue: true`
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

## Examples

```bash
bun run agent:issues:lifecycle -- '{"issue":123,"transition":"plan-started","currentLabels":["agent-ready","agent-planning","needs-triage"]}'
bun run agent:issues:lifecycle -- '{"issue":123,"transition":"pr-opened","currentLabels":["agent-ready"],"prUrl":"https://github.com/plaited/plaited/pull/999"}' --human
bun run agent:issues:lifecycle -- '{"issue":123,"transition":"blocked","currentLabels":["agent-ready","agent-active"],"reason":"Needs maintainer scope decision"}'
bun run agent:issues:lifecycle -- '{"issue":123,"transition":"completed","currentLabels":["agent-ready","agent-active","agent-pr-open"],"resolution":"fully-resolved","prUrl":"https://github.com/plaited/plaited/pull/999"}'
bun run agent:issues:lifecycle -- '{"issue":123,"transition":"abandoned","currentLabels":["agent-ready","agent-active"],"reason":"Kanban attempt discarded after review"}'
```
