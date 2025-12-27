# Stories: Testing Patterns for Plaited

Plaited uses a story-based testing system for browser-based template validation. Stories test both visual templates (FunctionalTemplate) and interactive templates (bElement) using Playwright integration.

## Story Format & Structure

Stories are created using the `story()` function from `plaited/testing`:

```typescript
import { type FT } from 'plaited'
import { story } from 'plaited/testing'

const Button: FT<{ variant?: string }> = ({ variant, children }) => (
  <button data-variant={variant}>{children}</button>
)

export const primaryButton = story({
  template: Button,
  args: { variant: 'primary', children: 'Click Me' },
  description: 'Primary button with variant styling',
})
```

### Core Story Properties

#### `description` (Required)

Clear description of what the story demonstrates or tests:

```typescript
export const basicCard = story({
  description: 'Card template with title and content',
  template: Card,
  args: { title: 'Welcome' }
})
```

**Best Practices**:
- Match the template's intent
- Be specific about variant or state
- Describe expected behavior for interaction tests

#### `template` (Optional)

The FunctionTemplate to render. If omitted, provide JSX directly:

```typescript
// With template reference
export const withTemplate = story({
  description: 'Button with template',
  template: Button,
  args: { children: 'Click' }
})

// Without template (inline JSX)
export const withoutTemplate = story({
  description: 'Inline button',
  template: () => <button>Click</button>
})
```

#### `args` (Optional)

Props to pass to the template:

```typescript
const Card: FT<{ title: string; subtitle?: string }> = ({ title, subtitle }) => (
  <div>
    <h2>{title}</h2>
    {subtitle && <p>{subtitle}</p>}
  </div>
)

export const cardWithSubtitle = story({
  description: 'Card with optional subtitle',
  template: Card,
  args: {
    title: 'Main Title',
    subtitle: 'Optional subtitle text'
  }
})
```

#### `play` (Optional)

Function for interaction testing. When provided, the story becomes an interaction test:

```typescript
export const clickableButton = story({
  description: 'Button click increments counter',
  template: CounterButton,
  play: async ({ findByTestId, fireEvent, assert }) => {
    const button = await findByTestId('counter-btn')
    const display = await findByTestId('count-display')

    assert({
      given: 'initial render',
      should: 'show count of 0',
      actual: display?.textContent,
      expected: '0'
    })

    button && await fireEvent(button, 'click')

    assert({
      given: 'button click',
      should: 'increment count to 1',
      actual: display?.textContent,
      expected: '1'
    })
  }
})
```

#### `parameters` (Optional)

Test configuration for headers, styles, and timeout:

```typescript
export const customTimeout = story({
  description: 'Story with custom timeout',
  template: SlowComponent,
  parameters: {
    timeout: 10000, // 10 seconds (default is 5000)
    styles: createHostStyles({ /* test-specific styles */ }),
    headers: (env) => new Headers({ 'X-Custom': env.API_KEY })
  },
  play: async ({ wait }) => {
    await wait(8000) // Needs longer timeout
  }
})
```

### Story Modifiers

Use `.only()` and `.skip()` to control test execution:

```typescript
// Run ONLY this story (skip all others)
export const focusedTest = story.only({
  description: 'Focused test - only this runs',
  template: MyComponent
})

// Skip this story
export const skippedTest = story.skip({
  description: 'Skipped test - will not run',
  template: BrokenComponent
})
```

## Workshop CLI Usage

The Plaited workshop CLI provides commands for running stories and development.

### Running Tests

```bash
# Run all stories in current directory
bun plaited test

# Run stories from specific directory
bun plaited test src/components

# Run stories from specific file
bun plaited test src/Button.stories.tsx

# Run with custom port
bun plaited test -p 3500

# Run with custom working directory
bun plaited test -d ./my-project

# Run with dark mode
bun plaited test --color-scheme dark
```

### Development Mode

```bash
# Start dev server with hot reload
bun plaited dev

# Dev mode with custom port
bun plaited dev -p 4000

# Dev mode with Bun's hot reload
bun --hot plaited dev
```

**Dev Mode Features**:
- Automatic hot reload on file changes (with `bun --hot`)
- Live preview of stories
- Inspector enabled by default
- Manual testing and debugging

