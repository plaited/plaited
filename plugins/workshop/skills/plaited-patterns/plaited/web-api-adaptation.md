# Web API Adaptation Standards

**CRITICAL**: Check what bElement already provides BEFORE reaching for web APIs.

## Three-Phase Verification

### Phase 1: What bElement Already Provides

**ALWAYS check first** - bElement wraps many web APIs so you don't have to use them directly.

#### Built-in Capabilities

**BProgramArgs** (available in `bProgram` callback):
- `$` - Shadow DOM query selector with p-target attribute matching
- `root` - ShadowRoot reference (no need for `attachShadow`)
- `host` - Custom element instance (the `this` context)
- `internals` - ElementInternals API (no need for `attachInternals()`)
- `trigger` - Event dispatcher (internal behavioral program events)
- `emit` - Custom event dispatcher for cross-element communication
- `bThreads` - Behavioral thread management
- `bThread` - Thread creation utility
- `bSync` - Synchronization point utility
- `inspector` - Debugging inspector for program state

**Automatic Systems**:
- **p-trigger**: Declarative event binding with automatic delegation
  - MutationObserver watches for new `p-trigger` elements
  - DelegatedListener sets up efficient event delegation
  - No manual `addEventListener` needed
- **p-target**: Automatic helper method assignment
  - `render()` - Replace element children
  - `insert()` - Insert at position (beforebegin, afterbegin, beforeend, afterend)
  - `replace()` - Replace element itself
  - `attr()` - Get/set attributes
  - MutationObserver watches for new `p-target` elements
- **Shadow DOM**: Automatically created via `shadowDom` parameter
- **Lifecycle**: Mapped to `BehavioralElementCallbackDetails` callbacks
- **Form Association**: `formAssociated: true` enables ElementInternals

**Before using ANY web API, ask:**
1. Does `BProgramArgs` already provide this? (Check `$`, `root`, `host`, `internals`, etc.)
2. Can `p-trigger` handle this event? (Avoid manual `addEventListener`)
3. Can `p-target` + helper methods do this? (Avoid manual DOM manipulation)
4. Is this a lifecycle event? (Use `onConnected`, `onDisconnected`, etc.)

### Phase 2: Web API Behavior (if not in bElement)

**Only if Phase 1 doesn't cover it**, verify web API specs:

**Sources (in priority order):**
1. **MDN Web Docs** (developer.mozilla.org)
2. **WHATWG Living Standards** (spec.whatwg.org)
3. **W3C Specifications**

**Common scenarios requiring web APIs:**
- Browser APIs not wrapped by bElement (Intersection Observer, Resize Observer, Web Workers)
- Platform features (Clipboard API, File API, Storage API)
- Advanced Shadow DOM features not in bElement
- CSS APIs (CSS Typed OM, Houdini APIs)

### Phase 3: Adapt to Plaited Patterns

After understanding the web API, adapt it to Plaited's framework:

#### Pattern 1: Event Handling

```typescript
// ❌ WRONG: Manual addEventListener
bProgram({ root }) {
  return {
    onConnected() {
      const button = root.querySelector('button')
      button?.addEventListener('click', () => { /* ... */ })
    }
  }
}

// ✅ CORRECT: p-trigger declarative system
bProgram({ trigger }) {
  return {
    handleClick() {  // Maps to p-trigger={{ click: 'handleClick' }}
      // Handle click
    }
  }
}
// Template: <button p-trigger={{ click: 'handleClick' }}>Click</button>
```

#### Pattern 2: DOM Queries

```typescript
// ❌ WRONG: Manual querySelector
bProgram({ root }) {
  const input = root.querySelector('#my-input')
}

// ✅ CORRECT: $ with p-target
bProgram({ $ }) {
  const input = $<HTMLInputElement>('my-input')[0]
}
// Template: <input p-target="my-input" />
```

#### Pattern 3: DOM Manipulation

```typescript
// ❌ WRONG: Manual DOM manipulation
bProgram({ root }) {
  return {
    updateContent() {
      const div = root.querySelector('.content')
      div.innerHTML = '<p>New content</p>'
    }
  }
}

// ✅ CORRECT: Helper methods on BoundElement
bProgram({ $ }) {
  const content = $('content')[0]
  return {
    updateContent() {
      content?.render(<p>New content</p>)
    }
  }
}
// Template: <div p-target="content" />
```

#### Pattern 4: Lifecycle Management

```typescript
// ❌ WRONG: Raw Custom Element lifecycle
class MyElement extends HTMLElement {
  connectedCallback() { /* ... */ }
  disconnectedCallback() { /* ... */ }
  attributeChangedCallback(name, oldValue, newValue) { /* ... */ }
}

// ✅ CORRECT: BehavioralElementCallbackDetails
bProgram({ trigger }) {
  return {
    onConnected() {
      // Element added to DOM
    },
    onDisconnected() {
      // Element removed from DOM - cleanup here
    },
    onAttributeChanged({ name, oldValue, newValue }) {
      // Attribute changed
    }
  }
}
```

#### Pattern 5: Form Association

```typescript
// ❌ WRONG: Manual ElementInternals
class MyInput extends HTMLElement {
  static formAssociated = true
  #internals = this.attachInternals()

  setValue(value) {
    this.#internals.setFormValue(value)
  }
}

// ✅ CORRECT: internals from BProgramArgs
const MyInput = bElement({
  tag: 'my-input',
  formAssociated: true,
  bProgram({ internals }) {
    return {
      setValue(value: string) {
        internals.setFormValue(value)
      }
    }
  }
})
```

