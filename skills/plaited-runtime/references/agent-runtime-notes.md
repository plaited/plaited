# Agent Runtime Notes

Status: active runtime notes with explicit current-vs-target split.

## Implemented Now

- Behavioral runtime primitives exist under `src/behavioral/*`.
- UI/local projection primitives exist under `src/ui/*`.
- MCP schema/utilities exist under `src/mcp/*`.
- Worker runtime boundaries exist under `src/worker/*`.

## Target Direction

- dual-lane (`private lane` / `exchange lane`) runtime boundary model
- boundary-contract graph enforcement for exchange-lane interoperability
- identity-plane trust verification + execution-plane tokenized authority

## Authority Rule

When docs conflict with `src/` + tests, source and tests are authoritative.
