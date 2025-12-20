# Core Concepts

Plaited is a behavioral programming framework for building reactive web components with these key architectural pillars:

## 1. Behavioral Programming (BP) Paradigm

- Located in `src/main/behavioral.ts` and related files
- Central coordination through `behavioral()` factory which manages b-threads
- Thread composition with `bThread()` and `bSync()` utilities
- Higher-level `useBehavioral()` for reusable program configurations
- Event-driven architecture with request/waitFor/block/interrupt idioms
- Islands-based architecture: `useSignal` and `useComputed` enable cross-island communication outside the normal parent-child event flow (parent calling `trigger()` on child in shadowDOM, or child using `emit()` to broadcast to parent)
- Type guards (`isBPEvent`, `isPlaitedTrigger`) for runtime validation

## 2. Web Components with Shadow DOM

- `bElement` in `src/main/b-element.ts` creates custom elements
- Automatic style scoping via Constructable Stylesheets
- Template system with JSX support
- Helper methods attached to DOM elements via `p-target` attributes
- Declarative event binding via `p-trigger` attributes
- MutationObserver for dynamic content monitoring
- Form-associated custom elements support via ElementInternals
- Type guards (`isBehavioralElement`, `isBehavioralTemplate`) for validation

## 3. CSS-in-JS System

- `createStyles()` for atomic CSS class generation with hash-based naming
- `createHostStyles()` for styling custom element host (`:host` selector)
- `createKeyframes()` for CSS animation definitions
- `createTokens()` for design token system with CSS custom properties
- `joinStyles()` for composing multiple style objects
- Automatic style adoption in Shadow DOM via Constructable Stylesheets
- Style deduplication and caching per ShadowRoot
- Support for nested rules (media queries, pseudo-classes, attribute selectors)
