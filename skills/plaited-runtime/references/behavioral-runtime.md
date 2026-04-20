# Behavioral Runtime Reference

This reference summarizes the active behavioral runtime doctrine that maps to
`src/behavioral/*` and behavioral tests.

## Runtime Surface

- `behavioral()` creates the coordination runtime.
- `bThread([...], repeat?)` composes synchronization steps.
- `bSync({ request, waitFor, block, interrupt })` declares constraints.
- `useFeedback()` runs side effects after selected events.
- `useSnapshot()` observes selection/deadlock/feedback diagnostics.
- `reportSnapshot()` emits runtime/extension diagnostics.

## Prescriptive Patterns

- Keep coordination in threads, effects in feedback handlers.
- Use additive blocking threads for constraints.
- Prefer explicit listener schemas; add `detailMatch: 'invalid'` when
  malformed payloads must be blocked.
- Add dynamic guard threads before triggering events they must observe.
- Keep diagnostic observability in snapshots; blocked bids are observable.

## Anti-Patterns

- Raw generator/yield authoring in repo behavioral code.
- Catching and swallowing internal handler parse errors.
- Treating blocked events as queued work.
- Introducing doc-only event names not present in source/tests.
