# Attributions

This document acknowledges the intellectual foundations and external works that have influenced Plaited's design patterns and documentation.

## Structural Information Architecture

**Author:** Rachel Jaffe
**Source:** [Structural Information Architecture](https://medium.com/@rjaffe01/structural-information-architecture-e7d5de94a211) (Medium, July 2019)

Rachel Jaffe's Structural IA framework provides a provider-agnostic vocabulary for describing UI structures. Her concepts of Objects, Channels, Levers, Loops, and Blocks form the foundation of Plaited's structural vocabulary used in:

- `.claude/skills/loom/references/structural/`

**Key Concepts Used:**
- **Objects** - What is conceived as "one"
- **Channels** - Type contracts for information flow
- **Levers** - Tools that shape user energy
- **Loops** - Action → Response cycles
- **Blocks** - Emergent compositional patterns

## Mise en Mode

**Author:** Donnie D'Amato
**Source:** [mode.place](https://mode.place/)

Donnie D'Amato's Mise en Mode methodology influences Plaited's approach to design token scoping and theming. The framework's concept of "modes" as contextual variations of design decisions informs how tokens and styles are organized.

**Key Concepts Used:**
- Token scoping by mode/context
- Semantic color naming patterns
- Theme variation strategies

**Integration Points:**
- `.claude/skills/loom/references/patterns/tokens.md`
- `.claude/skills/loom/references/patterns/styles.md`

## Microinteractions

**Author:** Dan Saffer
**Source:** [Microinteractions: Designing with Details](https://www.oreilly.com/library/view/microinteractions-designing/9781491945957/) (O'Reilly Media, 2013)

Dan Saffer's seminal work on microinteractions defines the four-part structure: Triggers, Rules, Feedback, and Loops. Plaited combines Saffer's microinteraction model with Rachel Jaffe's Loop and Lever concepts from Structural IA to create a unified pattern for designing interactive behavioral elements.

**Key Concepts Used:**
- **Triggers** - What initiates the interaction (mapped to Levers)
- **Rules** - What happens when triggered (bThread logic)
- **Feedback** - What the user perceives (template updates)
- **Loops** - Ongoing interaction cycles (mapped to Structural IA Loops)

**Integration Points:**
- `.claude/skills/plaited-ui-patterns/references/b-element.md` (Microinteractions via Loop + Lever Pattern section)

## Browser as World Model

**Authors:** Yu Gu, Kai Zhang, Yuting Ning, Boyuan Zheng, Boyu Gou, Tianci Xue, Cheng Chang, Sanjari Srivastava, Yanan Xie, Peng Qi, Huan Sun, Yu Su
**Source:** [WebDreamer: Is Your LLM Secretly a World Model of the Internet?](https://arxiv.org/abs/2411.06559) (arXiv, November 2024)

The WebDreamer paper's insight that LLMs can simulate web interactions influenced Plaited's architecture where the browser serves as the ground truth world model for agent training.

**Key Concepts Used:**
- **Browser as World** - Stories execute in browser; play() validates exploration
- **Observation-Action Cycles** - Inspector snapshots feed back to agent
- **Grounded Rewards** - Assertions provide reward signal for training

**Integration Points:**
- `.claude/skills/loom/SKILL.md` - Browser as World Model architecture
- Tiered symbolic analysis with browser as Tier 3 ground truth

## AI-Assisted Design and Generative UI

**Authors:** Jakob Nielsen, Kate Moran, Sarah Gibbons
**Sources:**
- [AI: First New UI Paradigm in 60 Years](https://www.nngroup.com/articles/ai-paradigm/) (Nielsen Norman Group, June 2023)
- [Generative UI and Outcome-Oriented Design](https://www.nngroup.com/articles/generative-ui/) (Nielsen Norman Group, March 2024)

These NNGroup articles shaped the loom skill's design-to-agent pipeline and World Agent constraint architecture.

**Key Concepts Used:**
- **AI-Assisted Design** - Designers create with AI assistance (loom's "Patterns" phase)
- **Hybrid UI** - Familiar structures provide cognitive anchoring for generative content
- **Generative UI** - Interfaces dynamically generated to fit user context
- **Outcome-Oriented Design** - Define constraints and guardrails, not pixels

**Plaited's Synthesis:**
Generative UI is constrained by Hybrid UI. Users specify familiar structures via preference profiles. Generated content fills dynamic parts while maintaining structural consistency.

**Integration Points:**
- `.claude/skills/loom/` - Design-to-agent pipeline
- World Agent preference constraints

## Combined Attribution

The "Microinteractions via Loop + Lever Pattern" in Plaited's documentation represents a synthesis of:
- Dan Saffer's microinteraction structure (Triggers, Rules, Feedback, Loops)
- Rachel Jaffe's Structural IA concepts (Loops, Levers)

This combination provides a framework for designing behavioral elements that respond to user input with appropriate feedback while maintaining clear structural relationships.
