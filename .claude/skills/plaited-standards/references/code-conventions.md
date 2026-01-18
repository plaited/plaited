# Plaited Code Conventions

Essential conventions for writing idiomatic Plaited code. These patterns help users build applications with the Plaited framework.

## Terminology

**IMPORTANT**: Plaited is a **template-based** framework, not a component-based framework.

### Use This Terminology
- ✅ Use: template, templates, FunctionTemplate, BehavioralTemplate
- ❌ Avoid: component, components

### Browser Platform APIs

Refer to browser platform APIs by their specific names:
- **Custom Elements API**: `customElements.define()` for registering custom HTML elements
- **Shadow DOM API**: Encapsulated DOM and styling
- **HTML Templates**: `<template>` element including Declarative Shadow DOM

❌ Avoid the umbrella term "Web Components" - refer to specific APIs instead (Custom Elements, Shadow DOM, etc.)

### In Documentation and Code
- Plaited templates (created with `bElement` or as functions)
- Template exports, template metadata, template discovery
- Template tests (not component tests)
- Template lifecycle (not component lifecycle)

## Template Creation

**IMPORTANT**: Always use JSX syntax for creating templates in tests, examples, and application code.

```typescript
// ✅ Good: JSX syntax
<div className="foo">Hello</div>

// ❌ Avoid: Direct h() or createTemplate() calls
h('div', { className: 'foo' }, 'Hello')
createTemplate('div', { className: 'foo', children: 'Hello' })
```

**Rationale:** `h()` and `createTemplate()` are internal JSX transformation functions exported only through jsx-runtime modules. They are not part of the public API and should not be used directly. JSX provides better type safety, readability, and IDE support.

## Package Imports

Use package imports when importing from Plaited:

```typescript
// ✅ Good: Package imports
import { useBehavioral, useSignal } from 'plaited'
import { bElement, type FT, createStyles } from 'plaited/ui'
import { story } from 'plaited/testing'
import { wait, noop } from 'plaited/utils'
```

### Package Export Guidelines

| Package | Exports |
|---------|---------|
| `plaited` | Behavioral programming: useBehavioral, useSignal, useWorker, bWorker |
| `plaited/ui` | UI framework: bElement, createStyles, createHostStyles, FT, ssr, joinStyles |
| `plaited/testing` | Test utilities: story, findByAttribute |
| `plaited/utils` | Utilities: wait, noop, isTypeOf |

## Element Query Patterns

**Use non-null assertions (`!`) when elements are guaranteed to exist** by the framework or element structure. Use optional chaining (`?.`) for defensive programming when existence is uncertain.

### DOM Element Query with `$`

In the `bProgram` callback of `bElement` where elements are defined in `shadowDom`:

```typescript
bProgram({ $ }) {
  // ✅ Good: Non-null assertion for guaranteed elements
  const template = $<HTMLTemplateElement>('row-template')[0]!
  const slot = $<HTMLSlotElement>('slot')[0]!

  return {
    someHandler() {
      // ✅ Good: Optional chaining for runtime safety
      const table = $('table')[0]
      table?.render('content')
    }
  }
}
```

### Indexed Access Pattern

```typescript
// ✅ Preferred: Direct indexed access with optional chaining
let slot = $<HTMLSlotElement>('slot')[0]
let input = slot?.assignedElements()[0]

// ❌ Avoid: Destructuring with fallback arrays (verbose)
let [slot] = $<HTMLSlotElement>('slot')
let [input] = slot?.assignedElements() ?? []
```

### When to Use Each Pattern

**1. Non-null Assertion (`!`)** - Element defined in template, guaranteed to exist:

```typescript
const template = $<HTMLTemplateElement>('my-template')[0]!
```

**2. Optional Chaining (`?.`)** - Element may not exist, dynamic content, or runtime queries:

```typescript
const dynamicEl = $('dynamic-target')[0]
dynamicEl?.attr('class', 'active')
```

**3. Indexed Access Over Destructuring** - Cleaner for single element queries:

```typescript
// ✅ Good
const slot = $<HTMLSlotElement>('slot')[0]

// ❌ Verbose
const [slot] = $<HTMLSlotElement>('slot')
```

**Rationale:** Non-null assertions express confidence in element presence when structurally guaranteed. Optional chaining provides runtime safety for uncertain cases. Indexed access is cleaner than destructuring for single elements.
