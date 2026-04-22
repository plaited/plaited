# Plaited Wiki

> Status: active architecture wiki. Source code, tests, root `AGENTS.md`, and
> applicable skills remain higher authority.

This wiki captures the current Plaited experience standard: users own nodes,
actors own state and services, runtime policy decides what crosses boundaries,
and UI is generated as a local projection.

## Pages

| Page | Scope |
|---|---|
| [Architecture](architecture.md) | Framework overview, first principles, runtime hierarchy, and deployment posture |
| [Agent Loop](agent-loop.md) | Minimal core plus module-composed orchestration |
| [Actor Runtime](actor-runtime.md) | Current `defineActor`, supervisor runtime, actor policy ledger, diagnostics, and gaps |
| [Local Inference Bridge](local-inference-bridge.md) | Unix socket framed `ActorEnvelope` stream decision for same-machine neural runtime IPC |
| [Infrastructure](infrastructure.md) | Local-first node home, sandbox execution, identity, and deployment direction |
| [Training And Improvement](training-and-improvement.md) | Discovery-first symbolic architecture, model A/model B direction, and later adaptation |
| [Plaited Experience Standard](plaited-experience-standard.md) | Target standard for facts, services, policy, provenance, and local projections |
| [Modnet Translation](modnet-translation.md) | How Modnet/MSS ideas translate into Plaited actor-era architecture |
| [Structural IA Lineage](structural-ia-lineage.md) | What remains useful from Structural IA and what does not become runtime doctrine |
| [Sources](sources.md) | Source references and provenance notes |
| [Log](log.md) | Wiki maintenance log |

## Authority

Use the wiki to orient architectural work. Verify implementation details against
`src/`, tests, and `skills/plaited-runtime/` before changing runtime code.
