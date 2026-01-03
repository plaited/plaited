# bElement: Custom Elements API

`bElement` creates Custom Element with Shadow DOM, behavioral programming, and declarative event handling. It's the fundamental building block for interactive islands in Plaited applications.

**For foundational BP concepts**, see `behavioral-programs.md`
**For cross-island coordination**, see `cross-island-communication.md`
**For form integration**, see `form-associated-elements.md`

## Auto-Registration in DOM Environments

`bElement` automatically registers the custom element when the module is imported **in DOM environments** (browser, story tests). Registration is skipped during SSR or when no DOM is available (`canUseDOM()` check).

```typescript
// In a browser: when this module is imported, 'my-element' is registered
const MyElement = bElement({
  tag: 'my-element',
  shadowDom: <slot></slot>
})

// customElements.get('my-element') !== undefined (in browser)
// customElements.get('my-element') === undefined (during SSR)
```

**Implications for hydration testing**:
- Importing any export from a file containing a bElement will register that element in the browser
- For hydration tests, keep bElement definitions in separate files from constants/styles
- Use dynamic imports (`await import('./element.ts')`) to control registration timing

**Example: Hydration Test Structure**
```typescript
// constants.ts - Safe to import, no bElement
export const TAG = 'my-element'
export const styles = createStyles({ ... })

// element.ts - Importing in browser registers the element
import { TAG, styles } from './constants.ts'
export const MyElement = bElement({ tag: TAG, ... })

// test.stories.tsx
import { TAG, styles } from './constants.ts'  // Safe - no registration
// ... render pre-hydration state with declarative shadow DOM ...
await import('./element.ts')  // Now register element to trigger hydration
```

## When to Use bElement

Use `bElement` when you need any of these capabilities:

### 1. Islands Architecture

Interactive regions with behavioral programs coordinating complex state:

```typescript
const TodoList = bElement<{
  inputChange: InputEvent & { target: HTMLInputElement }
}>({
  tag: 'todo-list',
  shadowDom: (
    <>
      <input type="text" p-target="input" p-trigger={{ input: 'inputChange' }} />
      <button p-target="add" p-trigger={{ click: 'add' }}>Add</button>
      <ul p-target="list"></ul>
    </>
  ),
  bProgram({ $, bThreads, bSync, bThread }) {
    let currentInput = ''

    bThreads.set({
      preventEmptyAdd: bThread([
        bSync({ block: ({ type }) => type === 'add' && !currentInput.trim() })
      ], true)
    })

    return {
      inputChange(e) {
        currentInput = e.target.value
      },
      add() {
        const list = $('list')[0]
        list?.insert('beforeend', `<li>${currentInput}</li>`)
        currentInput = ''
        const input = $<HTMLInputElement>('input')[0]
        input?.attr('value', '')
      }
    }
  }
})
```

**Handler Type Inference**: Use the generic type parameter to declare event types for handlers that need typed parameters. The event type is inferred from the `p-trigger` key (e.g., `input` → `InputEvent`, `click` → `MouseEvent`). Use intersection types to narrow the `target` property (e.g., `InputEvent & { target: HTMLInputElement }`). TypeScript automatically infers handler parameter types from the generic, eliminating type casts. For non-standard events, use `CustomEvent<YourType>`. Handlers that don't use parameters (like `add` above) don't need to be included in the generic.

### 2. Decorator Pattern

Wrapping hard-to-style native elements (inputs, checkboxes, selects):

**File: `surfaces.tokens.ts`**
```typescript
import { createTokens } from 'plaited'

export const { surfaces } = createTokens('surfaces', {
  fill: {
    default: { $value: 'lightblue' },
    checked: { $value: 'blue' },
    disabled: { $value: 'gray' },
  }
})
```

**File: `decorated-checkbox.css.ts`**
```typescript
import { createStyles, createHostStyles, joinStyles } from 'plaited'
import { surfaces } from './surfaces.tokens.ts'

export const styles = createStyles({
  symbol: {
    height: '16px',
    width: '16px',
    backgroundColor: {
      $default: surfaces.fill.default,
      ':host(:state(checked))': surfaces.fill.checked,
      ':host(:state(disabled))': surfaces.fill.disabled,
    },
    gridArea: 'input'
  },
  input: {
    gridArea: 'input',
    height: '16px',
    width: '16px',
    opacity: '0',
    margin: '0',
    padding: '0'
  }
})

export const hostStyles = joinStyles(
  surfaces.fill.default,
  surfaces.fill.checked,
  surfaces.fill.disabled,
  createHostStyles({
    display: 'inline-grid',
    gridTemplate: '"input" 16px / 16px'
  })
)
```

