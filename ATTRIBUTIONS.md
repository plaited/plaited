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
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)

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
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- [docs/INFRASTRUCTURE.md](docs/INFRASTRUCTURE.md)
- [docs/AGENT-LOOP.md](docs/AGENT-LOOP.md)
- [skills/plaited-runtime/SKILL.md](skills/plaited-runtime/SKILL.md)
- [src/modules/a2a-module/a2a.schemas.ts](src/modules/a2a-module/a2a.schemas.ts)

Plaited does not reproduce the modnet work verbatim. It adapts it into:
- a Bun-native A2A node architecture
- MSS metadata on modules and Agent Cards
- boundary-aware module and protocol design
- a neuro-symbolic runtime where generated modules are constrained by BP and governance

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