### CLI Options

| Option | Short | Description | Default |
|--------|-------|-------------|---------|
| `--port` | `-p` | Server port | `0` (auto-assign) |
| `--dir` | `-d` | Working directory | `process.cwd()` |
| `--color-scheme` | `-c` | Browser color scheme (`light` or `dark`) | `light` |

## FunctionalTemplate Stories

FunctionalTemplate stories demonstrate DOM structure and styling patterns. These teach agents how to apply styles to specific structures.

### Pattern: Simple Button

```typescript
// File: button.css.ts
import { createStyles } from 'plaited'

export const buttonStyles = createStyles({
  btn: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    backgroundColor: {
      $default: 'blue',
      ':hover': 'darkblue',
      '[disabled]': 'gray',
    },
    color: 'white'
  }
})

// File: button.stories.tsx
import { type FT } from 'plaited'
import { story } from 'plaited/testing'
import { buttonStyles } from './button.css.ts'

const Button: FT<{ variant?: string }> = ({ variant, children, ...attrs }) => (
  <button {...attrs} {...buttonStyles.btn} data-variant={variant}>
    {children}
  </button>
)

export const primaryButton = story({
  description: 'Primary button with blue background',
  template: Button,
  args: { variant: 'primary', children: 'Click Me' }
})

export const disabledButton = story({
  description: 'Disabled button with gray background',
  template: () => <Button disabled>Disabled</Button>
})
```

### Pattern: Card Layout

```typescript
// File: card.css.ts
import { createStyles } from 'plaited'

export const cardStyles = createStyles({
  card: {
    padding: '20px',
    borderRadius: '8px',
    backgroundColor: 'white',
    boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  title: {
    fontSize: '1.5rem',
    fontWeight: 'bold',
    marginBottom: '10px'
  },
  content: {
    fontSize: '1rem',
    color: '#333'
  }
})

// File: card.stories.tsx
import { type FT } from 'plaited'
import { story } from 'plaited/testing'
import { cardStyles } from './card.css.ts'

const Card: FT<{ title: string }> = ({ title, children }) => (
  <div {...cardStyles.card}>
    <h2 {...cardStyles.title}>{title}</h2>
    <div {...cardStyles.content}>{children}</div>
  </div>
)

export const basicCard = story({
  description: 'Card with title and content',
  template: Card,
  args: {
    title: 'Welcome',
    children: 'This is card content'
  }
})
```

### Pattern: Responsive Grid

```typescript
// File: grid.css.ts
import { createStyles } from 'plaited'

export const gridStyles = createStyles({
  container: {
    display: 'grid',
    gridTemplateColumns: {
      $default: '1fr',
      '@media (min-width: 768px)': 'repeat(2, 1fr)',
      '@media (min-width: 1024px)': 'repeat(3, 1fr)',
    },
    gap: '20px',
    padding: '20px'
  }
})

// File: grid.stories.tsx
import { type FT } from 'plaited'
import { story } from 'plaited/testing'
import { gridStyles } from './grid.css.ts'

const Grid: FT = ({ children }) => (
  <div {...gridStyles.container}>{children}</div>
)

export const responsiveGrid = story({
  description: 'Responsive grid with 1/2/3 column breakpoints',
  template: () => (
    <Grid>
      <div>Item 1</div>
      <div>Item 2</div>
      <div>Item 3</div>
      <div>Item 4</div>
    </Grid>
  )
})
```

**Purpose**: These FT stories teach agents:
- How to structure DOM elements
- Where to apply specific styles
- Common layout patterns
- Responsive design techniques

## BehavioralElement Stories

BehavioralElement stories test interactive islands with behavioral programs.

**IMPORTANT**: Always define bElement in a separate file from the story. Stories import the element for testing.

### Pattern: Toggle Input