**File: `decorated-checkbox.tsx`**
```typescript
import { bElement, useAttributesObserver } from 'plaited'
import { styles, hostStyles } from './decorated-checkbox.css.ts'

/**
 * DecorateCheckbox - Wraps native checkbox with custom styling
 *
 * Demonstrates decorator pattern for hard-to-style native elements.
 * Uses useAttributesObserver to sync slotted checkbox state with custom states.
 */
export const DecorateCheckbox = bElement({
  tag: 'decorate-checkbox',
  hostStyles,
  shadowDom: (
    <>
      <div
        p-target="symbol"
        {...styles.symbol}
        p-trigger={{ click: 'click' }}
      />
      <slot
        p-target="slot"
        p-trigger={{ slotchange: 'slotchange' }}
        {...styles.input}
      ></slot>
    </>
  ),
  bProgram({ $, internals, trigger }) {
    let slot = $<HTMLSlotElement>('slot')[0]
    let input = slot?.assignedElements()[0]
    let inputObserver = useAttributesObserver('change', trigger)

    return {
      slotchange() {
        // Re-query after slot content changes
        slot = $<HTMLSlotElement>('slot')[0]
        input = slot?.assignedElements()[0]
        inputObserver = useAttributesObserver('change', trigger)
      },

      change({ name, newValue }) {
        // Sync slotted input attributes with custom states
        newValue ? internals.states.add(name) : internals.states.delete(name)
      },

      onConnected() {
        // Initialize states from slotted input
        input?.hasAttribute('checked') && internals.states.add('checked')
        input?.hasAttribute('disabled') && internals.states.add('disabled')

        // Start observing slotted input attributes
        input && inputObserver(input, ['checked', 'disabled'])
      }
    }
  }
})
```

**Usage:**
```typescript
<DecorateCheckbox>
  <input type="checkbox" checked />
</DecorateCheckbox>
```

**Pattern Notes**:
- **Grid Positioning**: Uses CSS Grid to overlay the custom symbol exactly over the hidden native checkbox
- **Slot Styling**: Applies styles directly to `<slot>` to position the slotted input
- **Variable Reassignment**: Uses `let` for slot, input, and observer to handle dynamic slot content changes
- **useAttributesObserver**: Observes attribute changes on the slotted input and syncs them with custom states
- **Token Reference**: Pass `surfaces.fill` (the token property) to `joinStyles()` to include CSS variable definitions

### 3. Stateful Elements

Complex state management with behavioral threads (popovers, dialogs, carousels):

```typescript
const Popover = bElement({
  tag: 'custom-popover',
  observedAttributes: ['open'],
  publicEvents: ['close'],
  shadowDom: (
    <>
      <slot name="trigger" p-trigger={{ click: 'toggle' }}></slot>
      <div popover p-target="popover">
        <slot name="content" p-trigger={{ close: 'close' }}></slot>
      </div>
    </>
  ),
  bProgram({ $, internals }) {
    const popover = $('popover')[0]

    return {
      toggle() {
        if (internals.states.has('open')) {
          internals.states.delete('open')
        } else {
          internals.states.add('open')
        }
        popover?.togglePopover()
      },
      close() {
        internals.states.delete('open')
        popover?.hidePopover()
      }
    }
  }
})
```

### 4. Form-Associated Elements

Custom form controls using ElementInternals - both wrapping native elements and creating new controls that don't exist natively:

**File: `surfaces.tokens.ts`**
```typescript
import { createTokens } from 'plaited'

export const { surfaces } = createTokens('surfaces', {
  fill: {
    default: { $value: 'lightblue' },
    checked: { $value: 'blue' },
    disabled: { $value: 'gray' },
  }
})
```

**File: `toggle-input.css.ts`**
```typescript
import { createStyles, createHostStyles, joinStyles } from 'plaited'
import { surfaces } from './surfaces.tokens.ts'

export const styles = createStyles({
  symbol: {
    height: '16px',
    width: '16px',
    backgroundColor: {
      $default: surfaces.fill.default,
      ':host(:state(checked))': surfaces.fill.checked,
      ':host(:state(disabled))': surfaces.fill.disabled,
    },
  }
})

export const hostStyles = joinStyles(
  surfaces.fill.default,
  surfaces.fill.checked,
  surfaces.fill.disabled,
  createHostStyles({
    display: 'inline-grid'
  })
)
```

