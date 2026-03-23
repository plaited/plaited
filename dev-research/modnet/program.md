# Modnet Research Program

## Mission

Design the modnet layer for Plaited as both:

- the sovereign inter-node coordination layer
- the canonical task-definition and ontology lane for modnet-native modules

This program should define what modnet modules are, how they expose
capabilities, how they connect across nodes, and how that ontology feeds the
native-model training program.

This program is about:
- MSS-grounded module definitions
- exposure and bridge-module reasoning
- sovereign node-to-node coordination
- A2A exchange patterns
- artifact movement across trust boundaries
- enterprise/shared-service modnet structures
- research commons and agent communities across nodes
- modnet-native prompt catalogs and modernization lenses that feed
  native-model training

It is not about local framework refactoring or native-model distillation.

## Separation From Other Programs

- `dev-research/runtime-taxonomy/program.md`
  - local framework/runtime/autoresearch infrastructure
- `dev-research/skills/program.md`
  - skill discovery, validation, evaluation, and improvement workflows
- `dev-research/improve/program.md`
  - generic improvement substrate and model-agnostic improvement protocol
- `dev-research/native-model/program.md`
  - Falcon/native-model behavior and distillation
- `dev-research/modnet/program.md`
  - modnet ontology, inter-node collaboration, exchange, and governance

Do not merge these concerns casually.

## Core Hypothesis

Plaited nodes should remain sovereign.
Inter-node collaboration should happen through explicit treaty surfaces, not by collapsing nodes into a shared mutable code host.

Therefore:
- A2A remains the external coordination boundary
- PM remains the treaty authority at each node boundary
- shared artifacts move between nodes only through governed exchange
- module ontology and exposure rules should be defined here before they are
  used as native-model training targets elsewhere

## Fixed Architecture

These decisions are already made. Do not change them.

- Nodes remain sovereign; modnet work must not collapse them into a shared
  mutable host.
- A2A remains the external coordination and treaty boundary between nodes.
- PM remains the treaty authority at the node boundary.
- Shared artifacts move between nodes only through governed exchange.
- Internal modules, bridge modules, artifact-sharing, and service exposure are
  distinct concepts and must stay distinct.
- Modnet ontology and exposure rules should be defined here before they are
  used as native-model training targets elsewhere.
- Modnet research must not drift into local runtime refactoring or native-model
  implementation details.

## Canonical Inputs

The following files are support assets for this lane:

- [modnet-native-model-training-guide.md](/Users/eirby/Workspace/plaited/dev-research/modnet/references/modnet-native-model-training-guide.md)
  - consolidated ontology and training-shaping reference
- [modnet-training-prompts.jsonl](/Users/eirby/Workspace/plaited/dev-research/modnet/catalog/modnet-training-prompts.jsonl)
  - canonical prompt catalog for modnet-native tasks

These are not slice files.
They are inputs that should shape future slices in this lane and derived
native-model eval/training batches in `dev-research/native-model/`.

## AgentHub Relevance

AgentHub is useful as inspiration, not as the direct core model.

Useful ideas:
- commit DAGs for collaborative exploration
- frontier/leaves/lineage as agent concepts
- git bundles as transferable code artifacts
- asynchronous message-board style coordination

Non-transferable assumptions:
- agents push freely without sovereign approval
- no main branch / no merge discipline inside a node
- platform-level coordination replacing node-level governance

Plaited should not replace node sovereignty with a free-push hub.

## Working Synthesis

Inside a node:
- local git repos
- worktrees
- node/module `.memory/`
- PM/constitution/boundary policy

Between nodes:
- A2A is the transport and treaty layer
- git bundles are artifacts exchanged through A2A
- receiving nodes decide whether to inspect, simulate, import, or reject

So:
- bundle = artifact
- A2A = inter-node exchange protocol
- PM = import/export/apply authority

## Runtime Taxonomy

- node: sovereign runtime and policy boundary
- PM: treaty authority and import/export decision-maker at the node boundary
- module: user-facing or internal capability unit shaped by MSS and exposure
  rules
- bridge module: module that mediates between local semantics and external
  service or treaty surfaces
- native modnet module: module designed to participate directly in modnet
  exchange without bridge semantics
- artifact: transferable bundle, package, or other governed exchange object
- exposure state: internal-only, artifact-shareable, or service-exposed
- participation scale: contextual scale a module or node reaches when it joins
  an ephemeral or aggregated network
- deployment module: concrete product-surface module that makes modnet
  behavior real for operators and end users

## Research Questions

- How should MSS vocabulary be represented so modules, bridges, and exposure
  transitions remain consistent across prompts, UI, and A2A behavior?
- How should the PM classify internal-only vs artifact-shareable vs
  service-exposed modules?
- How should bridge modules differ from native A2A-exposed modules?
- Which modnet deployment modules must be taught first because they define the
  real product surface?
- How should nodes detect resource pressure, explain migration/provisioning
  options, and connect paid-service decisions to real infrastructure needs?
- How should the model distinguish intrinsic module scale from contextual
  participation scale when a local module joins an ephemeral or aggregated
  network?
- How should git bundles be represented as A2A artifacts?
- What provenance must accompany bundle exchange?
- How should receiving nodes sandbox and evaluate imported artifacts?
- What is the right model for frontier discovery across sovereign nodes?
- When does a message-board or channel layer help, and when does it duplicate A2A?
- How should enterprise nodes differ from personal nodes?
- How should shared-service nodes expose capabilities without collapsing sovereignty?

