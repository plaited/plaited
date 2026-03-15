# UI Architecture

> **Status: ACTIVE** — Implementation details have moved to the `generative-ui` skill. This document provides a structural overview.

## Overview

`src/ui/` provides the rendering and protocol primitives for a server-driven generative web UI. An agent generates HTML on the server, streams it to the browser over WebSocket, and optionally injects client-side behavioral logic at runtime. All client-side coordination uses behavioral programming (BP).

## Directory Structure

```
src/ui/
  css/         Atomic CSS-in-JS: createStyles, createTokens, createHostStyles, createKeyframes, joinStyles
  dom/         Custom elements: controlIsland, controlDocument, decorateElements, DelegatedListener
  protocol/    Controller protocol: constants, Zod schemas, client-side behavioral controller
  render/      JSX factory (h/createTemplate), Fragment, SSR renderer (createSSR), template types
```

Public API is re-exported through `src/ui.ts`.

## Subsystems

| Subsystem | Key APIs | Skill Reference |
|-----------|----------|----------------|
| **Rendering pipeline** | `createTemplate`/`h`, `Fragment`, `createSSR` | `generative-ui` SKILL.md § Server-Side Rendering Pipeline |
| **CSS system** | `createStyles`, `createTokens`, `createHostStyles`, `createKeyframes`, `joinStyles` | `generative-ui` references/css-system.md |
| **Custom elements** | `controlIsland`, `controlDocument`, `decorateElements`, `DelegatedListener` | `generative-ui` SKILL.md § Custom Elements |
| **Controller protocol** | `render`, `attrs`, `update_behavioral`, `disconnect`, `user_action`, `snapshot` | `generative-ui` SKILL.md § Protocol Message Reference |
| **Dynamic code loading** | `update_behavioral` + `import(url)` | `generative-ui` references/update-behavioral.md |
| **WebSocket architecture** | Routing, session, security, reconnection | `generative-ui` references/websocket-decisions.md |