**File: `toggle-input.ts`**
```typescript
import { bElement } from 'plaited'
import { isTypeOf } from 'plaited/utils'
import { styles, hostStyles } from './toggle-input.css.ts'

export const ToggleInput = bElement<{
  click: MouseEvent & { target: HTMLInputElement }
  checked: boolean
  disabled: boolean
  valueChange: string | null
}>({
  tag: 'toggle-input',
  observedAttributes: ['disabled', 'checked', 'value'],
  formAssociated: true,
  hostStyles,
  shadowDom: (
    <div
      p-target="symbol"
      {...styles.symbol}
      p-trigger={{ click: 'click' }}
    />
  ),
  bProgram({ trigger, internals, root, bThreads, bSync, bThread }) {
    bThreads.set({
      onDisabled: bThread([
        bSync({
          block: [
            ({ type }) => type === 'checked' && internals.states.has('disabled'),
            ({ type }) => type === 'valueChange' && internals.states.has('disabled')
          ]
        })
      ], true)
    })

    return {
      click() {
        trigger({ type: 'checked', detail: !internals.states.has('checked') })
      },
      checked(val) {
        root.host.toggleAttribute('checked', val)
        if (val) {
          internals.states.add('checked')
          internals.setFormValue('on', root.host.getAttribute('value') ?? 'checked')
        } else {
          internals.states.delete('checked')
          internals.setFormValue('off')
        }
      },
      disabled(val) {
        if (val) {
          internals.states.add('disabled')
        } else {
          internals.states.delete('disabled')
        }
      },
      valueChange(val) {
        const isChecked = internals.states.has('checked')
        if (val && isChecked) {
          internals.setFormValue('on', val)
        } else if (isChecked) {
          internals.setFormValue('on', 'checked')
        }
      },
      onAttributeChanged({ name, newValue }) {
        name === 'checked' && trigger({
          type: 'checked',
          detail: isTypeOf<string>(newValue, 'string')
        })
        name === 'disabled' && trigger({
          type: 'disabled',
          detail: isTypeOf<string>(newValue, 'string')
        })
        name === 'value' && trigger({ type: 'valueChange', detail: newValue })
      },
      onConnected() {
        if (root.host.hasAttribute('checked')) {
          internals.states.add('checked')
          internals.setFormValue('on', root.host.getAttribute('value') ?? 'checked')
        }
        if (root.host.hasAttribute('disabled')) {
          internals.states.add('disabled')
        }
      }
    }
  }
})
```

**Pattern Notes**:
- Uses behavioral threads to block `checked` and `valueChange` events when disabled
- Syncs attributes with custom states (`:state(checked)`, `:state(disabled)`)
- Integrates with forms via `internals.setFormValue()`
- Token references passed to `joinStyles()` for CSS variable definitions

**See `form-associated-elements.md` for complete form integration patterns.**

## bElement API Overview

```typescript
import { bElement } from 'plaited'
import { hostStyles } from './my-element.css.ts'

const MyElement = bElement<{
  eventType1: DetailType1
  eventType2: DetailType2
}>({
  tag: 'my-element',          // Required: Custom element tag (must have hyphen)
  shadowDom: <slot></slot>,   // Required: Shadow DOM template
  mode: 'open',               // Optional: Shadow mode (default: 'open')
  delegatesFocus: true,       // Optional: Focus delegation (default: true)
  slotAssignment: 'named',    // Optional: Slot assignment (default: 'named')
  observedAttributes: [],     // Optional: Attributes to watch
  publicEvents: [],           // Optional: Events for cross-island communication
  hostStyles,                 // Optional: Import from *.css.ts file
  formAssociated: true,       // Optional: Enable form association
  bProgram({ $, trigger, ... }) {  // Optional: Behavioral program
    return {
      // Event handlers
      // Lifecycle callbacks
    }
  }
})
```

### Core Properties


// ✅ Valid
tag: 'my-element'
tag: 'todo-list'
tag: 'x-button'

