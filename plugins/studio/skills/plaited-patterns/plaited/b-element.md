# bElement: Custom Elements API

`bElement` creates Web Components with Shadow DOM, behavioral programming, and declarative event handling. It's the fundamental building block for interactive islands in Plaited applications.

**For foundational BP concepts**, see `behavioral-programs.md`
**For cross-island coordination**, see `cross-island-communication.md`
**For form integration**, see `form-associated-elements.md`

## When to Use bElement

Use `bElement` when you need any of these capabilities:

### 1. Islands Architecture

Interactive regions with behavioral programs coordinating complex state:

```typescript
const TodoList = bElement({
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
        currentInput = (e.target as HTMLInputElement).value
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

### 2. Decorator Pattern

Wrapping hard-to-style native elements (inputs, checkboxes, selects):

```typescript
import { createHostStyles, createStyles } from 'plaited'

const styles = createStyles({
  symbol: {
    height: '16px',
    width: '16px',
    backgroundColor: 'var(--fill)'
  },
  input: {
    opacity: 0,
    position: 'absolute'
  }
})

const hostStyles = createHostStyles({
  display: 'inline-grid',
  '--fill': {
    $default: 'lightblue',
    $compoundSelectors: {
      ':state(checked)': 'blue',
      ':state(disabled)': 'gray'
    }
  }
})

const DecorateCheckbox = bElement({
  tag: 'decorate-checkbox',
  hostStyles,
  shadowDom: (
    <>
      <div p-target="symbol" {...styles.symbol} p-trigger={{ click: 'click' }} />
      <slot p-target="slot" p-trigger={{ slotchange: 'slotchange' }}></slot>
    </>
  ),
  bProgram({ $, internals, trigger }) {
    const slot = $<HTMLSlotElement>('slot')[0]
    let input = slot?.assignedElements()[0]
    const inputObserver = useAttributesObserver('change', trigger)

    return {
      slotchange() {
        input = slot?.assignedElements()[0]
      },
      change({ name, newValue }) {
        newValue ? internals.states.add(name) : internals.states.delete(name)
      },
      onConnected() {
        input?.hasAttribute('checked') && internals.states.add('checked')
        input?.hasAttribute('disabled') && internals.states.add('disabled')
        input && inputObserver(input, ['checked', 'disabled'])
      }
    }
  }
})

// Usage: wraps native checkbox
<DecorateCheckbox>
  <input type="checkbox" checked />
</DecorateCheckbox>
```

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

Custom form controls using ElementInternals:

```typescript
const ToggleInput = bElement({
  tag: 'toggle-input',
  formAssociated: true,
  observedAttributes: ['checked', 'disabled'],
  shadowDom: <div p-target="symbol" p-trigger={{ click: 'click' }} />,
  bProgram({ trigger, internals, root }) {
    return {
      click() {
        trigger({ type: 'checked', detail: !internals.states.has('checked') })
      },
      checked(val) {
        root.host.toggleAttribute('checked', val)
        if (val) {
          internals.states.add('checked')
          internals.setFormValue('on', 'checked')
        } else {
          internals.states.delete('checked')
          internals.setFormValue('off')
        }
      }
    }
  }
})
```

**See `form-associated-elements.md` for complete form integration patterns.**

### 5. Non-Existent Native Elements

Elements that don't exist in HTML but should:

```typescript
const RatingInput = bElement({
  tag: 'rating-input',
  formAssociated: true,
  shadowDom: (
    <div p-target="stars">
      <button p-target="star" data-value="1" p-trigger={{ click: 'rate' }}>★</button>
      <button p-target="star" data-value="2" p-trigger={{ click: 'rate' }}>★</button>
      <button p-target="star" data-value="3" p-trigger={{ click: 'rate' }}>★</button>
      <button p-target="star" data-value="4" p-trigger={{ click: 'rate' }}>★</button>
      <button p-target="star" data-value="5" p-trigger={{ click: 'rate' }}>★</button>
    </div>
  ),
  bProgram({ internals }) {
    return {
      rate(e) {
        const value = (e.target as HTMLElement).dataset.value
        internals.setFormValue(value ?? '0')
      }
    }
  }
})
```

## bElement API Overview

```typescript
import { bElement } from 'plaited'

const MyElement = bElement<{
  eventType1: DetailType1
  eventType2: DetailType2
}>({
  tag: 'my-element',               // Required: Custom element tag (must have hyphen)
  shadowDom: <slot></slot>,        // Required: Shadow DOM template
  mode: 'open',                    // Optional: Shadow mode (default: 'open')
  delegatesFocus: true,            // Optional: Focus delegation (default: true)
  slotAssignment: 'named',         // Optional: Slot assignment (default: 'named')
  observedAttributes: [],          // Optional: Attributes to watch
  publicEvents: [],                // Optional: Events for cross-island communication
  hostStyles: createHostStyles({}), // Optional: Host element styles
  formAssociated: true,            // Optional: Enable form association
  bProgram({ $, trigger, ... }) {  // Optional: Behavioral program
    return {
      // Event handlers
      // Lifecycle callbacks
    }
  }
})
```

### Core Properties

#### `tag` (Required)

Custom element tag name. **Must contain a hyphen** per Web Components spec:

```typescript
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

