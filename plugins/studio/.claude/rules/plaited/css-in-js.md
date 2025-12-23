# CSS-in-JS

## Overview

Plaited's CSS-in-JS system provides two main utilities: `createStyles` for generating atomic, hash-based CSS classes for use inside templates, and `createHostStyles` for creating non-atomic styles for a component's host element (applied via `bElement`'s `hostStyles` property). It offers type-safe styling, automatic Shadow DOM adoption, design tokens, keyframes, and server-side rendering support.

**Key Features:**
- **Atomic CSS (`createStyles`)**: Generates utility classes with deterministic hashes for styling elements inside a template.
- **Host Styling (`createHostStyles`)**: Creates non-atomic styles for a Shadow DOM component's host element (pass to `bElement` via `hostStyles` property).
- **Nested Selectors**: Support for media queries, pseudo-classes, pseudo-elements, and attribute selectors
- **Shadow DOM Integration**: Automatic style adoption using Constructable Stylesheets with WeakMap caching
- **Style Hoisting**: Child template styles automatically bubble up to parent until Shadow DOM boundary
- **SSR Support**: Styles are collected for SSR, converting `:host` to `:root` for styles not adopted by a Shadow DOM
- **Design Tokens**: Type-safe CSS custom properties
- **Keyframe Animations**: Hash-based animation identifiers
- **Style Composition**: Combine multiple style objects with `joinStyles`

## Core Concepts

### 1. Atomic CSS Generation (`createStyles`)

The `createStyles` function generates atomic CSS where each property is converted into a separate class with a deterministic hash:

```typescript
const styles = createStyles({
  button: {
    padding: '10px',
    backgroundColor: 'blue',
  }
})
// Generates:
// { classNames: ['padding_abc123', 'background-color_def456'], stylesheets: [...] }
```

### 2. Nested Selectors with $default

Property values can be simple values or nested objects with an optional `$default` key for the base style alongside selector variants:

```typescript
const styles = createStyles({
  input: {
    border: {
      $default: '1px solid gray',
      '[disabled]': '1px solid red',
      ':focus': '2px solid blue',
    }
  }
})
```

The `$default` key specifies the base value for a property at a given nesting level. This pattern is recursive, allowing nested selectors like media queries to have their own `$default` value and further nested variants.

### 3. Shadow DOM Adoption

Styles are automatically adopted into Shadow DOM via Constructable Stylesheets:

- **WeakMap Caching**: Prevents duplicate style adoption per ShadowRoot
- **Automatic Adoption**: `updateShadowRootStyles()` converts CSS strings to Constructable Stylesheets
- **Efficient Updates**: Reuses cached stylesheets when possible

### 4. Style Hoisting

Child template styles automatically bubble up through the template tree:

```typescript
// Child template
const childStyles = createStyles({ ... })
const Child = () => <div {...childStyles.foo}>Child</div>

// Parent template - child styles hoist to parent
const Parent = () => <div><Child /></div>
```

Hoisting continues **until a Shadow DOM boundary** is reached (via `bElement`), at which point styles are adopted into that ShadowRoot.

### 5. Server-Side Rendering (SSR)

During SSR:
- Styles are collected from all templates and deduplicated.
- **Global Styles**: Styles not adopted by a Shadow DOM are injected into a `<style>` tag. The injection point is prioritized as follows: before `</head>`, after the opening `<body>` tag, and finally at the start of the document.
  - In this process, `:host` selectors are converted to `:root` to apply them globally.
- **Shadow DOM Styles**: Styles adopted by a component with Shadow DOM are embedded within its Declarative Shadow DOM template.

### 6. Browser Hydration

When custom element is defined in browser:
- Declarative Shadow DOM processed
- Inline `<style>` tags converted to Constructable Stylesheets
- WeakMap caching prevents duplicate adoptions
- Shadow boundary styles deduplicated

### 7. Deduplication Strategy

- **SSR Level**: `Set` deduplication in `ssr()` function
- **Shadow Boundary**: `new Set(shadowDom.stylesheets)` when creating shadow root
- **Adoption Level**: WeakMap caching in `updateShadowRootStyles()`

## API Reference

### `createStyles(classNames)`

Creates atomic CSS classes for Shadow DOM child elements.

**Type Signature:**
```typescript
function createStyles<T extends CreateParams>(classNames: T): ClassNames<T>
```

**Parameters:**
- `classNames`: Object where keys are class names and values are CSS property objects

**Returns:** Object mapping class names to `ElementStylesObject` with:
- `classNames`: Array of generated atomic class names (e.g., `['padding_abc123']`)
- `stylesheets`: Array of CSS rule strings

**Example:**
```typescript
import { createStyles } from 'plaited'

const buttonStyles = createStyles({
  btn: {
    padding: '10px 20px',
    backgroundColor: {
      $default: 'blue',
      ':hover': 'darkblue',
      '[disabled]': 'gray',
    },
    fontSize: '16px',
  }
})

// Use in template
export const Button = () => (
  <button {...buttonStyles.btn}>Click Me</button>
)
```

### `createHostStyles(props)`

Creates non-atomic CSS styles for a custom element's `:host` selector and Shadow DOM. Unlike `createStyles` which generates atomic classes, `createHostStyles` generates non-atomic CSS rules scoped to the host element.

**Type Signature:**
```typescript
function createHostStyles(props: CreateHostParams): HostStylesObject
```

**How to Apply:**

1. **Create the styles** using `createHostStyles()`
2. **Pass to `bElement`** via the `hostStyles` property
3. **Automatic adoption** - Styles are then automatically adopted into the Shadow DOM

```typescript
import { bElement, createHostStyles } from 'plaited'

// Step 1: Create host styles
const hostStyles = createHostStyles({
  display: 'block',
  padding: '1rem',
})

// Step 2: Pass to bElement via hostStyles property
const MyElement = bElement({
  tag: 'my-element',
  hostStyles: hostStyles, // ← Apply here
  shadowDom: <slot></slot>
})
// Step 3: Styles automatically adopted into Shadow DOM
```

**Parameters:**

The top-level keys of the `props` object are always CSS properties (e.g., `color`, `backgroundColor`). The value of each property can be a string or a nested object to define more complex styling rules.

#### Rule 1: Simple Host Styling

If a CSS property has a simple string value, it applies directly to the host element, generating a `:host` rule.

```typescript
const hostStyles = createHostStyles({
  display: 'block', // Generates: :host { display: block; }
  padding: '1em',   // Generates: :host { padding: 1em; }
})
```

#### Rule 2: Complex Styling with Nested Objects

For conditional styling, a CSS property's value can be a nested object. The keys within this object determine the final CSS selector.

**A. Styling Elements Inside the Shadow DOM**

To style an element inside the shadow root, use a standard CSS selector as the key. This selector will be appended to `:host`, scoping it correctly. The `$default` key is a special case that targets the `:host` itself.

```typescript
const hostStyles = createHostStyles({
  color: {
    $default: 'black',        // Generates: :host { color: black; }
    'h1': 'darkblue',         // Generates: :host h1 { color: darkblue; }
    '> .wrapper': 'purple',   // Generates: :host > .wrapper { color: purple; }
    '::slotted(span)': 'green' // Styles `<span>` elements from the light DOM rendered in a `<slot>`
  }
})
```

**B. Styling the Host Conditionally (`:host(...)`)**

To style the host element based on its own attributes, classes, or pseudo-classes as they exist in the light DOM, use the special `$compoundSelectors` key. The selectors within this object are wrapped by `:host(...)`.

```typescript
const hostStyles = createHostStyles({
  backgroundColor: {
    $default: 'white', // Base style for :host
    $compoundSelectors: {
      ':hover': 'lightgrey',      // Generates: :host(:hover) { ... }
      '[disabled]': '#eee',       // Generates: :host([disabled]) { ... }
      '.dark-theme': 'black',     // Generates: :host(.dark-theme) { ... }
    },
  },
})
```
This pattern allows a host element to change its own appearance based on its context in the main document. Media queries can also be nested within these selectors for responsive host styles.

**C. Conditionally Styling Shadow DOM Children**

You can combine the previous rules to style elements inside the shadow root based on the host element's state. To do this, nest a descendant selector key *inside* a `$compoundSelectors` object.

```typescript
const hostStyles = createHostStyles({
  // Rule B applied to `backgroundColor`
  backgroundColor: {
    $default: 'white',
    $compoundSelectors: {
      '[disabled]': '#eee', // Generates: :host([disabled]) { background-color: #eee; }
    },
  },
  // Rule C applied to `color`
  color: {
    $default: 'black',
    $compoundSelectors: {
      '[disabled]': {
        // This targets a child, not the host
        '.label': 'grey', // Generates: :host([disabled]) .label { color: grey; }
      },
    }
  }
})
```
This is a powerful feature of `createHostStyles`, allowing the host's context to cascade styles into its private Shadow DOM.

**Example:**
```typescript
import { createHostStyles, bElement } from 'plaited'

const MyElement = bElement({
  tag: 'my-element',
  hostStyles: createHostStyles({
    display: 'block',
    padding: '20px',
    backgroundColor: {
      $default: 'white',
      $compoundSelectors: {
        '.dark': 'black',
        '[data-theme="blue"]': 'lightblue',
      }
    }
  }),
  shadowDom: <slot></slot>
})
```

### `createKeyframes(name, frames)`

Creates CSS `@keyframes` animation with hash-based identifier.

**Type Signature:**
```typescript
function createKeyframes(
  name: string,
  frames: CSSKeyFrames
): StyleFunctionKeyframe
```

**Parameters:**
- `name`: Base animation name (hash will be appended)
- `frames`: Object with `from`, `to`, or percentage keys defining animation stages

**Returns:** Function with `.id` property:
- Invoke `()` to get `HostStylesObject` with animation CSS
- Access `.id` to reference animation name in CSS

**Example:**
```typescript
import { createKeyframes, createHostStyles, joinStyles, bElement } from 'plaited'

const fadeIn = createKeyframes('fadeIn', {
  from: { opacity: '0' },
  to: { opacity: '1' }
})

const AnimatedElement = bElement({
  tag: 'animated-element',
  hostStyles: joinStyles(
    createHostStyles({
      animation: `${fadeIn.id} 0.3s ease-in`,
    }),
    fadeIn()  // Combine keyframe styles with host styles
  ),
  shadowDom: <slot></slot>
})
```

### `createTokens(namespace, tokens)`

Creates design tokens as CSS custom properties with type-safe references.

**Type Signature:**
```typescript
function createTokens<T extends TokenDefinitions>(
  namespace: string,
  tokens: T
): TokenReferences<T>
```

**Parameters:**
- `namespace`: String prefix for CSS variable names (kebab-cased)
- `tokens`: Object defining token values with `$value` key

**Returns:** Object with token reference functions and `.styles` property containing CSS custom property definitions

**Token Usage Pattern:**
- **Pass token reference directly** (not invoked) when used as CSS property values
- **Invoke `token()`** only when you need the CSS variable string reference

**Example:**
```typescript
import { createTokens, createStyles, createHostStyles, createKeyframes } from 'plaited'

const tokens = createTokens('theme', {
  primary: { $value: '#007bff' },
  spacing: { $value: '16px' },
})

// ✅ Correct: Pass token reference directly (not invoked)
const styles = createStyles({
  button: {
    backgroundColor: tokens.primary,  // NOT tokens.primary()
    padding: tokens.spacing,
  }
})

const hostStyles = createHostStyles({
  color: tokens.primary,  // NOT tokens.primary()
  padding: tokens.spacing,
})

// Use in bElement - token .styles auto-included
export const MyElement = bElement({
  tag: 'my-element',
  hostStyles,
  shadowDom: <div {...styles.button}>Click</div>
})

// Only invoke token() when you need the CSS variable string
console.log(tokens.primary())  // 'var(--theme-primary)'
```

**Supports:**
- Simple values: `{ $value: 'string' | number }`
- Arrays: `{ $value: ['value1', 'value2'], $csv?: boolean }`
- Functions: `{ $value: { $function: 'name', $arguments: [...], $csv?: boolean } }`
- Nested selectors: `{ $default: { $value }, ':hover': { $value } }`
- Token references: `{ $value: otherToken }` (pass reference, don't invoke)

### `joinStyles(...styles)`

A flexible utility that combines multiple style objects into a single `StylesObject`. It is designed to merge styles from `createStyles`, `createHostStyles`, and `createTokens`, and it intelligently filters out any falsy values, making it ideal for conditional style composition.

**Type Signature:**
```typescript
function joinStyles(
  ...styleObjects: (StylesObject | DesignTokenReference | undefined)[]
): StylesObject
```

**Parameters:**
- `...styleObjects`: A variable number of style objects to combine. Falsy values (`undefined`, `null`, `false`) in the list are ignored. This can include:
  - `StylesObject` from `createStyles` and `createHostStyles`.
  - `DesignTokenReference` from `createTokens`.

**Returns:**
A new `StylesObject` with `classNames` and `stylesheets` arrays containing the merged values from all provided sources.

**Key Behaviors:**
- **Class Names**: Concatenates `classNames` from all `createStyles` objects.
- **Stylesheets**: Merges `stylesheets` from `createStyles`, `createHostStyles`, and the `.styles` property of `createTokens` objects.
- **Conditional Logic**: Because it filters falsy values, you can use short-circuiting for conditional styling.

**Example:**
```typescript
import { bElement, createStyles, joinStyles } from 'plaited'

// Base styles for all buttons
const baseStyles = createStyles({
  btn: {
    padding: '8px 16px',
    border: '1px solid black',
    cursor: 'pointer',
  },
})

// Styles for the 'primary' variant
const primaryStyles = createStyles({
  btn: {
    backgroundColor: 'blue',
    color: 'white',
    borderColor: 'blue',
  },
})

// Styles for the 'disabled' state
const disabledStyles = createStyles({
  btn: {
    opacity: '0.5',
    cursor: 'not-allowed',
  },
})

export const MyButton = bElement({
  tag: 'my-button',
  observedAttributes: [ 'variant', 'disabled' ],
  bProgram() {
    const { variant, disabled } = this.attrs

    // Dynamically join styles based on attributes
    const styles = joinStyles(
      baseStyles.btn,
      variant === 'primary' && primaryStyles.btn,
      disabled !== undefined && disabledStyles.btn,
    )

    this.render(<button {...styles}><slot /></button>)
  },
})
```

## Usage Patterns

### 1. Basic Styling

```typescript
import { createStyles } from 'plaited'

const cardStyles = createStyles({
  card: {
    padding: '20px',
    borderRadius: '8px',
    backgroundColor: 'white',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  }
})

export const Card = ({ children }) => (
  <div {...cardStyles.card}>{children}</div>
)
```

### 2. Nested Selectors

```typescript
import { createStyles } from 'plaited'

const linkStyles = createStyles({
  link: {
    color: {
      $default: 'blue',
      ':hover': 'darkblue',
      ':visited': 'purple',
    },
    textDecoration: {
      $default: 'none',
      ':hover': 'underline',
    }
  }
})

export const Link = ({ href, children }) => (
  <a href={href} {...linkStyles.link}>{children}</a>
)
```

### 3. Responsive Design

```typescript
import { createStyles } from 'plaited'

const gridStyles = createStyles({
  container: {
    display: 'grid',
    gridTemplateColumns: {
      $default: '1fr',
      '@media (min-width: 768px)': 'repeat(2, 1fr)',
      '@media (min-width: 1024px)': 'repeat(3, 1fr)',
    },
    gap: '20px',
  }
})

export const Grid = ({ children }) => (
  <div {...gridStyles.container}>{children}</div>
)
```

### 4. Host Element Styling

```typescript
import { createHostStyles, bElement } from 'plaited'

const MyCard = bElement({
  tag: 'my-card',
  hostStyles: createHostStyles({
    display: 'block',
    padding: '20px',
    borderRadius: '8px',
    backgroundColor: {
      $default: 'white',
      $compoundSelectors: {
        '.highlighted': 'yellow',
        '[data-variant="primary"]': 'lightblue',
      }
    }
  }),
  shadowDom: <slot></slot>
})
```

### 5. Design Tokens

```typescript
import { createTokens, createStyles, createHostStyles } from 'plaited'

const tokens = createTokens('theme', {
  primary: { $value: '#007bff' },
  secondary: { $value: '#6c757d' },
  spacing: { $value: '16px' },
  fontSize: { $value: '1rem' },
})

// ✅ Pass token references directly (not invoked) as CSS values
const buttonStyles = createStyles({
  button: {
    backgroundColor: tokens.primary,  // NOT tokens.primary()
    color: 'white',
    padding: tokens.spacing,
    fontSize: tokens.fontSize,
    ':hover': {
      backgroundColor: tokens.secondary,
    }
  }
})

// ✅ Token styles automatically included in createHostStyles
const MyButton = bElement({
  tag: 'my-button',
  hostStyles: createHostStyles({
    display: 'inline-block',
    margin: tokens.spacing,  // Token .styles auto-pushed
  }),
  shadowDom: <button {...buttonStyles.button}><slot></slot></button>
})

// Only invoke token() when you need the CSS variable string reference
console.log(tokens.primary())  // 'var(--theme-primary)'
```

### 6. Animations with Keyframes and Tokens

```typescript
import { createTokens, createKeyframes, createHostStyles, joinStyles, bElement } from 'plaited'

const colors = createTokens('colors', {
  primary: { $value: '#007bff' },
  accent: { $value: '#ff6b6b' },
})

const pulse = createKeyframes('pulse', {
  '0%': {
    transform: 'scale(1)',
    backgroundColor: colors.primary  // NOT colors.primary()
  },
  '50%': {
    transform: 'scale(1.05)',
    backgroundColor: colors.accent
  },
  '100%': {
    transform: 'scale(1)',
    backgroundColor: colors.primary
  }
})

const AnimatedCard = bElement({
  tag: 'animated-card',
  hostStyles: joinStyles(
    createHostStyles({
      display: 'block',
      padding: '20px',
      animation: `${pulse.id} 2s infinite`,
    }),
    pulse()  // Combine keyframe styles with host styles
  ),
  shadowDom: <slot></slot>
})
```

### 7. Composing Styles with joinStyles

```typescript
import { createStyles, joinStyles } from 'plaited'

const baseButton = createStyles({
  btn: {
    fontFamily: 'sans-serif',
    fontWeight: 700,
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
  }
})

const buttonSizes = createStyles({
  small: {
    fontSize: '12px',
    padding: '8px 16px',
  },
  large: {
    fontSize: '18px',
    padding: '16px 32px',
  }
})

// Combine multiple ElementStylesObject instances
const smallButton = joinStyles(baseButton.btn, buttonSizes.small)

export const SmallButton = ({ children }) => (
  <button {...smallButton}>{children}</button>
)
```

### 8. Attribute-Based Styling

```typescript
import { bElement, createStyles } from 'plaited'

const inputStyles = createStyles({
  field: {
    padding: '8px',
    border: {
      $default: '1px solid gray',
      '[disabled]': '1px solid lightgray',
      ':focus': '2px solid blue',
    },
    backgroundColor: {
      $default: 'white',
      '[disabled]': '#f5f5f5',
    }
  }
})

const MyInput = bElement({
  tag: 'my-input',
  observedAttributes: ['disabled'],
  shadowDom: <input p-target="input" {...inputStyles.field} />,
  bProgram({ $ }) {
    const input = $('input')[0]
    return {
      onAttributeChanged({ name, newValue }) {
        // newValue is string | null - pass directly to attr()
        input?.attr(name, newValue)
      }
    }
  }
})
```

## Integration with Other Features

### Template System

Styles are spread onto elements using JSX syntax:

```typescript
const styles = createStyles({
  button: { padding: '10px', backgroundColor: 'blue' }
})

// Spread style object onto element
const Button = () => <button {...styles.button}>Click</button>
```

The spread operator adds `classNames` and `stylesheets` properties to the element's `TemplateObject`.

### bElement Integration

Host styles are specified via the `hostStyles` parameter:

```typescript
import { bElement, createHostStyles } from 'plaited'

const MyElement = bElement({
  tag: 'my-element',
  hostStyles: createHostStyles({
    display: 'block',
    padding: '20px',
  }),
  shadowDom: <slot></slot>
})
```

Styles from child templates automatically hoist to the `bElement` shadow boundary where they are adopted.

### Server-Side Rendering

Plaited's `ssr()` function distinguishes between global styles and styles meant for a Shadow DOM.

- **Global Styles**: Any stylesheets not adopted by a shadow root are considered global. They are collected, deduplicated, and injected into a single `<style>` tag. During this process, `:host` selectors are converted to `:root` to apply them to the document. The injection point is prioritized: before `</head>`, then after `<body>`, then at the document start.
- **Shadow DOM Styles**: Stylesheets associated with a custom element using Shadow DOM are embedded directly within its Declarative Shadow DOM `<template>` tag. This ensures they are scoped correctly when the element hydrates on the client.

```typescript
import { ssr } from 'plaited'

const html = ssr(<MyTemplate />)
// Styles injected with :root selectors

// SSR Output:
// <style>:root { --theme-primary: #007bff; }</style>
```

### Browser Hydration

When the custom element is defined in the browser:

1. Declarative Shadow DOM processed
2. Inline `<style>` tags converted to Constructable Stylesheets
3. WeakMap caching prevents duplicate adoptions
4. Styles available immediately for rendering

### Attribute-Based Styling Pattern

Instead of dynamically applying classes, use attribute selectors and toggle attributes:

```typescript
const styles = createStyles({
  button: {
    backgroundColor: {
      $default: 'gray',
      '[data-variant="primary"]': 'blue',
      '[data-size="large"]': 'blue',
    },
    padding: {
      $default: '8px 16px',
      '[data-size="large"]': '16px 32px',
    }
  }
})

// In bProgram, toggle attributes to change styles
bProgram({ $ }) {
  const button = $('button')[0]
  return {
    makeVariant() {
      button?.attr('data-variant', 'primary')
    }
  }
}
```

## Style Hoisting & Shadow DOM Adoption

```mermaid
sequenceDiagram
    participant HostStyles as createHostStyles()
    participant Child as Child Template
    participant Parent as Parent Template
    participant BElement as bElement (Shadow Boundary)
    participant ShadowRoot as ShadowRoot
    participant Browser as Browser (Constructable Stylesheets)

    HostStyles->>HostStyles: Generate :host CSS rules<br/>{stylesheets}
    Child->>Child: createStyles() generates<br/>{classNames, stylesheets}
    Child->>Parent: Template composition<br/>stylesheets.unshift(...child.stylesheets)
    Note over Parent: Child styles hoist up template tree
    Parent->>BElement: Hoisting stops at shadow boundary
    HostStyles->>BElement: Passed via hostStyles property
    BElement->>BElement: Merge hostStyles.stylesheets<br/>with shadowDom.stylesheets
    BElement->>BElement: new Set([...all stylesheets])<br/>Deduplicate at shadow boundary
    BElement->>ShadowRoot: getDocumentFragment() called
    ShadowRoot->>Browser: updateShadowRootStyles(root, stylesheets)
    Browser->>Browser: WeakMap check:<br/>Already adopted?
    alt Not cached
        Browser->>Browser: Convert CSS strings to<br/>CSSStyleSheet objects
        Browser->>ShadowRoot: shadowRoot.adoptedStyleSheets = [...]
        Browser->>Browser: Cache in WeakMap
    else Cached
        Browser->>ShadowRoot: Reuse cached stylesheets
    end
    Note over ShadowRoot,Browser: All styles active in Shadow DOM<br/>(host styles + hoisted child styles)
```

## Common Patterns

### 1. Responsive Typography with Container Queries

```typescript
import { createStyles } from 'plaited'

const typography = createStyles({
  heading: {
    fontSize: {
      $default: '1.5rem',
      '@container (min-width: 400px)': '2rem',
      '@container (min-width: 600px)': '2.5rem',
    },
    lineHeight: '1.2',
  }
})

export const ResponsiveHeading = () => (
  <h1 {...typography.heading}>Responsive Heading</h1>
)
```

### 2. Button with Dynamic Variant Switching

```typescript
import { bElement, createStyles, type FT } from 'plaited'

const buttonStyles = createStyles({
  btn: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    backgroundColor: {
      $default: 'gray',
      '[data-variant="primary"]': 'blue',
      '[data-variant="secondary"]': 'green',
    },
    color: {
      $default: 'black',
      '[data-variant="primary"]': 'white',
      '[data-variant="secondary"]': 'white',
    }
  }
})

// Template accepts variant and PlaitedAttributes (including p-target)
const Button: FT<{ variant?: 'primary' | 'secondary' }> = ({ variant, children, ...attrs }) => (
  <button {...attrs} {...buttonStyles.btn} data-variant={variant}>
    {children}
  </button>
)

// Static usage - template renders once
export const staticButton = (
  <Button variant="primary">Click Me</Button>
)

// Dynamic usage - query with $ and manipulate via helper methods
export const MyCard = bElement({
  tag: 'my-card',
  shadowDom: (
    <>
      <Button p-target="actionBtn" variant="primary">Action</Button>
    </>
  ),
  bProgram({ $ }) {
    const actionBtn = $('actionBtn')[0]

    return {
      toggleVariant() {
        // Templates are static once rendered
        // Change appearance via attribute manipulation using attr() helper
        const current = actionBtn?.attr('data-variant')
        actionBtn?.attr(
          'data-variant',
          current === 'primary' ? 'secondary' : 'primary'
        )
      }
    }
  }
})
```

**Key Principle**: Templates render static markup. Dynamic changes require $ selector + helper methods (`.attr()`, `.render()`, `.insert()`, etc.).

### 3. Dark Mode with Prefers Color Scheme

```typescript
import { createStyles } from 'plaited'

const cardStyles = createStyles({
  card: {
    padding: '20px',
    backgroundColor: {
      $default: 'white',
      '@media (prefers-color-scheme: dark)': '#1a1a1a',
    },
    color: {
      $default: 'black',
      '@media (prefers-color-scheme: dark)': 'white',
    }
  }
})

export const Card = ({ children }) => (
  <div {...cardStyles.card}>{children}</div>
)
```

### 4. Design Tokens with Keyframe Animations

```typescript
import { createTokens, createKeyframes, createHostStyles, joinStyles, bElement } from 'plaited'

const tokens = createTokens('theme', {
  primary: { $value: '#007bff' },
  spacing: { $value: '16px' },
})

const fadeIn = createKeyframes('fadeIn', {
  from: { opacity: '0' },
  to: { opacity: '1' }
})

const AnimatedCard = bElement({
  tag: 'animated-card',
  hostStyles: joinStyles(
    createHostStyles({
      display: 'block',
      padding: tokens.spacing,  // NOT tokens.spacing() - token .styles auto-pushed
      color: tokens.primary,
      animation: `${fadeIn.id} 0.3s ease-in`,
    }),
    fadeIn()  // Combine keyframe styles with host styles
  ),
  shadowDom: <slot></slot>
})
```

### 5. Pseudo-Elements for Decorative Effects

```typescript
import { createStyles } from 'plaited'

const decoratedStyles = createStyles({
  badge: {
    position: 'relative',
    padding: '8px 16px',
    '::before': {
      content: '""',
      position: 'absolute',
      top: '0',
      left: '0',
      width: '4px',
      height: '100%',
      backgroundColor: 'blue',
    }
  }
})

export const Badge = ({ children }) => (
  <div {...decoratedStyles.badge}>{children}</div>
)
```

## Common Pitfalls

### 1. Spread Operator Adds classNames + stylesheets

When you spread a style object onto an element, it adds both `classNames` and `stylesheets` properties:

```typescript
const styles = createStyles({
  btn: { padding: '10px' }
})

// This adds classNames=['padding_abc'] and stylesheets=[...]
<button {...styles.btn}>Click</button>
```

**How It Works:** The spread operator merges the `ElementStylesObject` properties (`classNames` and `stylesheets`) into the element's attributes, which are then processed by the template system.

### 2. joinStyles Doesn't Deduplicate Identical CSS

`joinStyles` merges arrays without deduplication:

```typescript
const combined = joinStyles(styles.a, styles.b, styles.a)
// styles.a's CSS appears twice in combined.stylesheets
```

**Deduplication happens at:**
- SSR level (via `Set`)
- Shadow boundary (via `Set`)
- Adoption level (via WeakMap caching)

### 3. Token Usage Pattern

❌ **Wrong:** Invoking tokens when passing as CSS values
```typescript
const styles = createStyles({
  button: {
    backgroundColor: tokens.primary(),  // WRONG - don't invoke
  }
})
```

✅ **Correct:** Pass token reference directly
```typescript
const styles = createStyles({
  button: {
    backgroundColor: tokens.primary,  // Correct - pass reference
  }
})
```

Only invoke `token()` when you need the CSS variable string reference:
```typescript
console.log(tokens.primary())  // 'var(--theme-primary)'
```

### 4. createHostStyles Single Parameter

❌ **Wrong:** Passing second array parameter
```typescript
const hostStyles = createHostStyles(
  { color: 'red' },
  [token.styles]  // WRONG - no second parameter
)
```

✅ **Correct:** Token styles automatically included
```typescript
const hostStyles = createHostStyles({
  color: tokens.primary  // Token .styles auto-pushed
})
```

### 5. Nested Selector Purpose

❌ **Wrong:** Using nested selectors to create new properties
```typescript
const styles = createStyles({
  input: {
    border: '1px solid gray',
    '[disabled]': {
      opacity: '0.5',  // WRONG - creates new property
    }
  }
})
```

✅ **Correct:** Nested selectors modify the SAME property
```typescript
const styles = createStyles({
  input: {
    border: {
      $default: '1px solid gray',
      '[disabled]': '1px solid red',  // Same property, different value
    },
    opacity: {
      $default: '1',
      '[disabled]': '0.5',
    }
  }
})
```

### 6. Attribute-Based Styling Instead of Class Manipulation

❌ **Wrong:** Trying to dynamically change classes or re-render templates
```typescript
// Don't try to change classes or re-render different template variants
```

✅ **Correct:** Use attribute selectors in CSS, toggle attributes in bProgram
```typescript
const styles = createStyles({
  button: {
    backgroundColor: {
      $default: 'gray',
      '[data-variant="primary"]': 'blue',
    }
  }
})

// Template with spread {...attrs} for p-target
const Button: FT<{ variant?: string }> = ({ variant, children, ...attrs }) => (
  <button {...attrs} {...styles.button} data-variant={variant}>
    {children}
  </button>
)

// Use in bElement
bElement({
  shadowDom: <Button p-target="btn" variant="primary" />,
  bProgram({ $ }) {
    const btn = $('btn')[0]
    return {
      changeStyle() {
        btn?.attr('data-variant', 'secondary')
      }
    }
  }
})
```

**Key Principle:** Templates are static once rendered. Dynamic changes require $ selector + helper methods.

### 7. Custom Attributes Require data- Prefix

❌ **Wrong:** Using custom attributes without `data-` prefix
```typescript
<button variant="primary">Click</button>
```

✅ **Correct:** Use `data-` prefix for custom attributes
```typescript
<button data-variant="primary">Click</button>
```

This follows the HTML standard for custom attributes.