// ❌ Invalid
tag: 'myElement'  // No hyphen
tag: 'button'     // No hyphen
```

#### `shadowDom` (Required)

Template for Shadow DOM content:

```typescript
shadowDom: (
  <>
    <slot></slot>
    <button p-target="btn" p-trigger={{ click: 'handleClick' }}>Click</button>
  </>
)
```

**Key attributes**:
- `p-target`: Enables `$()` selector (e.g., `$('btn')[0]`)
- `p-trigger`: Declarative event binding (e.g., `{ click: 'handleClick' }`)

#### `hostStyles` (Optional)

Styles for the `:host` element (the custom element itself):

**File: `my-element.css.ts`**
```typescript
import { createHostStyles } from 'plaited'

export const hostStyles = createHostStyles({
  display: 'block',
  padding: '1rem',
  backgroundColor: {
    $default: 'white',
    $compoundSelectors: {
      ':state(active)': 'blue',
      '[disabled]': 'gray'
    }
  }
})
```

**File: `my-element.tsx`**
```typescript
import { bElement } from 'plaited'
import { hostStyles } from './my-element.css.ts'

const MyElement = bElement({
  tag: 'my-element',
  hostStyles,
  shadowDom: <slot></slot>
})
```

**See `styling.md` for complete createHostStyles documentation.**

#### `observedAttributes` (Optional)

Attributes to watch for changes:

```typescript
const MyElement = bElement({
  tag: 'my-element',
  observedAttributes: ['disabled', 'value', 'open'],
  shadowDom: <slot></slot>,
  bProgram({ trigger }) {
    return {
      onAttributeChanged({ name, newValue, oldValue }) {
        console.log(`${name} changed from ${oldValue} to ${newValue}`)
        trigger({ type: name, detail: newValue })
      }
    }
  }
})
```

#### `publicEvents` (Optional)

Events for cross-island communication (via `useSignal`):

```typescript
const MyElement = bElement({
  tag: 'my-element',
  publicEvents: ['save', 'cancel'],  // Only these can be triggered externally
  shadowDom: <button p-trigger={{ click: 'internalClick' }}>Click</button>,
  bProgram({ trigger }) {
    return {
      internalClick() {
        // Internal event - not in publicEvents
        trigger({ type: 'process' })
      },
      process() {
        // Can trigger public event
        trigger({ type: 'save', detail: { data: '...' } })
      }
    }
  }
})
```

**See `cross-island-communication.md` for coordination patterns.**

#### `formAssociated` (Optional)

Enables form integration via ElementInternals API:

```typescript
const MyInput = bElement<{
  inputChange: InputEvent & { target: HTMLInputElement }
}>({
  tag: 'my-input',
  formAssociated: true,  // Enables internals.setFormValue()
  shadowDom: <input p-target="input" p-trigger={{ input: 'inputChange' }} />,
  bProgram({ internals }) {
    return {
      inputChange(e) {
        internals.setFormValue(e.target.value)
      }
    }
  }
})
```

**See `form-associated-elements.md` for complete form patterns.**

## Helper Functions Reference

The `bProgram` function receives args with helper functions and utilities:

### `$()` - Element Selector

Query elements by `p-target` attribute:

```typescript
bProgram({ $ }) {
  // Query elements at setup if they're in shadowDom template
  const button = $<HTMLButtonElement>('myButton')[0]
  const items = $<HTMLLIElement>('item')

  // With attribute selector match
  const partial = $('name', '^=')  // Matches p-target starts with "name"

  return {
    updateItems() {
      // DOM manipulations happen in handlers
      items.forEach(item => item.render('Updated'))
    }
  }
}
```

**Match options**:
- `'='` (default): Exact match
- `'^='`: Starts with
- `'$='`: Ends with
- `'*='`: Contains

### Element Helper Methods

All elements returned by `$()` have these methods:

#### `.render(content)` - Replace Content

Replace element's content:

```typescript
bProgram({ $ }) {
  const header = $('header')[0]

  return {
    updateHeader(content: string) {
      // String
      header?.render(content)
    },

    updateCount(count: number) {
      // Number
      header?.render(count)
    },

    updateBold() {
      // Template
      header?.render(<strong>Bold text</strong>)
    },

    updateMixed() {
      // Multiple fragments
      header?.render('Text ', <em>italic</em>, ' more text')
    }
  }
}
```

#### `.insert(position, content)` - Insert Content

Insert content at specific position:

```typescript
bProgram({ $ }) {
  const list = $('list')[0]

  return {
    addItem(text: string) {
      // Positions: 'beforebegin' | 'afterbegin' | 'beforeend' | 'afterend'
      list?.insert('beforeend', <li>{text}</li>)
    },

    prependItem(text: string) {
      list?.insert('afterbegin', <li>{text}</li>)
    }
  }
}
```

#### `.attr(name, value)` - Set/Remove Attribute

Update or remove attributes:

```typescript
bProgram({ $ }) {
  const button = $<HTMLButtonElement>('btn')[0]

  return {
    disableButton() {
      button?.attr('disabled', true)
    },

    updateCount(count: number) {
      button?.attr('data-count', count)
    },

    setLabel(label: string) {
      button?.attr('aria-label', label)
    },

    enableButton() {
      // Remove attribute (pass null)
      button?.attr('disabled', null)
    }
  }
}
```

**Boolean attributes** (disabled, checked, etc.) are handled correctly:
```typescript
button?.attr('disabled', true)   // Adds attribute
button?.attr('disabled', null)   // Removes attribute
```

#### `.replace(template)` - Replace Element

Replace element with new template:

```typescript
bProgram({ $ }) {
  return {
    updateCard(title: string, content: string) {
      const card = $('card')[0]

      card?.replace(
        <div p-target="card">
          <h2>{title}</h2>
          <p>{content}</p>
        </div>
      )
    }
  }
}
```

### `trigger()` - Parent-to-Child Communication

Send events into the behavioral program:

```typescript
bProgram({ trigger, $, bThreads, bSync, bThread }) {
  const button = $('button')[0]

  // Trigger from lifecycle callback
  return {
    onConnected() {
      trigger({ type: 'initialize' })
    },

    externalEvent() {
      // Trigger from handler
      trigger({ type: 'process', detail: { data: 'value' } })
    }
  }
}
```

**Note**: `trigger()` is for **internal** communication within the element. For child→parent communication, use `emit()`.

### `emit()` - Child-to-Parent Communication

Broadcast events up to parent:

```typescript
bProgram({ emit }) {
  return {
    save() {
      // Emit to parent with bubbling
      emit({
        type: 'saveComplete',
        detail: { success: true },
        bubbles: true,
        composed: true  // Crosses shadow boundaries
      })
    }
  }
}
```

**Parent listens via `p-trigger`**:
```typescript
// Parent element
<MyChild p-trigger={{ saveComplete: 'handleSave' }} />
```

**See `cross-island-communication.md` for complete communication patterns.**

## useTemplate() for Dynamic Content

`useTemplate()` creates a factory function for efficiently cloning and populating template instances:

```typescript
import { bElement, type FT, useTemplate } from 'plaited'

