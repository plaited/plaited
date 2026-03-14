# Gap Analysis: System-State Steering

> **Status: RESOLVED** — All 7 gaps addressed. See `CRITIQUE-RESPONSE.md` for full resolutions. Module architecture evolution (C+D combined, AgentSkills alignment, mechanics-driven dynamics) further strengthens resolutions. Cross-references: `CRITIQUE-RESPONSE.md`, `SAFETY.md`, `TRAINING.md`, `CONSTITUTION.md`, `HYPERGRAPH-MEMORY.md`, `AGENT-LOOP.md`, `ARCHITECTURE.md`, `MODNET-IMPLEMENTATION.md`.

## Core Thesis

The critique validates BP hard constraints ("hard constraints outside the reward function") and deterministic process ground truth (BP snapshots are "real ground truth" and "valuable"). What it challenges is the **scope** of verification: the defense-in-depth is entirely pre-execution, and the training pipeline treats BP snapshots as the complete process signal when they only capture local coordination decisions.

The overarching argument: **steering should operate around system state, not just reasoning traces.** Every agent action is a proposed mutation to a complex environment. Verification must cover whether the mutation was legitimate given the environment's constraints — not just whether the agent's internal coordination looked clean.

## Gap 1: No Post-Execution Verification Layer

**Critique:** After execution — did the service behave correctly in staging? Did load tests pass? Did the canary show regressions? Did error rates spike?

**Current state:** SAFETY.md's 6 layers are all pre-execution: context assembly → gate → simulate → evaluate → sandbox → audit trail. Layer 3 (Hypergraph Recovery) is an audit log, not a verifier. The `tool_result` event carries output but nothing checks whether the system state is actually correct.

**Affected docs:** SAFETY.md (no Layer 7), AGENT-LOOP.md (no post-execute verification step)

**Fix shape:** A post-execution verification step that checks system state after `tool_result` — did the file actually get written correctly? Did the deployment succeed? Did tests still pass? Could be a 7th defense layer or a feedback loop from `tool_result` back through verification before the result enters history.

## Gap 2: No System State Model (The "Overlapping Graphs")

**Critique:** The environment is a set of overlapping graphs — goal, artifact, resource, authority, operational — and the agent's job is to move them forward without breaking invariants.

**Current state:** HYPERGRAPH-MEMORY.md models agent-internal state (BP decisions, tool calls, plans as bThreads, context assembly). Vertices: `Context`, `Decision`, `Tool`, `Plan`, `File`, `Embedding`. These are all about what the agent did, not what the system looks like.

**What's missing:**
- **Artifact graph:** No model of test results, security scan outcomes, build artifacts, or their relationships
- **Resource graph:** No model of services, datasets, APIs, or environments as entities the agent interacts with
- **Operational graph:** No connection to deployments, metrics, incidents, or cost

**Affected docs:** HYPERGRAPH-MEMORY.md (vertex types), ARCHITECTURE.md (no system model)

**Fix shape:** Extend the hypergraph vertex taxonomy to include environment vertices — `Artifact` (test result, scan result, build output), `Resource` (service, dataset, API endpoint), `Deployment` (environment, status, metrics). These don't need to be stored in the hypergraph — they can be referenced via JSON-LD `@id` pointers to external systems (CI logs, monitoring dashboards, artifact registries).

## Gap 3: Evidence-Backed Meta-Verification

**Critique:** Instead of asking "how confident are we in this score," ask "does the evidence behind this decision actually exist and is it coherent?" If a grader claims a release is safe, verify that scans ran, tests passed, and the deployed artifact matches what was reviewed.

**Current state:** `withMetaVerification` produces `{ confidence, reasoning? }` — a grader-confidence score. This asks "did the grader reason well?" not "does the supporting evidence exist?"

**Affected docs:** TRAINING.md (§ Meta-Verification), `correct-behavior-analysis.md` (§ Meta-Verification)

**Fix shape:** Meta-verification should also check for evidence links. A `GraderResult` should reference the artifacts that support it — the test run ID, the scan report path, the deployment record. The verifier then checks whether those references resolve to actual, coherent evidence.

## Gap 4: Authority Model is Tool-Level, Not Resource-Action-Condition Level

**Critique:** Autonomy is a function of delegated authority, not model capability. Permissions are contextual and scoped — deploy to staging if checks pass, but production needs additional approval.

**Current state:** SAFETY.md has the three-axis model (Capability × Autonomy × Authority), and risk tags route actions (`workspace` → skip sim, `crosses_boundary` → full pipeline). CONSTITUTION.md has MAC/DAC. But the authority model operates at the tool level — can you use `bash`? — not at the resource-action-condition level.

**Affected docs:** SAFETY.md (authority axis), AGENT-LOOP.md (gate step), `agent.constants.ts` (risk tags)

**Fix shape:** Risk tags need a resource dimension. Not just "this is a `bash` command with `crosses_boundary` tag" but "this is a `bash` command that deploys to `staging` — which requires `tests_passed` as a precondition." Gate bThread predicates could inspect not just the tool call and its tags, but also the resource being targeted and whether preconditions (evidence from artifact verification) are met.

## Gap 5: No Data Governance Model

**Critique:** Data should carry labels — classification, residency, retention — and the system should know whether the agent is permitted to interact with that class of data.