```typescript
// File: toggle-input.css.ts
import { createStyles, createHostStyles, createTokens } from 'plaited'

const fills = createTokens('fills', {
  default: { $value: 'lightblue' },
  checked: { $value: 'blue' },
  disabled: { $value: 'gray' },
})

export const styles = createStyles({
  symbol: {
    height: '16px',
    width: '16px',
    backgroundColor: fills.default,
  }
})

export const hostStyles = createHostStyles({
  display: 'inline-grid',
  backgroundColor: {
    $default: fills.default,
    $compoundSelectors: {
      ':state(checked)': fills.checked,
      ':state(disabled)': fills.disabled,
    }
  }
})

// File: toggle-input.ts
import { bElement } from 'plaited'
import { isTypeOf } from 'plaited/utils'
import { styles, hostStyles } from './toggle-input.css.ts'

export const ToggleInput = bElement<{
  click: MouseEvent
  checked: boolean
  disabled: boolean
}>({
  tag: 'toggle-input',
  observedAttributes: ['checked', 'disabled'],
  formAssociated: true,
  hostStyles,
  shadowDom: (
    <div
      p-target='symbol'
      {...styles.symbol}
      p-trigger={{ click: 'click' }}
    />
  ),
  bProgram({ trigger, internals, root, bThreads, bSync, bThread }) {
    bThreads.set({
      onDisabled: bThread(
        [
          bSync({
            block: [
              ({ type }) => type === 'checked' && internals.states.has('disabled')
            ]
          })
        ],
        true
      )
    })

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
      },
      disabled(val) {
        if (val) {
          internals.states.add('disabled')
        } else {
          internals.states.delete('disabled')
        }
      },
      onConnected() {
        if (root.host.hasAttribute('checked')) {
          internals.states.add('checked')
          internals.setFormValue('on', 'checked')
        }
        if (root.host.hasAttribute('disabled')) {
          internals.states.add('disabled')
        }
      }
    }
  }
})

// File: toggle-input.stories.tsx
import { story } from 'plaited/testing'
import { ToggleInput } from './toggle-input.ts'

export const uncheckedToggle = story({
  description: 'Toggle input in unchecked state',
  template: () => <ToggleInput />
})

export const checkedToggle = story({
  description: 'Toggle input in checked state',
  template: () => <ToggleInput checked />
})

export const toggleInteraction = story({
  description: 'Toggle input click changes state',
  template: () => <ToggleInput data-testid="toggle" />,
  play: async ({ findByTestId, fireEvent, assert }) => {
    const toggle = await findByTestId('toggle')
    const symbol = toggle?.shadowRoot?.querySelector('[p-target="symbol"]')

    assert({
      given: 'initial render',
      should: 'not have checked state',
      actual: toggle?.hasAttribute('checked'),
      expected: false
    })

    symbol && await fireEvent(symbol, 'click')

    assert({
      given: 'clicking symbol',
      should: 'add checked attribute',
      actual: toggle?.hasAttribute('checked'),
      expected: true
    })
  }
})
```

### Pattern: Cross-Island Communication

```typescript
// File: element-comms.stories.tsx
import { bElement, type FT, useSignal } from 'plaited'
import { story } from 'plaited/testing'

const sendAdd = useSignal<{ value: string }>()

const AddButton = bElement({
  tag: 'add-button',
  publicEvents: ['click'],
  shadowDom: (
    <button
      type='button'
      p-target='button'
      p-trigger={{ click: 'click' }}
    >
      Add Text
    </button>
  ),
  bProgram() {
    return {
      click() {
        sendAdd.set({ value: ' World!' })
      }
    }
  }
})

const TextDisplay = bElement({
  tag: 'text-display',
  publicEvents: ['add'],
  shadowDom: <h1 p-target='header'>Hello</h1>,
  bProgram({ $, trigger }) {
    sendAdd.listen('add', trigger)
    return {
      add(detail?: { value: string }) {
        if (!detail) return
        const { value } = detail
        const header = $('header')[0]
        header?.insert('beforeend', value)
      }
    }
  }
})

const CrossIslandDemo: FT = () => (
  <>
    <AddButton />
    <TextDisplay />
  </>
)

export const crossIslandCommunication = story({
  description: 'Button click in one island triggers update in another',
  template: CrossIslandDemo,
  play: async ({ findByAttribute, fireEvent, assert }) => {
    const button = await findByAttribute('p-target', 'button')
    const header = await findByAttribute('p-target', 'header')

    assert({
      given: 'initial render',
      should: 'show "Hello"',
      actual: header?.textContent,
      expected: 'Hello'
    })

    button && await fireEvent(button, 'click')

    assert({
      given: 'button click',
      should: 'append " World!" to header',
      actual: header?.textContent,
      expected: 'Hello World!'
    })
  }
})
```