```typescript
import { createHostStyles } from 'plaited'

const MyElement = bElement({
  tag: 'my-element',
  hostStyles: createHostStyles({
    display: 'block',
    padding: '1rem',
    backgroundColor: {
      $default: 'white',
      $compoundSelectors: {
        ':state(active)': 'blue',
        '[disabled]': 'gray'
      }
    }
  }),
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
const MyInput = bElement({
  tag: 'my-input',
  formAssociated: true,  // Enables internals.setFormValue()
  shadowDom: <input p-target="input" p-trigger={{ input: 'inputChange' }} />,
  bProgram({ internals }) {
    return {
      inputChange(e) {
        const value = (e.target as HTMLInputElement).value
        internals.setFormValue(value)
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
  // Single element
  const button = $<HTMLButtonElement>('myButton')[0]

  // Multiple elements
  const items = $<HTMLLIElement>('item')
  items.forEach(item => item.render('Updated'))

  // With attribute selector match
  const partial = $('name', '^=')  // Matches p-target starts with "name"
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
const header = $('header')[0]

// String
header?.render('New text')

// Number
header?.render(42)

// Template
header?.render(<strong>Bold text</strong>)

// Multiple fragments
header?.render('Text ', <em>italic</em>, ' more text')
```

#### `.insert(position, content)` - Insert Content

Insert content at specific position:

```typescript
const list = $('list')[0]

// Positions: 'beforebegin' | 'afterbegin' | 'beforeend' | 'afterend'
list?.insert('beforeend', <li>New item</li>)
list?.insert('afterbegin', 'First item')
```

#### `.attr(name, value)` - Set/Remove Attribute

Update or remove attributes:

```typescript
const button = $<HTMLButtonElement>('btn')[0]

// Set attribute
button?.attr('disabled', true)
button?.attr('data-count', 5)
button?.attr('aria-label', 'Submit form')

// Remove attribute (pass null)
button?.attr('disabled', null)
```

**Boolean attributes** (disabled, checked, etc.) are handled correctly:
```typescript
// Boolean attributes use presence
button?.attr('disabled', true)   // Adds attribute
button?.attr('disabled', null)   // Removes attribute
```

#### `.replace(template)` - Replace Element

Replace element with new template:

```typescript
const card = $('card')[0]

card?.replace(
  <div p-target="card">
    <h2>Updated Card</h2>
    <p>New content</p>
  </div>
)
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

        rows.forEach(data => {
          tbody?.insert('beforeend', createRow(data))
        })
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
        // React to attribute changes on slotted input
        newValue ? internals.states.add(name) : internals.states.delete(name)
      },

      onConnected() {
        input?.hasAttribute('checked') && internals.states.add('checked')
        input?.hasAttribute('disabled') && internals.states.add('disabled')

        // Start observing slotted input's attributes
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

Lifecycle callbacks are returned from `bProgram` alongside event handlers:

```typescript
bProgram({ $, trigger, internals }) {
  return {
    // Event handlers
    handleClick() { /* ... */ },

    // Lifecycle callbacks
    onConnected() {
      // Element inserted into DOM
      // Initialize state, start observers
    },

    onDisconnected() {
      // Element removed from DOM
      // Cleanup resources, stop observers
    },

    onAttributeChanged({ name, newValue, oldValue }) {
      // Observed attribute changed
      // Trigger events, update state
    },

    onAdopted() {
      // Element moved to new document
      // Re-initialize if needed
    },

    // Form-associated callbacks (if formAssociated: true)
    formAssociatedCallback({ form }) {
      // Associated with form
    },

    formDisabledCallback({ disabled }) {
      // Form disabled state changed
    },

    formResetCallback() {
      // Form reset
    },

    formStateRestoreCallback({ state, mode }) {
      // Form state restored (browser autocomplete)
    }
  }
}
```

### `onConnected()`

Called when element is inserted into DOM:

```typescript
return {
  onConnected() {
    // Initialize state
    if (root.host.hasAttribute('checked')) {
      internals.states.add('checked')
    }

    // Start observers
    const observer = new MutationObserver(/* ... */)
    observer.observe(root, { childList: true })

    // Trigger initialization events
    trigger({ type: 'initialize' })

    // Set up external listeners (remember to clean up in onDisconnected)
  }
}
```

### `onDisconnected()`

Called when element is removed from DOM:

```typescript
return {
  onDisconnected() {
    // Clean up observers
    observer?.disconnect()

    // Clean up timers
    clearInterval(intervalId)

    // Clean up external listeners
    window.removeEventListener('resize', handler)

    // PlaitedTrigger callbacks are auto-cleaned, but manual cleanup available
  }
}
```

**IMPORTANT**: Always clean up resources to prevent memory leaks.

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

## bProgram Integration

The `bProgram` function is where behavioral programming meets Web Components.

### BProgramArgs Structure

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
- Form callbacks: `formAssociatedCallback`, `formResetCallback`, etc. (if `formAssociated: true`)

### Thread Management Within Components

Threads can be added/removed at runtime:

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

```typescript
import { bElement, createHostStyles, createStyles } from 'plaited'

const styles = createStyles({
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

const hostStyles = createHostStyles({
  display: 'block',
  padding: '1rem'
})

const TodoList = bElement({
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
        currentInput = (e.target as HTMLInputElement).value

        // Enable/disable button based on input
        const button = $('add')[0]
        button?.attr('disabled', !currentInput.trim())
      },

      add() {
        todoCount++
        const list = $('list')[0]

        list?.insert(
          'beforeend',
          <li {...styles.item}>
            {todoCount}. {currentInput}
          </li>
        )

        // Clear input
        currentInput = ''
        const input = $<HTMLInputElement>('input')[0]
        input?.attr('value', '')

        // Trigger button update
        trigger({ type: 'inputChange', detail: { value: '' } })
      },

      onConnected() {
        // Initialize button state
        const button = $('add')[0]
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