**Current state:** TRAINING.md mentions a PII boundary (sanitization in the training wrapper). PROJECT-ISOLATION.md has hard process boundaries. Data is treated as "files in a project" — no classification, no residency constraints, no retention policy.

**Affected docs:** SAFETY.md (no data axis in risk model), CONSTITUTION.md (no data-aware governance factories), HYPERGRAPH-MEMORY.md (no data classification on vertices)

**Fix shape:** Data classification could operate at multiple levels:
- Tool-level: tools that access classified data carry additional risk tags
- Resource-level: the resource graph labels datasets/APIs with classification metadata
- Constitution-level: governance factories that block access to data above the agent's clearance

## Gap 6: BP Snapshots Overweighted in Training Design

**Critique:** BP snapshots are "one verifier among several" — they capture local coordination decisions, not broader system impact. Valuable, but not the complete picture.

**Current state:** TRAINING.md and `correct-behavior-analysis.md` present BP snapshots as the process signal that replaces learned PRMs entirely. The training weight formula (`outcome × process`) derives process from BP snapshots alone.

**Affected docs:** TRAINING.md (§ Augmented Self-Distillation), `correct-behavior-analysis.md` (throughout)

**Fix shape:** The process dimension in `GradingDimensions` should be a composite signal:

| Signal Source | What It Captures | Type |
|---|---|---|
| BP snapshots | Local coordination decisions (blocked, interrupted, selected) | Deterministic |
| Artifact checks | Did tests pass? Did scans run? | Deterministic |
| Environment checks | Did deployment succeed? Did staging behave correctly? | Empirical |
| Governance checks | Did the agent stay within delegated authority? Cross data boundaries? | Deterministic |
| Operational checks | Post-deployment stability, error rates, cost | Empirical |

BP snapshots remain the foundation (free and deterministic), but acknowledged as one layer of process verification, not the entire process signal.

## Gap 7: No Control-Plane Integration with External Systems

**Critique:** Steering enterprise agents is a control-plane problem. Guardrails need to be visible in logs, enforceable by policy, and explainable during an audit — independently of the model.

**Current state:** BP IS a control plane — but for the agent's internal coordination. No concept of the agent participating in a broader organizational control plane (CI/CD gates, deployment approval workflows, incident management, cost budgets).

**Affected docs:** ARCHITECTURE.md (no external control-plane integration), AGENT-LOOP.md (no connection to organizational systems)

**Fix shape:** The ACP interface (`AgentNode`) already has `trigger`/`subscribe` — external systems could participate as event sources. A CI/CD system could `trigger({ type: 'deployment_approved', detail: { environment: 'staging', evidence: [...] } })`. Gate bThread predicates could block `execute` for deployment actions until the organizational control plane has approved.

## What the Critique Validates

Two areas where the architecture directly addresses the critique's concerns:

1. **Hard constraints outside reward** — BP block predicates are exactly what the critique calls for. The neuro-symbolic split in CONSTITUTION.md: structural rules reject outright, reward shapes behavior among allowed actions.

2. **Deterministic process ground truth** — BP snapshots are genuinely valuable and "real ground truth." The critique says they're one layer, not the whole answer.

## Resolution Status

All gaps resolved in `CRITIQUE-RESPONSE.md`:

| Gap | Resolution | Strengthened By |
|---|---|---|
| 1: Post-execution verification | Attestation layer + commit-as-hyperedge + git hooks | Committed artifacts (stable hashes for evidence) |
| 2: System state model | Modnet module graph + bridge-code + hypergraph | Modules as AgentSkills (SKILL.md metadata IS the registry, no sidecar) |
| 3: Evidence-backed meta-verification | Evidence vertices with `attestsTo` + `artifacts` | Committed artifacts + eval criteria in `assets/grading.jsonl` |
| 4: Resource-action-condition authority | ABAC + evidence-gated bThread predicates | Mechanics taxonomy classifies available interactions |
| 5: Data governance | MSS bridge-code IS data governance | Mechanics-driven dynamics (Variant 3) — social/governance/temporal mechanics |
| 6: Composite process signal | Evidence vertices as additional signal sources | 4-step harness (decompose/parallelize/verify/iterate) with judge sub-agents |
| 7: Control-plane integration | A2A coordination between sovereign agents | PM + sub-agent architecture — PMs coordinate, sub-agents execute |

### Previously Open Areas (Now Resolved)

- **Transitive dependency** → Scale (S1-S8) as circuit breaker for dependency propagation. CONTRACT `produces`/`consumes` in SKILL.md metadata makes dependency DAG explicit.
- **External system state** → A2A queries to peer agent PMs. Each PM manages its own modules; external state queries are A2A requests.
- **Semantic correctness** → Irreducibly human. `UserApproval` evidence type. PM presents results and collects user judgment.
- **Retention policy** → Minor MSS extension. Not architectural.

## Priority Order (Original)

1. **Post-execution verification** (Gap 1) — most immediately actionable, fits into existing defense-in-depth
2. **Evidence-backed meta-verification** (Gap 3) — enhances existing mechanism
3. **Composite process signal** (Gap 6) — broadens existing training design
4. **Resource-action-condition authority** (Gap 4) — extends existing risk tags
5. **System state model** (Gap 2) — significant design work, JSON-LD `@id` references keep it lightweight
6. **Control-plane integration** (Gap 7) — ACP already supports this, needs design
7. **Data governance** (Gap 5) — largest new design surface, enterprise-tier concern
