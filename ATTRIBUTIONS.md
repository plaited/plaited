# Attributions

This document acknowledges the outside work that still has a visible, current
influence on Plaited's architecture, vocabulary, and research direction.

It is intentionally narrow. Older or weaker influences have been removed so
this file tracks what is materially present in the repo now, not every source
that was once referenced during exploration.

## Structural Information Architecture

**Author:** Rachel Jaffe
**Source:** [Structural Information Architecture](https://medium.com/@rjaffe01/structural-information-architecture-e7d5de94a211)

Rachel Jaffe's Structural IA vocabulary remains one of the clearest direct
inputs into Plaited's structural language.

Concepts that still show up in the repo:
- **Objects**
- **Channels**
- **Levers**
- **Loops**
- **Blocks**

Where that influence is visible now:
- [skills/plaited-runtime/references/modnet-mss-lineage.md](skills/plaited-runtime/references/modnet-mss-lineage.md)
- [docs/wiki/structural-ia-lineage.md](docs/wiki/structural-ia-lineage.md)
- [docs/wiki/architecture.md](docs/wiki/architecture.md)

In Plaited, Structural IA is not just UI vocabulary. It also informs the
module composition language, module-era system framing, and the bridge between
symbolic constraints and generated artifacts.

## Modnet and MSS

**Author:** Rachel Jaffe
**Sources:**
- [modnet-mss-lineage.md](skills/plaited-runtime/references/modnet-mss-lineage.md)
- [Past the Internet: The Emergence of the Modnet](https://medium.com/@rjaffe01)

Rachel Jaffe's modnet work is the other major living attribution that should be
explicitly credited here. It materially shapes Plaited's node-level and
module-level worldview.

Concepts that still show up in the repo:
- **modnets** as networks of sovereign, user-owned units
- **module ownership and transportability**
- **bridge-code / MSS tags**
- **boundary-aware exchange**
- **self-assembling module composition**

Where that influence is visible now:
- [README.md](README.md)
- [docs/wiki/architecture.md](docs/wiki/architecture.md)
- [docs/wiki/infrastructure.md](docs/wiki/infrastructure.md)
- [docs/wiki/agent-loop.md](docs/wiki/agent-loop.md)
- [docs/wiki/modnet-translation.md](docs/wiki/modnet-translation.md)
- [skills/plaited-runtime/SKILL.md](skills/plaited-runtime/SKILL.md)
- [src/modules/projection-boundary-actor.ts](src/modules/projection-boundary-actor.ts)
- [src/modules/module-program-admission.ts](src/modules/module-program-admission.ts)

Plaited does not reproduce the modnet work verbatim. It adapts it into:
- actor-owned facts, services, policy, provenance, and local projections
- transitional MSS metadata on module program descriptors
- boundary-aware module and protocol design
- a neuro-symbolic runtime where generated modules are constrained by BP and governance

## Matt Pocock Skills

**Author:** Matt Pocock
**Source:** [mattpocock/skills](https://github.com/mattpocock/skills)
**License:** [MIT](https://github.com/mattpocock/skills/blob/main/LICENSE),
copyright (c) 2026 Matt Pocock

Plaited includes adapted skill material from:
- [TDD](https://github.com/mattpocock/skills/blob/main/skills/engineering/tdd/SKILL.md)
- [grill-me](https://github.com/mattpocock/skills/blob/main/skills/productivity/grill-me/SKILL.md)

Where that influence is visible now:
- [skills/tdd/SKILL.md](skills/tdd/SKILL.md)
- [skills/grill-me/SKILL.md](skills/grill-me/SKILL.md)

## Scope Note

This attribution file is intentionally conservative.

At the moment, the strongest and clearest influences that are still reflected in
the active repo are Rachel Jaffe's:
- Structural Information Architecture
- modnet / MSS / bridge-code work

Other ideas around generative UI, browser-grounded evaluation, or AI-assisted
design may still inform experiments or language in places, but they are not as
foundational or as directly encoded in the current codebase as the two sources
above.