const RowTemplate: FT<{ name: string; value: string }> = ({ name, value }) => (
  <tr>
    <td p-target="name">{name}</td>
    <td p-target="value">{value}</td>
  </tr>
)

const DataTable = bElement({
  tag: 'data-table',
  shadowDom: (
    <>
      <table>
        <tbody p-target="tbody"></tbody>
      </table>
      <template p-target="row">
        <RowTemplate name="" value="" />
      </template>
    </>
  ),
  bProgram({ $ }) {
    const tbody = $<HTMLElement>('tbody')[0]
    const rowTemplate = $<HTMLTemplateElement>('row')[0]!

    // Create template factory
    const createRow = useTemplate(rowTemplate, ($, data) => {
      const name = $('name')[0]
      const value = $('value')[0]
      name?.render(data.name)
      value?.render(data.value)
    })

    return {
      onConnected() {
        // Efficiently create multiple rows
        const rows = [
          { name: 'Alice', value: '100' },
          { name: 'Bob', value: '200' },
        ]

        // Single DOM operation - more efficient than forEach
        tbody?.insert('beforeend', ...rows.map(createRow))
      }
    }
  }
})
```

**Key benefits**:
- Template cloning is faster than creating from scratch
- Type-safe data binding via generics
- Scoped `$` function for querying within clone
- Helper methods work on cloned elements

**When to use**:
- Dynamic lists
- Repeating content patterns
- Data-driven UI
- Performance-critical rendering

**See `styling.md` for complete useTemplate() documentation.**

## useAttributesObserver() (Rare)

`useAttributesObserver()` observes attribute changes on **slotted elements**.

**IMPORTANT**: This is rarely needed. Most attribute handling is done through `observedAttributes` and `onAttributeChanged`.

### When to Use

Use ONLY when:
1. Observing **slotted** elements (from light DOM)
2. Attribute changes come from outside your control
3. Need to react to changes on native elements

**Example: Decorator Pattern**
```typescript
import { useAttributesObserver } from 'plaited'