## Target Themes

### Modnet Ontology

- MSS tags as first-class design constraints
- exposure classification heuristic
- bridge vs native module distinction
- exposure transitions and governance implications
- modernization of historical patterns into sovereign-node modules

### Prompt Catalog Shaping

- handcrafted Tier 1-3 prompts as high-precision ontology teaching data
- HyperCard-derived Tier 4 prompts as breadth and abandoned-niche coverage
- clear separation between canonical prompt source and derived native-model
  eval/training batches

### Deployment Modules

- booking, payments, fiction, social, media, and bridge modules as concrete
  must-have product surfaces
- module families that matter because they shape user-facing modnet behavior,
  not just abstract network diagrams

### Capacity-Aware Node Evolution

- resource pressure detection
- migration and stronger-node recommendations
- dedicated service-node splits
- paid-priority decisions tied to actual infrastructure burden
- owner-facing comparison flows rather than silent auto-scaling

### A2A Artifact Exchange

- git bundles as first-class artifacts
- metadata, provenance, and evaluation summaries attached to artifacts
- import/export policy at node boundaries

### Inter-Node Experiment Sharing

- publish candidate improvements between nodes
- retain lineage of experiment ancestry
- allow nodes to accept/reject/replay external improvements

### Enterprise Modnets

- organizational nodes
- service-account-owned nodes
- shared-service nodes
- treaty boundaries between personal and enterprise nodes

### Research Commons

- optional community layer for agents to share results
- asynchronous collaboration across many sovereign nodes
- DAG-like exploration without requiring a centralized mutable repo

## Slice Progression

- Slice 1: git bundles as A2A-governed exchange artifacts
- Slice 2: provenance and evaluation envelope for exchanged artifacts
- Slice 3: receiving-node simulation and import decision flow
- Slice 4: enterprise/shared-service node exchange patterns
- Slice 5: MSS vocabulary and exposure classification for native modnet modules
- Slice 6: bridge modules, exposure transitions, and PM routing patterns
- Slice 7: prompt-catalog shaping and native-model handoff boundaries
- Slice 8: deployment module families and modnet product-surface priorities
- Slice 9: HyperCard reclassification judge-prompt calibration for better seed recovery
- Slice 10: HyperCard reclassification follow-up for family and structure drift
- Slice 11: derive a reusable modnet prompt-target rubric from skills, docs, and handcrafted prompts
- Slice 12: validate a raw-card inclusion gate over the worktree catalog JSONLs and produce a raw prompt-ready corpus
- Slice 13: test search-grounded regeneration variants against the derived prompt-target rubric
- Slice 14: run the chosen regeneration flow over the retained HyperCard corpus and produce a regenerated prompt set
- Slice 15: run seed review on the regenerated prompt set, analyze a 100-row sample at concurrency 5, and define promotion criteria
- Slice 16: refine lower-scale prompt derivation using handpicked approved seeds and then derive `S1-S3` precursors from the regenerated HyperCard seed set
- Slice 17: run a held-out 100-row judge ablation to test Haiku replacements and Sonnet challengers while keeping Codex unchanged
- Slice 18: calibrate the raw-card inclusion judge/meta prompts on disagreement rows and edge cases before rerunning the full HyperCard inclusion lane

## Current Execution Notes

- Slice 12 produces the retained raw corpus gate.
- Slice 17 is complete.
  - The current raw-card inclusion target stack is:
    - `glm-5`
    - `minimax-m2.5`
- Slice 18 is complete.
  - The raw-card inclusion judge/meta prompts have been recalibrated for:
    - obsolete-medium rescue
    - thin-demo rejection
    - stronger pass/decision/score coherence
- The next modnet action is the full raw-card inclusion rerun over the `2204`
  row HyperCard lane using the calibrated `glm-5 -> minimax-m2.5` stack.
- Slice 13 selects between the concrete regeneration variants:
  - `base_1`
  - `base_1_search`
  - `base_1_search_followup_livecrawl`
- Slice 14 should begin with a bounded retained-corpus sample before the full
  retained-corpus regeneration run.
- Slice 14 should write deterministic intermediate artifacts before writing the
  final regenerated prompt set.
- Slice 15 should consume only the regenerated prompt-set artifact from Slice
  14, not the legacy catalog.

## Validation

For accepted code slices, both must pass:

- `bun --bun tsc --noEmit`
- `bun test src/ skills/ scripts/`

## Acceptance Criteria

A future design in this lane should:

- make MSS and exposure reasoning explicit enough to be used in prompt and
  training design
- distinguish internal modules, bridge modules, artifact-sharing, and
  service exposure cleanly
- preserve sovereign node boundaries
- keep A2A as the external exchange boundary
- avoid bypassing PM/constitution authority
- make artifact provenance explicit
- support enterprise/shared-service patterns without collapsing into a central
  hub
- provide a clean handoff into the native-model lane without collapsing modnet
  research into training implementation

## Safety

Do not allow imported artifacts to bypass:
- constitution
- boundary policy
- promotion policy
- PM approval of external work

Do not treat external bundles as trusted code by default.

Do not let prompt catalogs or training convenience erase the distinction
between:

- internal modules
- bridge modules
- artifact-sharing surfaces
- service-exposed Agent Card capabilities