## Accessibility Testing

Stories can include accessibility checks using axe-core integration:

```typescript
import { story } from 'plaited/testing'
import { Button } from './button.ts'

export const accessibleButton = story({
  description: 'Button passes accessibility checks',
  template: () => <Button>Accessible Button</Button>,
  play: async ({ accessibilityCheck }) => {
    // Check for any WCAG violations
    await accessibilityCheck({})

    // Check specific rules
    await accessibilityCheck({
      rules: {
        'color-contrast': { enabled: true },
        'button-name': { enabled: true }
      }
    })

    // Exclude specific elements
    await accessibilityCheck({
      exclude: [['[data-test-exclude]']]
    })
  }
})
```

**Common Accessibility Checks**:
- Color contrast
- ARIA attributes
- Keyboard navigation
- Focus management
- Screen reader support
- Semantic HTML

## Inspector Helper for Debugging

The inspector helper enables observation of behavioral program state during execution. It's useful for:
- Agent debugging with Playwright MCP
- Understanding what's happening in behavioral elements
- Developer debugging during development

### Inspector API

Available in `bProgram` through the `inspector` parameter:

```typescript
bElement({
  bProgram({ inspector, bThreads, bSync, bThread }) {
    // Turn on inspector to start receiving snapshots
    inspector.on()

    // Turn off inspector to stop receiving snapshots
    inspector.off()

    // Assign custom callback for snapshot processing
    inspector.assign((snapshot) => {
      console.log('Candidates:', snapshot.candidates)
      console.log('Blocking:', snapshot.blocking)
      console.log('Selected:', snapshot.selected)
    })

    // Reset to default console.table logger
    inspector.reset()
  }
})
```

### Auto-Enabling in Dev Mode

Inspector is automatically enabled in dev mode (when not running in test runner):

```typescript
import { bElement } from 'plaited'

const MyElement = bElement({
  bProgram({ inspector }) {
    // Auto-enabled in dev mode
    if (!window?.__PLAITED_RUNNER__) {
      inspector.on()
    }

    // In test runner, manually enable as needed
    // inspector.on()
  }
})
```

### Inspector Use Cases

#### 1. Agent Debugging with Playwright MCP

Agents using Playwright MCP can inspect behavioral program state:

```typescript
export const debuggableElement = story({
  description: 'Element with inspector for agent debugging',
  template: () => <MyBehavioralElement data-testid="inspectable" />,
  play: async ({ findByTestId }) => {
    const element = await findByTestId('inspectable')

    // Agent can observe inspector output in console
    // to understand what events are candidates, blocked, or selected
  }
})
```

#### 2. Understanding Behavioral Flow

Use inspector to see which threads are requesting events, which are blocking:

```typescript
const ComplexElement = bElement({
  tag: 'complex-element',
  bProgram({ inspector, bThreads, bSync, bThread, trigger }) {
    // Enable inspector for debugging
    inspector.on()

    bThreads.set({
      thread1: bThread([
        bSync({ request: { type: 'event1' } }),
        bSync({ waitFor: 'event2' })
      ], true),
      thread2: bThread([
        bSync({ block: ({ type }) => type === 'event1' }),
        bSync({ request: { type: 'event2' } })
      ])
    })

    // Inspector will show:
    // - thread1 requesting 'event1'
    // - thread2 blocking 'event1'
    // - event1 is blocked, not selected
    // - After external trigger, thread1 waits for 'event2'
    // - thread2 requests 'event2'
    // - event2 is selected
  }
})
```

#### 3. Snapshot Data Structure

Inspector provides `SnapshotMessage` after each super-step:

```typescript
type SnapshotMessage = {
  candidates: Array<{
    type: string
    detail?: unknown
    priority: number
  }>
  blocking: string[]         // Event types being blocked
  selected: {                // The event that was selected
    type: string
    detail?: unknown
    priority: number
  } | null
}
```