const DecorateCheckbox = bElement({
  tag: 'decorate-checkbox',
  shadowDom: (
    <slot p-target="slot" p-trigger={{ slotchange: 'slotchange' }}></slot>
  ),
  bProgram({ $, internals, trigger }) {
    let slot = $<HTMLSlotElement>('slot')[0]
    let input = slot?.assignedElements()[0]
    let inputObserver = useAttributesObserver('change', trigger)

    return {
      slotchange() {
        // Re-query after slot content changes
        slot = $<HTMLSlotElement>('slot')[0]
        input = slot?.assignedElements()[0]
        inputObserver = useAttributesObserver('change', trigger)
      },

      change({ name, newValue }) {
        // Sync slotted input attributes with custom states
        newValue ? internals.states.add(name) : internals.states.delete(name)
      },

      onConnected() {
        // Initialize states from slotted input
        input?.hasAttribute('checked') && internals.states.add('checked')
        input?.hasAttribute('disabled') && internals.states.add('disabled')

        // Start observing slotted input attributes
        input && inputObserver(input, ['checked', 'disabled'])
      }
    }
  }
})

// Usage: wraps native checkbox
<DecorateCheckbox>
  <input type="checkbox" checked disabled />
</DecorateCheckbox>
```

### When NOT to Use

❌ **Don't use for own element's attributes**:
```typescript
// ❌ Wrong: Use observedAttributes instead
const MyElement = bElement({
  tag: 'my-element',
  bProgram({ trigger }) {
    const observer = useAttributesObserver('attrChange', trigger)
    observer(/* ... */)  // DON'T DO THIS
  }
})

// ✅ Correct: Use observedAttributes
const MyElement = bElement({
  tag: 'my-element',
  observedAttributes: ['disabled', 'value'],
  bProgram({ trigger }) {
    return {
      onAttributeChanged({ name, newValue }) {
        trigger({ type: name, detail: newValue })
      }
    }
  }
})
```

❌ **Don't use for shadow DOM elements**:
```typescript
// ❌ Wrong: Shadow DOM elements are under your control
const MyElement = bElement({
  shadowDom: <button p-target="btn">Click</button>,
  bProgram({ $, trigger }) {
    const button = $('btn')[0]
    const observer = useAttributesObserver('change', trigger)
    observer(button, ['disabled'])  // DON'T DO THIS - use .attr() instead
  }
})

// ✅ Correct: Use helper methods
const MyElement = bElement({
  shadowDom: <button p-target="btn">Click</button>,
  bProgram({ $ }) {
    const button = $('btn')[0]
    button?.attr('disabled', true)  // Direct control
  }
})
```

## Lifecycle Callbacks

Lifecycle callbacks are returned from `bProgram` alongside event handlers.

**IMPORTANT - Execution Order:**
1. **`bProgram` function** runs synchronously during `connectedCallback`
2. **`onConnected` callback** triggers AFTER `bProgram` completes
3. **`onDisconnected` callback** triggers AFTER automatic cleanup

**IMPORTANT - Automatic Cleanup:**
- Plaited helpers (`useSignal`, `useWorker`, `useAttributesObserver`) auto-cleanup via `trigger.addDisconnectCallback`
- These are automatically cleaned up BEFORE `onDisconnected` is called
- **Use `onDisconnected` ONLY for manual cleanup of external resources**

```typescript
bProgram({ $, trigger, internals }) {
  return {
    // Event handlers
    handleClick() { /* ... */ },

    // Lifecycle callbacks
    onConnected() {
      // Triggered AFTER bProgram setup
      // Use for async initialization
    },

    onDisconnected() {
      // Triggered AFTER auto-cleanup
      // Use ONLY for external resource cleanup
    },

    onAttributeChanged({ name, newValue, oldValue }) {
      // Observed attribute changed
    },

    onAdopted() {
      // Element moved to new document
    },

    // Form-associated callbacks (if formAssociated: true)
    onFormAssociated(form) {
      // Associated with form
    },

    onFormDisabled(disabled) {
      // Form disabled state changed
    },

    onFormReset() {
      // Form reset
    },

    onFormStateRestore({ state, reason }) {
      // Form state restored
    }
  }
}
```

### `onConnected()`

Triggered **after** `bProgram` setup completes. Use for async initialization.

```typescript
bProgram({ trigger }) {
  return {
    async onConnected() {
      // Async work that doesn't block setup
      // Events can be coordinated by bThreads set up in bProgram
      const data = await fetch('/api/user')
      trigger({ type: 'dataLoaded', detail: await data.json() })
    }
  }
}
```

### `onDisconnected()`

Triggered **after** automatic cleanup of Plaited helpers. Use **ONLY** for manual cleanup of external resources.

**What auto-cleans** (no manual cleanup needed):
- `useSignal()`, `useComputed()`, `useWorker()`, `useAttributesObserver()` - auto-disconnect
- `p-trigger` event bindings - auto-cleanup
- Internal observers for `p-target` attribute changes - auto-disconnect
- Any resource registered via `trigger.addDisconnectCallback()`

**IMPORTANT - Use `p-trigger` for DOM events:**
```typescript
// ❌ Don't use manual addEventListener - requires cleanup
window.addEventListener('resize', handleResize)

