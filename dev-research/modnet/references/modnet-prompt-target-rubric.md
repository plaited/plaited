# Modnet Prompt-Target Rubric

## Purpose

This rubric defines the target shape for later raw-card regeneration in the
modnet lane. It is derived from:

- `dev-research/modnet/catalog/modnet-training-prompts-handcrafted.jsonl`
- `skills/mss-vocabulary/SKILL.md`
- `skills/modnet-node/SKILL.md`
- `skills/modnet-modules/SKILL.md`
- `dev-research/modnet/references/modnet-native-model-training-guide.md`

Use it to judge whether a candidate prompt belongs in the modnet-native prompt
set. Do not treat the handcrafted prompts as the full target space; they are a
control set for style, ontology, and specificity.

## Control-Set Role

The handcrafted prompts teach a narrow pattern on purpose:

- MSS must be explicit enough to shape generation, not implied loosely.
- Exposure must be reasoned from boundary and mechanics, not guessed from
  domain.
- Sovereign-node constraints must stay visible whenever sharing, services,
  bridges, or A2A appear.
- Prompts should describe one bounded module, transition, or coordination case,
  not a whole platform rewrite.
- Prompt wording should be concrete, but reusable patterns matter more than any
  single exemplar phrase.

Therefore the handcrafted set is a style/control set, not an exhaustive world
model and not the whole retrieval target for regeneration.

## Target Pattern

A good modnet-native prompt usually does five things at once:

1. Names a real user task in plain language.
2. Implies a specific MSS shape that can be recovered with high confidence.
3. Makes exposure reasoning recoverable from the task or hint.
4. Preserves node sovereignty by routing network action through PM, Agent Card,
   A2A, or bridge semantics where relevant.
5. Stays bounded enough that the output can be judged for ontology adherence,
   UI structure, and runtime behavior.

## Rubric

Score each dimension as `keep`, `revise`, or `reject`.

### 1. MSS Recoverability

`keep` when the prompt makes these inferable without copying exemplar wording:

- `contentType` is specific enough to distinguish what should group together.
- `structure` is visible from the user task, not invented after the fact.
- `mechanics` are limited to interactions the task actually calls for.
- `boundary` can be inferred from privacy, sharing, service, or payment cues.
- `scale` is bounded to one clear local structure or an explicit transition.

`revise` when the domain is clear but one or two MSS tags are underspecified.

`reject` when the task could map to many unrelated MSS shapes with equal
confidence.

### 2. Exposure Framing

`keep` when the prompt teaches one of the canonical exposure situations:

- `internal-only` from `boundary=none`
- `artifact-shareable` for snapshot-style sharing
- `service-exposed` when session mechanics require live PM/A2A handling
- explicit exposure transition between those states
- bridge-mediated sharing that does not change module exposure

`revise` when sharing is present but the prompt blurs artifact-sharing,
service exposure, and bridge routing.

`reject` when it implies direct module exposure, module-to-module networking,
or bypass of PM authority.

### 3. Sovereign-Node Relevance

`keep` when sovereign-node architecture is materially relevant:

- local-first or owner-facing control is visible
- PM intermediation is required for boundary changes, routing, or service work
- Agent Card appears only for genuine service exposure
- A2A is used as a treaty boundary, not as a shared mutable host
- bridges remain internal adapters rather than public services

`revise` when the task is otherwise strong but could fit a generic app prompt
with only cosmetic modnet language.

`reject` when the core behavior depends on centralized SaaS assumptions,
shared databases across nodes, or unconstrained external trust.

### 4. Prompt Shape And Specificity

`keep` when the prompt is concrete but bounded:

- one module family, one transition, or one coordination pattern
- enough user detail to recover target UI and runtime behavior
- short, plain-language input plus a hint or judgeable target shape
- no dependence on a large backstory or hidden repo knowledge

`revise` when it is directionally correct but too vague, too broad, or too
implementation-specific.

`reject` when it asks for a whole product suite, a generic clone, or a prompt
that can only be satisfied by copying an existing exemplar.

### 5. Seed-Worthiness

`keep` when the prompt is likely to generate reusable training signal:

- teaches a portable ontology pattern, not a one-off brand detail
- adds coverage for a meaningful module family, bridge case, or transition
- has clear positive and negative judge signals
- exposes a real sovereign-node tradeoff such as privacy, payment, routing,
  proximity, capacity, or participation scale

`revise` when the task is plausible but too redundant with the current control
set or too thin to judge reliably.

`reject` when the prompt is novelty-only, nostalgia-only, or lacks a clear
reason it should improve regeneration quality.

## Preferred Prompt Traits

Promote candidates that resemble the control set at the pattern level:

- user-first wording instead of ontology jargon in the main request
- ontology recoverable from the task and hint, not dumped into the request
- explicit view of what is private, shared, paid, bridged, or service-exposed
- compact UI shape cues such as card, list, board, wall, wizard, or dashboard
- runtime cues such as render, sort, filter, connect, notify, route, or
  disconnect
- negative space that rules out generic web-app framing

## Anti-Targets

Reject or rewrite prompts that do any of the following:

- overfit to one handcrafted exemplar or copy its fixed wording
- recreate HyperCard nostalgia faithfully instead of translating the underlying
  task into a modern sovereign-node corollary
- preserve obsolete transport, storage, or UI details that no longer matter
- leak answer structure directly from the hint or judge vocabulary
- flatten the distinction between internal modules, bridge modules,
  artifact-sharing, and service-exposed capabilities
- treat A2A as a direct module bus or shared mutable code host
- assume centralized backends, shared databases, or direct platform API calls
  from the UI
- default to `react app`, `single-page app`, `redux`, `next.js`, or similar
  generic framing when the task is supposed to teach Plaited-native behavior

## Compact Keep Gate

Keep a regenerated prompt only if all of these are true:

- the task is modern and user-real, not archive-faithful
- the MSS shape is recoverable with high confidence
- exposure reasoning is clear and modnet-correct
- sovereign-node constraints are materially present
- the prompt is bounded and judgeable
- the pattern adds reusable training value beyond the existing control set

If any line above fails, revise or discard the prompt before promotion.