**Example inspector output**:
```javascript
{
  candidates: [
    { type: 'click', detail: undefined, priority: 0 },
    { type: 'submit', detail: { value: 'test' }, priority: 1 }
  ],
  blocking: ['reset'],
  selected: { type: 'click', detail: undefined, priority: 0 }
}
```

### Inspector Best Practices

1. **Enable selectively**: Turn on inspector only for elements you're debugging
2. **Use in dev mode**: Automatically enabled in development, disabled in tests
3. **Custom callbacks**: Assign custom processing for integration with logging tools
4. **Understand snapshots**: Learn to read candidate/blocking/selected patterns
5. **Agent integration**: Leverage with Playwright MCP for AI-assisted debugging

## Play Function Utilities

The `play` function receives utilities for interaction testing:

### `assert`

Structured assertion with detailed error reporting:

```typescript
play: async ({ assert }) => {
  assert({
    given: 'initial state',
    should: 'display welcome message',
    actual: element?.textContent,
    expected: 'Welcome'
  })
}
```

### `findByAttribute`

Find elements by any attribute across shadow DOM boundaries:

```typescript
play: async ({ findByAttribute }) => {
  const button = await findByAttribute('p-target', 'submit-btn')
  const icon = await findByAttribute('data-icon', 'chevron')
}
```

### `findByTarget`

Shortcut for finding by `p-target` attribute:

```typescript
play: async ({ findByTarget }) => {
  const header = await findByTarget('header')
  // Equivalent to: findByAttribute('p-target', 'header')
}
```

### `findByTestId`

Find elements by `data-testid` attribute:

```typescript
play: async ({ findByTestId }) => {
  const button = await findByTestId('submit-button')
  // Finds: <button data-testid="submit-button">
}
```

### `findByText`

Find elements by text content:

```typescript
play: async ({ findByText }) => {
  const heading = await findByText('Welcome')
  const regex = await findByText(/welcome/i) // Case insensitive
}
```

### `fireEvent`

Dispatch DOM events with customization:

```typescript
play: async ({ fireEvent, findByTestId }) => {
  const input = await findByTestId('email-input')

  // Simple event
  input && await fireEvent(input, 'click')

  // Event with options
  input && await fireEvent(input, 'input', {
    detail: { value: 'test@example.com' },
    bubbles: true,
    composed: true
  })
}
```

### `wait`

Pause execution for async operations:

```typescript
play: async ({ wait, findByTestId }) => {
  const button = await findByTestId('async-btn')
  button && await fireEvent(button, 'click')

  await wait(500) // Wait 500ms for async operation

  const result = await findByTestId('result')
  // Now assert on result
}
```

### `match`

Flexible string/regex matching:

```typescript
play: async ({ match, findByText }) => {
  const element = await findByText('Test')

  match('hello', 'hello')           // Exact match
  match('hello', /^hel/)            // Regex match
  match('Hello', /hello/i)          // Case insensitive
}
```

### `throws`

Assert that a function throws an error:

```typescript
play: async ({ throws }) => {
  throws(
    () => { throw new Error('Expected error') },
    'Expected error'
  )
}
```

## Story File Organization

```
src/
  components/
    button/
      button.css.ts          # Styles (createStyles)
      button.tokens.ts       # Design tokens (createTokens)
      button.stories.tsx     # FT stories (Button FT defined here)
    toggle-input/
      toggle-input.css.ts    # Styles
      toggle-input.ts        # bElement definition
      toggle-input.stories.tsx # Import bElement, write stories
  patterns/
    cards/
      card.css.ts
      card.stories.tsx       # Card FT examples
    layouts/
      grid.css.ts
      grid.stories.tsx       # Grid FT examples
```

**File Naming**:
- `*.css.ts` - Style definitions
- `*.tokens.ts` - Design tokens
- `*.stories.tsx` - Story files (FT or bElement stories)
- `*.ts` - bElement definitions (imported by stories)

**Organization Rules**:
- FT can be defined in `*.stories.tsx` files
- bElement MUST be defined in separate `*.ts` files
- Stories import bElements for testing
- Styles always in separate `*.css.ts` files