// ✅ Use p-trigger - auto-cleanup
shadowDom: <div p-trigger={{ resize: 'handleResize' }}></div>
```

**What needs manual cleanup:**
```typescript
bProgram({ trigger, host }) {
  let intervalId: number
  let intersectionObserver: IntersectionObserver

  return {
    onConnected() {
      // Timers - need manual cleanup
      intervalId = setInterval(() => trigger({ type: 'tick' }), 1000)

      // Observers not covered by Plaited - need manual cleanup
      intersectionObserver = new IntersectionObserver((entries) => {
        trigger({ type: 'visibility', detail: entries[0]?.isIntersecting })
      })
      intersectionObserver.observe(host)
    },

    onDisconnected() {
      // ✅ Manual cleanup required
      clearInterval(intervalId)
      intersectionObserver?.disconnect()
    }
  }
}
```

**Rule of thumb:**
- **DOM events** → Use `p-trigger` (auto-cleanup)
- **Timers/Intervals** → Manual cleanup in `onDisconnected`
- **IntersectionObserver/ResizeObserver** → Manual cleanup in `onDisconnected`
- **External connections** (WebSocket, MediaStream) → Manual cleanup in `onDisconnected`

### `onAttributeChanged({ name, newValue, oldValue })`

Called when an observed attribute changes:

```typescript
const MyElement = bElement({
  tag: 'my-element',
  observedAttributes: ['disabled', 'value', 'open'],
  bProgram({ trigger, internals }) {
    return {
      onAttributeChanged({ name, newValue, oldValue }) {
        console.log(`${name}: ${oldValue} → ${newValue}`)

        // Trigger event for behavioral program
        trigger({ type: name, detail: newValue })

        // Update custom states
        if (name === 'disabled') {
          newValue ? internals.states.add('disabled') : internals.states.delete('disabled')
        }
      }
    }
  }
})
```

### `onAdopted()`

Called when element moved to new document (rare):

```typescript
return {
  onAdopted() {
    // Re-initialize if document-specific state exists
    console.log('Moved to new document')
  }
}
```



```typescript
type BProgramArgs = {
  // Element querying
  $: <E extends Element>(target: string, match?: SelectorMatch) => BoundElement<E>[]

  // Event system
  trigger: PlaitedTrigger       // Send events into program
  emit: Emit                    // Send events to parent

  // Behavioral programming
  bThreads: BThreads            // Manage threads
  bThread: typeof bThread       // Create threads
  bSync: typeof bSync           // Create sync points

  // Element references
  root: { host: HTMLElement; shadowRoot: ShadowRoot }
  internals: ElementInternals   // Form & state APIs

  // Debugging
  inspector: Inspector          // Observe BP state
}
```

### Accessing bProgram Args

```typescript
bProgram({
  $,           // Element selector
  trigger,     // Send events
  emit,        // Broadcast to parent
  bThreads,    // Thread manager
  bThread,     // Thread factory
  bSync,       // Sync factory
  root,        // Element references
  internals,   // ElementInternals
  inspector    // BP debugger
}) {
  // Use args to implement handlers
  const button = $('btn')[0]

  bThreads.set({
    myThread: bThread([
      bSync({ request: { type: 'event1' } }),
      bSync({ waitFor: 'event2' })
    ])
  })

  return {
    handleClick() {
      trigger({ type: 'clicked' })
    }
  }
}
```

### Returning Handlers

Return an object mapping event types to handler functions:

```typescript
bProgram({ trigger, $, bThreads, bSync, bThread }) {
  bThreads.set({
    validation: bThread([
      bSync({ block: ({ type }) => type === 'submit' && !isValid() })
    ], true)
  })

  return {
    // Event handlers (match p-trigger event types)
    click() {
      trigger({ type: 'submit' })
    },

    submit() {
      console.log('Form submitted')
    },

    // Lifecycle callbacks
    onConnected() {
      console.log('Connected')
    },

    onDisconnected() {
      console.log('Disconnected')
    }
  }
}
```

**Handler types**:
- Event handlers: Match types from `p-trigger`, `trigger()`, and thread requests
- Lifecycle callbacks: `onConnected`, `onDisconnected`, `onAttributeChanged`, etc.


```typescript
bProgram({ bThreads, bThread, bSync }) {
  return {
    enableAdvancedMode() {
      // Add new threads dynamically
      bThreads.set({
        advancedValidation: bThread([
          bSync({ block: ({ type }) => type === 'submit' && !complexValidation() })
        ], true)
      })
    },

    disableAdvancedMode() {
      // Remove threads by replacing with empty
      bThreads.set({
        advancedValidation: bThread([])
      })
    },

    onConnected() {
      // Check if thread exists
      if (bThreads.has('advancedValidation') === 'pending') {
        console.log('Advanced validation is active')
      }
    }
  }
}
```

**See `behavioral-programs.md` for complete thread lifecycle documentation.**

## Complete Example: Todo List Island

**File: `todo-list.css.ts`**
```typescript
import { createStyles, createHostStyles } from 'plaited'

