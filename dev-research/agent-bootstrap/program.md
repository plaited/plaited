# Agent Bootstrap

## Goal

Validate the local-first infrastructure direction through a real bootstrap CLI
that can initialize a Plaited agent deployment target.

The target command surface is:

- `plaited bootstrap`

This lane should turn the infrastructure document into an executable operator
surface rather than leaving it as prose alone.

## Why This Lane Exists

Good deployment tooling is part of the product surface for agent frameworks.

Plaited's infrastructure direction is intentionally:

- local-first
- portable
- pluggable across model providers
- compatible with modern execution sandboxes and durable state stores

But those claims become much stronger when the repo ships a bootstrap path that
creates the expected deployment layout directly.

This lane exists to validate:

- [docs/INFRASTRUCTURE.md](../../docs/INFRASTRUCTURE.md)
- the OpenAI-compatible adapter boundary
- the MSI + vLLM reference lane
- Boxer-style execution assumptions
- node-home persistence and promotion assumptions

## Product Target

The first shipped bootstrap surface should:

1. initialize a `.plaited/` deployment scaffold
2. write model endpoint configuration
3. write infrastructure choices such as:
   - memory provider
   - sandbox provider
   - sync provider
4. create the default durable memory roots
5. support deployment profiles such as:
   - local-first
   - offline-private
   - hosted-node
6. make persistence and promotion choices reviewable, including:
   - persistence factory selection
   - export/import/handoff configuration
7. remain simple enough for both humans and coding agents to use directly

## Required Architectural Properties

### 1. CLI Is The Real Operator Surface

The bootstrap command should be the stable operator entrypoint.

That means:

- [bin/plaited.ts](../../bin/plaited.ts) stays thin
- [src/bootstrap/](../../src/bootstrap) owns schemas and implementation
- bootstrap behavior is testable without shell-only glue

### 2. Skill Sits On Top Of The CLI

The published skill should teach agents how to use the CLI.

It should not replace the CLI with prompt-only deployment instructions.

### 3. Infrastructure Choices Stay Explicit

The bootstrap output should make the operator's choices reviewable:

- model endpoints
- deployment profile
- memory substrate
- sandbox substrate
- sync configuration

### 4. Deployment Remains Platform-Neutral

This lane should keep the bootstrap surface compatible with:

- local runtimes
- hosted runtimes
- pluggable model providers

The stable dependency is the ability to provide the configured model surfaces,
not one mandatory hosting platform.

## Research Questions

This lane should answer:

- what is the smallest bootstrap surface that still validates the
  infrastructure target?
- what should be generated versus left for later operator configuration?
- which deployment choices belong in the initial manifest?
- how should bootstrap interact with default-factory bundle selection?
- what should the official published deployment skill teach beyond raw CLI
  usage?

## Deliverables

This lane should produce:

- [src/bootstrap/](../../src/bootstrap) implementation
- `plaited bootstrap`
- a published `bootstrap-plaited-agent` skill
- tests covering the bootstrap scaffold
- retained notes on how the bootstrap surface validates `INFRASTRUCTURE.md`