#### Pattern 6: Web API Integration (not in bElement)

When you **must** use a web API not wrapped by bElement:

```typescript
// ✅ CORRECT: Intersection Observer with cleanup
bProgram({ host }) {
  let observer: IntersectionObserver | undefined

  return {
    onConnected() {
      observer = new IntersectionObserver((entries) => {
        // Handle intersection
      })
      observer.observe(host)
    },
    onDisconnected() {
      observer?.disconnect()  // Always cleanup in onDisconnected
      observer = undefined
    }
  }
}
```

## Verification Workflow

### 1. Check bElement First
```typescript
// Before: "I need to query the shadow DOM"
// ✅ Check: Does BProgramArgs provide this?
// Answer: Yes! Use `$` with p-target

// Before: "I need to listen for events"
// ✅ Check: Can p-trigger handle this?
// Answer: Yes! Use p-trigger attribute

// Before: "I need ElementInternals"
// ✅ Check: Is this in BProgramArgs?
// Answer: Yes! Use `internals` parameter
```

### 2. WebFetch MDN (if not in bElement)
```typescript
// Example: Need Intersection Observer
// 1. WebFetch MDN for IntersectionObserver API
// 2. Confirm constructor signature, observe/disconnect methods
```

### 3. LSP Verify Types
```typescript
// 3. LSP hover on BProgramArgs to verify what's available
// 4. LSP hover on internals.setFormValue to verify signature
```

## Critical Adaptation Points

| Need | bElement Provides | Don't Use |
|------|-------------------|-----------|
| Query Shadow DOM | `$` with p-target | `root.querySelector()` |
| Event listening | p-trigger attribute | `addEventListener()` |
| DOM manipulation | Helper methods (render, insert, attr) | Direct DOM APIs |
| Shadow root | `root` in BProgramArgs | `this.shadowRoot` |
| Element instance | `host` in BProgramArgs | `this` |
| ElementInternals | `internals` in BProgramArgs | `this.attachInternals()` |
| Lifecycle | Callback handlers (onConnected, etc.) | Raw Custom Element methods |
| Events to BP | `trigger` in BProgramArgs | Custom event system |
| Cross-element events | `emit` in BProgramArgs | `dispatchEvent()` |
| Async coordination | `bThread`, `bSync` | Manual Promise chains |

## Built-in Features Deep Dive

### p-trigger System
- **Automatic delegation**: Events automatically delegated for performance
- **MutationObserver**: Watches for dynamically added p-trigger elements
- **Composed path traversal**: Handles Shadow DOM event bubbling
- **Cleanup**: Listeners automatically removed on disconnect

### p-target System
- **Helper methods**: `render()`, `insert()`, `replace()`, `attr()` automatically bound
- **MutationObserver**: Watches for dynamically added p-target elements
- **Type-safe queries**: `$<HTMLInputElement>('name')` returns typed NodeListOf
- **Selector matching**: Support for CSS attribute selectors (=, ~=, |=, ^=, $=, *=)

### Lifecycle Integration
- **Property reflection**: `observedAttributes` auto-create getters/setters
- **Callback mapping**: Custom Element callbacks → BehavioralElementCallbackDetails
- **Cleanup tracking**: `#disconnectSet` ensures proper resource cleanup
- **Form integration**: `formAssociated: true` enables all form callbacks

## Example: Complete Pattern

```typescript
// User asks: "Create a toggle input with form association"

// ✅ CORRECT: Use bElement built-ins
import { bElement } from 'plaited'
import { styles, hostStyles } from './toggle-input.css.ts'

export const ToggleInput = bElement({
  tag: 'toggle-input',
  formAssociated: true,  // Built-in form association
  hostStyles,
  shadowDom: (
    <div
      p-target='symbol'      // Automatic helper methods
      {...styles.symbol}
      p-trigger={{ click: 'click' }}  // Automatic event delegation
    />
  ),
  bProgram({ $, internals, trigger }) {  // All built-in to BProgramArgs
    const symbol = $('symbol')[0]  // Type-safe query

    return {
      click() {  // Maps from p-trigger
        const checked = !internals.states.has('checked')
        trigger({ type: 'checked', detail: checked })
      },
      checked(detail: boolean) {
        // Use built-in internals (no attachInternals needed)
        detail ? internals.states.add('checked') : internals.states.delete('checked')
        internals.setFormValue(detail ? 'on' : null)
      },
      onDisconnected() {
        // Cleanup happens automatically via #disconnectSet
      }
    }
  }
})
```

## When Web APIs Are Needed

**Only reach for web APIs when:**
1. Feature not provided by BProgramArgs
2. Browser API with no bElement equivalent (Intersection Observer, Resize Observer, etc.)
3. Platform feature (Clipboard, File API, Storage)
4. Advanced CSS APIs (Houdini, Typed OM)

**Always cleanup web API resources in `onDisconnected`:**
```typescript
bProgram({ host }) {
  let observer: ResizeObserver | undefined

  return {
    onConnected() {
      observer = new ResizeObserver((entries) => { /* ... */ })
      observer.observe(host)
    },
    onDisconnected() {
      observer?.disconnect()  // Critical: cleanup
      observer = undefined
    }
  }
}
```