export const styles = createStyles({
  input: {
    padding: '8px',
    border: '1px solid #ccc'
  },
  button: {
    padding: '8px 16px',
    backgroundColor: 'blue',
    color: 'white',
    border: 'none'
  },
  list: {
    listStyle: 'none',
    padding: 0
  },
  item: {
    padding: '8px',
    borderBottom: '1px solid #eee'
  }
})

export const hostStyles = createHostStyles({
  display: 'block',
  padding: '1rem'
})
```

**File: `todo-list.tsx`**
```typescript
import { bElement } from 'plaited'
import { styles, hostStyles } from './todo-list.css.ts'

const TodoList = bElement<{
  inputChange: InputEvent & { target: HTMLInputElement }
}>({
  tag: 'todo-list',
  hostStyles,
  shadowDom: (
    <>
      <input
        type="text"
        p-target="input"
        p-trigger={{ input: 'inputChange' }}
        {...styles.input}
      />
      <button
        p-target="add"
        p-trigger={{ click: 'add' }}
        {...styles.button}
      >
        Add Todo
      </button>
      <ul p-target="list" {...styles.list}></ul>
    </>
  ),
  bProgram({ $, trigger, bThreads, bThread, bSync }) {
    let currentInput = ''
    let todoCount = 0

    // Query elements at setup - they're in shadowDom template
    const button = $('add')[0]
    const list = $('list')[0]
    const input = $<HTMLInputElement>('input')[0]

    // Behavioral thread: prevent adding empty todos
    bThreads.set({
      preventEmptyAdd: bThread([
        bSync({
          block: ({ type }) => type === 'add' && !currentInput.trim()
        })
      ], true)
    })

    return {
      inputChange(e) {
        currentInput = e.target.value
        // Enable/disable button based on input
        button?.attr('disabled', !currentInput.trim())
      },

      add() {
        todoCount++
        list?.insert(
          'beforeend',
          <li {...styles.item}>
            {todoCount}. {currentInput}
          </li>
        )

        // Clear input
        currentInput = ''
        input?.attr('value', '')

        // Trigger button update
        trigger({ type: 'inputChange', detail: new InputEvent('input', { target: input }) })
      },

      onConnected() {
        // Initialize button state
        button?.attr('disabled', true)
      }
    }
  }
})

// Usage
<TodoList />
```

## Summary: bElement Patterns

**Use bElement when you need**:
- Interactive islands with BP coordination
- Decorating native elements for custom styling
- Complex stateful behavior (popovers, dialogs)
- Form-associated custom controls
- Non-existent native element functionality

**Key capabilities**:
- Shadow DOM encapsulation
- Behavioral programming integration
- Declarative event handling with `p-trigger`
- Element helpers (`$`, `.render()`, `.insert()`, `.attr()`)
- Lifecycle management
- Form integration via ElementInternals

**Next steps**:
- See `behavioral-programs.md` for BP foundations
- See `cross-island-communication.md` for coordination patterns
- See `form-associated-elements.md` for form integration
- See `styling.md` for CSS-in-JS and templates
