# Module Discovery Factories

## Goal

Research how Bun workspace modules should be discovered, interpreted, and
loaded into the agent through factory exports.

This lane should determine the smallest effective discovery architecture that
supports:

- MSS-aware modules
- default factory bundles
- deployment-provided factories
- generated module factories
- runtime loading through `AGENT_CORE_EVENTS.update_factories`

## Why This Lane Exists

The repo already has a concrete runtime loading seam:

- `src/agent/create-agent.ts` dynamically imports a module path on
  `AGENT_CORE_EVENTS.update_factories`
- `UpdateFactoryModuleSchema` requires `default: Factory[]`

What remains open is everything around that seam:

- what counts as a module
- how modules are discovered
- how MSS metadata is represented and validated
- how factory-bearing modules are selected and composed
- how discovery differs for default, deployed, and generated modules

The missing work is not just a glob pattern. The missing work is a discovery
and interpretation policy that can become part of the default factory bundle.

## Dependency Order

1. `src/agent/create-agent.ts` defines runtime module loading
2. `src/agent/agent.types.ts` defines the factory contract
3. `src/agent/agent.schemas.ts` defines the module export schema
4. `skills/modnet-factories/SKILL.md` defines current MSS/modnet/module
   semantics for factory-era agents
5. `dev-research/default-factories/program.md` defines the bundle question
6. this lane hill-climbs discovery/loading policy and feeds winning candidates
   back into the default-factories umbrella

## Core Hypothesis

The module export contract is already concrete enough to teach:

```typescript
{
  default: Factory[]
}
```

The missing work is discovery and composition policy:

- how the agent finds candidate modules
- how it identifies trustworthy module metadata
- how it decides which factories to load
- how it reconciles default, deployment, and generated factory sources

## Local Inputs

Primary local inputs:

- `src/agent/create-agent.ts`
- `src/agent/agent.types.ts`
- `src/agent/agent.schemas.ts`
- `src/agent/tests/create-agent.spec.ts`
- `src/agent/tests/fixtures/update-factories.fixture.ts`
- `skills/modnet-factories/SKILL.md`

Important research companions:

- `dev-research/default-factories/program.md`
- `dev-research/skill-factories/program.md`
- `dev-research/a2a-factories/program.md`
- `dev-research/three-axis-factories/program.md`

Reference skills:

- `skills/modnet-factories`
- `skills/typescript-lsp`
- `skills/behavioral-core`

## Product Target

The first shipped module-discovery factory bundle should support:

1. identifying candidate Bun workspace modules
2. reading enough metadata to understand module intent and scope
3. validating the factory export contract
4. deciding when and how to load module factories
5. distinguishing among:
   - shipped default modules
   - deployment-provided modules
   - generated modules
6. keeping discovery logic outside the minimal core where possible

## Required Architectural Properties

### 1. Module Discovery Is Policy, Not Just File Search

This lane should treat discovery as deciding:

- which directories count as modules
- which metadata is required or optional
- what should be ignored, quarantined, or delayed
- what should be loaded automatically vs explicitly

### 2. MSS Should Inform Discovery, Not Replace It

MSS metadata should help answer:

- what kind of module this is
- how it composes with other modules
- what its boundary and scale implications are

But MSS should not be treated as the only discovery mechanism.

### 3. Runtime Export Contract Should Stay Concrete

Candidate designs should preserve the current runtime loading contract:

- loadable factory modules export `default: Factory[]`

This lane may research richer manifests or metadata, but it should avoid hiding
or weakening the existing executable integration contract.

### 4. Source Classes Must Stay Distinguishable

The design should preserve explicit distinctions between:

- default shipped factories
- deployment-provided factories
- generated module factories

This is important for reviewability, trust, and evaluation.

### 5. Discovery Should Support Evaluation

Candidate designs should make it easy to inspect:

- what was discovered
- why it qualified as a module
- what metadata was used
- which factory exports were loaded
- what validation succeeded or failed

## Research Questions

This lane should answer questions such as:

- what is the minimal canonical module shape?
- how should Bun workspace structure participate in discovery?
- what metadata should be required at discovery time?
- how should modules declare or imply MSS?
- when should discovery happen: startup, deploy time, runtime, or all three?
- what should trigger `update_factories` for a discovered module?
- how should generated module factories be retained and reloaded?

## Candidate Factory Hypotheses

### 1. Export-Contract First

Start from executable truth and keep metadata secondary.

Hypothesis:

- the most reliable first discovery system is one built around the existing
  `default: Factory[]` contract

### 2. Metadata-First

Start from module metadata and load exports only after qualification.

Hypothesis:

- explicit metadata improves reviewability and reduces accidental loading

### 3. Hybrid Discovery

Use filesystem/workspace discovery plus metadata plus executable validation.

Hypothesis:

- the best default bundle needs all three:
  workspace structure, semantic metadata, and executable contract checks

## Evaluation Questions

Candidate bundles should be judged on:

- does the design preserve the current runtime export contract?
- is it clear why a directory was treated as a module?
- does MSS improve compositional reasoning without becoming fake doctrine?
- can the resulting discovery behavior be reviewed and debugged easily?
- does the design compose with default/deployed/generated factory layers?
- does it avoid widening `src/agent` with discovery-specific doctrine?

## Deliverables

This lane should produce:

- candidate module-discovery factory bundles
- integration notes for module metadata, export validation, and loading policy
- tests or eval tasks for module discovery and runtime loading behavior
- a recommendation for how discovery should participate in the default shipped
  factory bundle

## Negative Goal

This lane should not:

- pretend discovery is solved by one glob alone
- hide module loading behind doctrine that contradicts runtime code
- replace the explicit `default: Factory[]` export contract with vague prose
- widen `src/agent/create-agent.ts` with large discovery orchestration logic
