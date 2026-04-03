---
name: constitution
description: Governance and verification guidance for factory-composed agent policy. Use when translating constitutional or three-axis ideas into the current plain `Factory` contract, or when assessing what governance concepts still align with `src/agent` and active factory research.
license: ISC
compatibility: Requires bun
---

# Constitution

## Purpose

This skill is now a narrow governance framing aid, not a source of concrete
runtime doctrine.

Use it to connect:

- `src/agent/create-agent.ts`
- `src/agent/agent.types.ts`
- `src/agent/agent.schemas.ts`
- `docs/AGENT-LOOP.md`
- `docs/ARCHITECTURE.md`
- `dev-research/default-factories/program.md`

to the still-useful question:

- how should deterministic governance or verification policy be composed into
  the agent through factories?

**Use this when:**
- assessing whether a governance idea still matches the current agent core
- translating a governance or safety idea into the current plain `Factory`
  contract
- deciding whether a policy belongs in the minimal core or in a factory lane
- reasoning about deterministic bThread guards versus model/context guidance
- connecting governance ideas to default-factory or verification-factory
  research

## Quick Reference

**Current source of truth:** governance must fit the current generic factory
surface:

```typescript
type Factory = (params: FactoryParams) => {
  threads?: Record<string, ReturnType<BSync>>
  handlers?: DefaultHandlers
}
```

Factories receive `trigger`, `useSnapshot`, `signals`, and `computed`. Anything
stronger than that is research or future direction until it lands in
`src/agent`.

**Still relevant:** deterministic policy can live in bThreads and async
handlers rather than in the minimal core.

**Not current truth:** branded `GovernanceFactory` contracts, shipped MAC/DAC
loaders, `protectGovernance`, default MAC rule bundles, `.memory/constitution/`
layouts, or a built-in generated-goal/workflow pipeline.

## Current Guidance

### What Still Holds

- Keep `createAgent()` minimal.
- Express richer governance, verification, and routing policy through
  installed factories.
- Use bThreads for deterministic guards and handlers for contextual follow-up.
- Treat governance as one candidate default-factory surface among several,
  not as a privileged hard-coded subsystem.
- Evaluate governance proposals at the factory-bundle level, not as isolated
  doctrine.

### What To Ignore Unless Reintroduced In Code

- `GovernanceFactory`, `GoalFactory`, or `WorkflowFactory` as live runtime
  contracts
- `🏛️`, `🎯`, or `🔄` branding as active architecture
- `protectGovernance`
- framework-shipped MAC defaults such as `noRmRf`
- `.memory/constitution/` and `.memory/goals/` as active runtime loading paths
- `validateAndImport` as an implemented gate
- test-first generated governance files as a current repo workflow

## Assessment

### Alignment With Current Code

- `src/agent/create-agent.ts` installs plain factories and adds a small set of
  built-in path/schema guards.
- `src/agent/agent.types.ts` exposes a generic `Factory` contract with no
  governance-specific branding or lifecycle types.
- `docs/AGENT-LOOP.md` and `dev-research/default-factories/program.md` treat
  governance as one factory-composed policy area among several.

### Misalignment In The Old Skill

- It described a concrete governance subsystem that is not implemented in
  `src/agent`.
- It treated MAC/DAC, branded governance factories, and `protectGovernance` as
  current architecture rather than speculative or historical design work.
- It presented `.memory` loading and generated governance artifacts as active
  runtime doctrine without supporting code.

### Recommended Use Going Forward

- Use this skill only to help design future governance or verification
  factories that must still compile down to the current generic `Factory`
  surface.
- If a governance idea needs stronger contracts, dedicated lifecycle rules, or
  loading semantics, treat that as active research and document it in a
  `dev-research/*/program.md` lane before promoting it into repo doctrine.
- Prefer `dev-research/default-factories/program.md` and
  `dev-research/three-axis-factories/program.md` for bundle-level direction.

## References

These reference files are historical design material, not current source of
truth:

- [factory-patterns.md](references/factory-patterns.md)
- [governance-model.md](references/governance-model.md)
- [generated-bthreads.md](references/generated-bthreads.md)
- [mac-rules.md](references/mac-rules.md)

Only use them to recover ideas worth re-proposing through current factory
research. Do not treat them as implemented runtime behavior unless the code in
`src/agent` and the active `dev-research` lanes say so.

## Related Skills

- **behavioral-core** — BP primitives (`bThread`, `bSync`, `behavioral()`)
- **trial-runner** — evaluation flows for factory candidates and program-level
  comparisons
- **code-patterns** — Utility function genome (coding conventions)
