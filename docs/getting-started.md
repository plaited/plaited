# Getting Started with Plaited

Welcome to Plaited! This guide will walk you through the basics of building web interfaces with Plaited, a design system-first framework for rapidly developing adaptable and maintainable UIs.

## Installation

```bash
# Using Bun (recommended)
bun install -d plaited

# Using npm
npm install --save-dev plaited
```

## Requirements

- **Bun** >= v1.2.9 (preferred)
- **Node** >= v22.6.0 (with `--experimental-strip-types` flag)

## JSX Setup

To use JSX (TSX) with Plaited, configure your `tsconfig.json`:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "plaited"
  }
}
```

This enables Plaited's JSX transform, allowing you to write component templates using familiar JSX syntax in `.tsx` files.

## 1. Your First Plaited Component

Let's start with a simple "Hello World" component. Plaited components are custom elements defined with the `defineElement` function.

```tsx
// hello-world.tsx
import { defineElement } from 'plaited'

export const HelloWorld = defineElement({
  tag: 'hello-world', // The custom element tag name (must contain a hyphen)
  shadowDom: (        // The template for the component's shadow DOM
    <p>Hello, World!</p>
  ),
})
```

To use this component in HTML:

```html
<hello-world></hello-world>
<script type="module">
  import { HelloWorld } from './hello-world.js';
  // The component is automatically registered when its module is imported.
</script>
```

Plaited components encapsulate their markup and styles within a Shadow DOM, preventing conflicts with other parts of your page.

## 2. Making it Interactive

Plaited components become dynamic through a `bProgram` (behavioral program). Let's create a simple counter.

Key concepts:
- `p-target`: An attribute used to identify specific elements within the shadow DOM, allowing your `bProgram` to access and manipulate them.
- `p-trigger`: An attribute for declaratively binding DOM events (like `click`, `input`) to actions (event types) in your `bProgram`.
- `bProgram`: A function where you define the component's behavior. It receives utilities to interact with the component and its shadow DOM.
- `$`: A scoped query selector function provided to `bProgram`. It takes a `p-target` value and returns a list of matching elements, enhanced with Plaited helper methods.

```tsx
// simple-counter.tsx
import { defineElement } from 'plaited'

export const SimpleCounter = defineElement({
  tag: 'simple-counter',
  shadowDom: (
    <div>
      <button p-target="decBtn" p-trigger={{ click: 'DECREMENT' }}>-</button>
      <span p-target="count">0</span>
      <button p-target="incBtn" p-trigger={{ click: 'INCREMENT' }}>+</button>
    </div>
  ),
  bProgram({ $ }) { // The $ function is for querying p-target'ed elements
    const [countEl] = $('count') // Get the <span> element. $ returns a NodeList.
    let count = 0

    return { // This object maps action types (from p-trigger) to handler functions
      INCREMENT() {
        count++
        countEl.render(`${count}`) // Update the <span>'s content using the render helper
      },
      DECREMENT() {
        count--
        countEl.render(`${count}`)
      },
    }
  },
})
```

Elements selected with `$` are augmented with helper methods:
- `render(...content)`: Replaces the element's children.
- `insert(position, ...content)`: Inserts content relative to the element (e.g., 'beforeend', 'afterbegin').
- `attr(nameOrObject, value?)`: Gets or sets attributes.
- `replace(...content)`: Replaces the element itself.

## 3. Managing State with `useSignal`

Plaited's `bProgram` is typically used for managing state internal to a component. However, when state needs to be shared *between* different Plaited components, `useSignal` provides a powerful solution. Signals are reactive values that, when updated, can automatically trigger actions in any component listening to them. This allows for decoupled communication and state synchronization across your application.

Here's an example of two components sharing a message:

```tsx
// shared-message-system.tsx
import { defineElement, useSignal } from 'plaited'

// 1. Create a shared signal. This can be exported and imported by any component.
const sharedMessage = useSignal('Hello from signal!')

// 2. Component that updates the shared signal
export const MessageSender = defineElement({
  tag: 'message-sender',
  shadowDom: (
    <button p-trigger={{ click: 'UPDATE_MESSAGE' }}>
      Update Message
    </button>
  ),
  bProgram() {
    return {
      UPDATE_MESSAGE() {
        sharedMessage.set('Updated message via signal!')
      },
    }
  },
})

// 3. Component that displays the shared signal's value
export const MessageReceiver = defineElement({
  tag: 'message-receiver',
  shadowDom: (
    <p>Received: <span p-target="display">{sharedMessage.get()}</span></p>
  ),
  bProgram({ $, trigger }) {
    const [displayEl] = $('display')

    // Listen for changes to the sharedMessage signal.
    // When it changes, trigger the 'MESSAGE_UPDATED' action.
    // The `true` argument ensures the listener is called immediately with the current value.
    sharedMessage.listen('MESSAGE_UPDATED', trigger, true)

    return {
      MESSAGE_UPDATED(newMessage: string) {
        displayEl.render(newMessage)
      },
    }
  },
})

// How to use them in HTML:
// <message-sender></message-sender>
// <message-receiver></message-receiver>
// Clicking the button in <message-sender> will update the text in <message-receiver>.
```

## 4. Reactive Computations with `useComputed`
`useComputed` allows you to create signals whose values are derived from other signals. These "computed signals" automatically update when their dependencies change.

```tsx
// computed-name.tsx
import { defineElement, useSignal, useComputed } from 'plaited'

const firstNameSignal = useSignal('Plaited')
const lastNameSignal = useSignal('Framework')

// Create a computed signal for the full name
const fullNameSignal = useComputed(
  () => `${firstNameSignal.get()} ${lastNameSignal.get()}`,
  [firstNameSignal, lastNameSignal] // Dependencies
)

export const ComputedName = defineElement({
  tag: 'computed-name',
  shadowDom: (
    <div>
      <input
        type="text"
        p-target="firstNameInput"
        p-trigger={{ input: 'UPDATE_FIRST_NAME' }}
        value={firstNameSignal.get()}
      />
      <input
        type="text"
        p-target="lastNameInput"
        p-trigger={{ input: 'UPDATE_LAST_NAME' }}
        value={lastNameSignal.get()}
      />
      <p>Full Name: <span p-target="fullNameDisplay">{fullNameSignal.get()}</span></p>
    </div>
  ),
  bProgram({ $, trigger }) {
    const [firstNameInputEl] = $<HTMLInputElement>('firstNameInput')
    const [lastNameInputEl] = $<HTMLInputElement>('lastNameInput')
    const [fullNameDisplayEl] = $('fullNameDisplay')

    // Listen to changes in fullNameSignal
    fullNameSignal.listen('FULL_NAME_CHANGED', trigger, true)

    return {
      UPDATE_FIRST_NAME() {
        firstNameSignal.set(firstNameInputEl.value)
      },
      UPDATE_LAST_NAME() {
        lastNameSignal.set(lastNameInputEl.value)
      },
      FULL_NAME_CHANGED(newName: string) {
        fullNameDisplayEl.render(newName)
      },
    }
  },
})
```

## 5. Styling Your Component

Plaited offers a type-safe CSS-in-JS solution via the `css` object.

### Scoped Styles with `css.create`
Styles are automatically scoped to the component.

```tsx
// styled-button.tsx
import { defineElement, css } from 'plaited'

const styles = css.create({
  button: { // Logical name for this style group
    padding: '8px 16px',
    borderRadius: '4px',
    backgroundColor: { // Nested object for conditional/pseudo-class styles
      default: '#007bff', // Default background
      ':hover': '#0056b3', // Background on hover
    },
    color: 'white',
    border: 'none',
    cursor: 'pointer',
  },
})

export const StyledButton = defineElement({
  tag: 'styled-button',
  shadowDom: (
    // Spread the generated class and stylesheet onto the element
    <button {...styles.button}>Click Me</button>
  ),
})
```
`styles.button` provides `{ class: string, stylesheet: string[] }`. Plaited injects these stylesheets into the shadow DOM.

### Styling the Host with `css.host`
To style the custom element itself (the "host"):

```tsx
// host-styled-component.tsx
import { defineElement, css } from 'plaited'

const hostStyles = css.host({
  display: 'block', // Applied to :host
  border: '1px solid gray',
  padding: '1rem',
  ':state(focused)': { // Styles :host([focused]) for custom states
    borderColor: 'blue',
  },
})

export const HostStyledComponent = defineElement({
  tag: 'host-styled-component',
  shadowDom: (
    <div {...hostStyles}>I am styled by my host!</div>
  ),
})
```

### Combining Styles with `css.assign`
Conditionally combine multiple style objects:
```tsx
// conditional-styles.tsx
import { defineElement, css } from 'plaited'

const baseStyles = css.create({ btn: { padding: '10px' } })
const primaryStyles = css.create({ primary: { backgroundColor: 'blue', color: 'white' } })
const largeStyles = css.create({ large: { fontSize: '1.2em' } })

export const SmartButton = defineElement({
  tag: 'smart-button',
  // ... (imagine props for isPrimary, isLarge)
  shadowDom: (
    <button {...css.assign(
      baseStyles.btn,
      true && primaryStyles.primary, // Conditionally apply primary styles
      false && largeStyles.large   // Conditionally apply large styles
    )}>
      Smart Button
    </button>
  )
})

```

### Defining Animations with `css.keyframes`
Create reusable CSS animations:
```tsx
// animated-box.tsx
import { defineElement, css } from 'plaited'

const fadeIn = css.keyframes('fadeIn', {
  from: { opacity: 0, transform: 'translateY(20px)' },
  to: { opacity: 1, transform: 'translateY(0)' },
})

const styles = css.create({
  box: {
    width: '100px',
    height: '100px',
    backgroundColor: 'tomato',
    animationName: fadeIn.id, // Use the generated animation name
    animationDuration: '1s',
    animationFillMode: 'forwards',
  },
})

export const AnimatedBox = defineElement({
  tag: 'animated-box',
  shadowDom: (
    // Include the keyframes stylesheet along with component styles
    <div {...css.assign(styles.box, fadeIn())}>I will fade in!</div>
  ),
})
```
`fadeIn()` returns a `StylesObject` like `{ stylesheet: ["@keyframes fadeIn_xyz {...}"] }`.
`fadeIn.id` provides the unique animation name for use in `animationName`.

## 6. Component Communication

### Shared State with `useSignal`
As seen with `SignalCounter`, `useSignal` is excellent for sharing state between components, even if they aren't direct parent/child.

```tsx
// message-system.tsx
import { defineElement, useSignal } from 'plaited'

// Shared signal
export const messageSignal = useSignal('Hello')

export const MessageUpdater = defineElement({
  tag: 'message-updater',
  shadowDom: <button p-trigger={{ click: 'CHANGE_MESSAGE' }}>Say Goodbye</button>,
  bProgram() {
    return {
      CHANGE_MESSAGE() {
        messageSignal.set('Goodbye')
      },
    }
  },
})

export const MessageDisplay = defineElement({
  tag: 'message-display',
  shadowDom: <p p-target="message">{messageSignal.get()}</p>,
  bProgram({ $, trigger }) {
    const [messageEl] = $('message')
    messageSignal.listen('MESSAGE_CHANGED', trigger, true)
    return {
      MESSAGE_CHANGED(newMessage: string) {
        messageEl.render(newMessage)
      },
    }
  },
})

// To use:
// <message-updater></message-updater>
// <message-display></message-display>
```

### Dispatching Custom Events with `useDispatch`
For broader communication, especially from child to parent or unrelated components, use custom events with `useDispatch`.

```tsx
// event-emitter.tsx
import { defineElement, useDispatch } from 'plaited'

export const EventEmitter = defineElement({
  tag: 'event-emitter',
  shadowDom: <button p-trigger={{ click: 'SEND_EVENT' }}>Send Custom Event</button>,
  bProgram({ host }) {
    const dispatch = useDispatch(host) // Create a dispatcher for this component
    return {
      SEND_EVENT() {
        dispatch({
          type: 'my-custom-event', // Event name
          detail: { message: 'Data from emitter!' }, // Payload
          bubbles: true,    // Allows event to bubble up the DOM
          composed: true,   // Allows event to cross shadow DOM boundaries
        })
      },
    }
  },
})

// event-listener.tsx
import { defineElement } from 'plaited'

export const EventListener = defineElement({
  tag: 'event-listener',
  // p-trigger can listen to events dispatched from children (if bubbles & composed)
  shadowDom: (
    <div p-trigger={{ 'my-custom-event': 'HANDLE_CUSTOM_EVENT' }}>
      <p p-target="log">Waiting for event...</p>
      <event-emitter></event-emitter> {/* Child component */}
    </div>
  ),
  bProgram({ $ }) {
    return {
      HANDLE_CUSTOM_EVENT(eventDetail: { message: string }) {
        const [logEl] = $('log')
        logEl.render(`Received: ${eventDetail.message}`)
      },
    }
  },
})
```

## 7. Rendering Lists with `useTemplate`

For efficiently rendering lists or repeated structures, Plaited provides `useTemplate`. It clones a `<template>` element and populates it with data.

```tsx
// user-list.tsx
import { defineElement, useTemplate } from 'plaited'

interface User {
  id: number
  name: string
  email: string
}

export const UserList = defineElement({
  tag: 'user-list',
  shadowDom: (
    <div>
      <h2>Users</h2>
      {/* The template for a single user item */}
      <template p-target="user-item-tpl">
        <li>
          <strong p-target="name"></strong> (<span p-target="email"></span>)
        </li>
      </template>
      <ul p-target="list"></ul>
    </div>
  ),
  bProgram({ $, trigger }) {
    const [listEl] = $('list')
    const [userItemTpl] = $<HTMLTemplateElement>('user-item-tpl')

    // Create a template factory function
    const createUserRow = useTemplate<User>(userItemTpl, (item$, userData) => {
      // item$ is a scoped query selector for this cloned template instance
      item$('name')[0].render(userData.name)
      item$('email')[0].render(userData.email)
    })

    const initialUsers: User[] = [
      { id: 1, name: 'Alice', email: 'alice@example.com' },
      { id: 2, name: 'Bob', email: 'bob@example.com' },
    ]

    // Render initial list
    listEl.render(...initialUsers.map(createUserRow))

    // Example of adding a user (could be triggered by an event)
    // trigger({ type: 'ADD_USER', detail: { id: 3, name: 'Charlie', email: 'charlie@example.com' } });

    return {
      ADD_USER(newUser: User) {
        listEl.insert('beforeend', createUserRow(newUser))
      },
    }
  },
})
```

## 8. Interacting with Attributes

### Observing Slotted Element Attributes with `useAttributesObserver`
Sometimes, a component needs to react when attributes change on an element *slotted into it*. `useAttributesObserver` is designed for this.

```tsx
// attribute-monitor.tsx
import { defineElement, useAttributesObserver, type ObservedAttributesDetail } from 'plaited';

export const AttributeMonitor = defineElement({
  tag: 'attribute-monitor',
  shadowDom: (
    <div>
      <p>Observing slotted element...</p>
      <slot p-target="contentSlot"></slot>
      <div p-target="output"></div>
    </div>
  ),
  bProgram({ $, trigger }) {
    const [contentSlotEl] = $<HTMLSlotElement>('contentSlot');
    const [outputEl] = $('output');

    // Create an observer factory that will dispatch 'slotted-attr-changed' events
    const attributeObserver = useAttributesObserver('slotted-attr-changed', trigger);

    contentSlotEl.addEventListener('slotchange', () => {
      const [slottedEl] = contentSlotEl.assignedElements(); // Get the first slotted element
      if (slottedEl) {
        // Start observing 'data-value' and 'disabled' attributes on the slotted element
        attributeObserver(slottedEl, ['data-value', 'disabled']);
        outputEl.render(`Now observing: ${slottedEl.tagName}`);
      }
    });

    return {
      'slotted-attr-changed'(detail: ObservedAttributesDetail) {
        outputEl.insert('beforeend',
          <p>Attribute '{detail.name}' changed from '{detail.oldValue ?? 'null'}' to '{detail.newValue ?? 'null'}'</p>
        );
      }
    };
  }
});

// Usage:
// <attribute-monitor>
//   <input type="text" data-value="initial" />
// </attribute-monitor>
// If you then programmatically change data-value or disabled on the input,
// the attribute-monitor will log the change.
```

### Observing Host Attributes with `onAttributeChanged`
For attributes on the component itself, list them in `observedAttributes` and handle changes in `onAttributeChanged`:

```tsx
// self-observer.tsx
import { defineElement } from 'plaited'

export const SelfObserver = defineElement({
  tag: 'self-observer',
  observedAttributes: ['status'], // Observe the 'status' attribute
  shadowDom: <p>Status: <span p-target="statusDisplay"></span></p>,
  bProgram({ $, host }) {
    const [statusDisplayEl] = $('statusDisplay')
    return {
      onConnected() {
        // host.status will be the initial value of the 'status' attribute
        statusDisplayEl.render(host.status || 'not set')
      },
      onAttributeChanged({ name, oldValue, newValue }) {
        if (name === 'status') {
          statusDisplayEl.render(newValue || 'not set')
        }
      },
    }
  },
})
// Usage: <self-observer status="loading"></self-observer>
// Then: document.querySelector('self-observer').setAttribute('status', 'done');
```

## 9. Form-Associated Components
Plaited components can participate in HTML forms. Set `formAssociated: true` in `defineElement`.

```tsx
// simple-input.tsx
import { defineElement } from 'plaited'

export const SimpleInput = defineElement({
  tag: 'simple-input',
  formAssociated: true, // Enable form association
  observedAttributes: ['value', 'name', 'required'],
  shadowDom: (
    <input
      type="text"
      p-target="input"
      p-trigger={{ input: 'INPUT_CHANGED', blur: 'VALIDATE' }}
    />
  ),
  bProgram({ host, internals, $ }) {
    const [inputEl] = $<HTMLInputElement>('input')

    return {
      onConnected() {
        // Initialize value from attribute or set a default
        const initialValue = host.getAttribute('value') || '';
        inputEl.value = initialValue;
        internals.setFormValue(initialValue); // Set initial form value

        // Set name for form submission data
        inputEl.name = host.getAttribute('name') || '';
        inputEl.required = host.hasAttribute('required');
      },
      INPUT_CHANGED() {
        internals.setFormValue(inputEl.value); // Update form value on input
        // Optionally, re-validate on input
        // host.trigger({ type: 'VALIDATE' });
      },
      VALIDATE() {
        if (inputEl.required && !inputEl.value) {
          internals.setValidity({ valueMissing: true }, 'This field is required.');
        } else {
          internals.setValidity({}); // Clear validity
        }
      },
      // Handle form lifecycle (optional)
      onFormReset() {
        inputEl.value = host.getAttribute('value') || ''; // Reset to initial or default
        internals.setFormValue(inputEl.value);
        internals.setValidity({});
      },
    }
  },
})
```
The `internals` object (an `ElementInternals` instance) provides methods like:
- `internals.setFormValue(value, state?)`: Sets the value for form submission.
- `internals.setValidity(flags, message?, anchor?)`: Sets the element's validity state.
- `internals.form`: Access to the parent form.
- `internals.states`: A `CustomStateSet` for custom pseudo-classes (e.g., `:state(checked)`).

## 11. A More Challenging Example: Tic Tac Toe Game

For a more involved example that demonstrates complex behavioral programming patterns, check out the Tic Tac Toe game implementation. This example showcases:

-   Managing game state (board, current player, win conditions).
-   Enforcing game rules using behavioral threads (`bThread` and `bSync`).
-   Dynamically rendering UI components based on game events.
-   Structuring a component with a more complex behavioral program.

Here's a look at the key components and their core logic:

### a. The Main Game Logic: `tic-tac-toe-board.tsx`

This component orchestrates the game. It defines win conditions, enforces player turns using behavioral threads, and updates the UI when a square is clicked.

Key behavioral threads:
-   `enforceTurns`: Ensures players alternate turns (X then O).
-   `squaresTaken`: Prevents a square from being selected more than once.
-   `detectWins`: Checks for a winning condition after each move for both X and O.
-   `stopGame`: Blocks further moves once a win condition is met.
-   `preventCompletionOfLineWithTwoXs`: A simple AI strategy for player O to block X from winning.
-   `startAtCenter` & `defaultMoves`: Provides some default moves for player O if no blocking move is available.

```tsx
const winConditions = [
  //rows
  [0, 1, 2],
  [3, 4, 5],
  [6, 7, 8],
  // columns
  [0, 3, 6],
  [1, 4, 7],
  [2, 5, 8],
  // diagonals
  [0, 4, 8],
  [2, 4, 6],
]

const squares = [0, 1, 2, 3, 4, 5, 6, 7, 8]

type Square = { square: number }

const enforceTurns = bThread(
  [bSync<Square>({ waitFor: 'X', block: 'O' }), bSync<Square>({ waitFor: 'O', block: 'X' })],
  true,
)

const squaresTaken: Record<string, RulesFunction> = {}
for (const square of squares) {
  squaresTaken[`(${square}) taken`] = bThread(
    [
      bSync<Square>({
        waitFor: ({ detail }) => square === detail.square,
      }),
      bSync<Square>({
        block: ({ detail }) => square === detail.square,
      }),
    ],
    true,
  )
}

type Winner = { player: 'X' | 'O'; squares: number[] }
const detectWins = (player: 'X' | 'O') =>
  winConditions.reduce((acc: Record<string, RulesFunction>, squares) => {
    acc[`${player}Wins (${squares})`] = bThread(
      [
        bSync<{ square: number }>({
          waitFor: ({ type, detail }) => type === player && squares.includes(detail.square),
        }),
        bSync<{ square: number }>({
          waitFor: ({ type, detail }) => type === player && squares.includes(detail.square),
        }),
        bSync<{ square: number }>({
          waitFor: ({ type, detail }) => type === player && squares.includes(detail.square),
        }),
        bSync<Winner>({
          request: { type: 'win', detail: { squares, player } },
        }),
      ],
      true,
    )
    return acc
  }, {})

const stopGame = bThread([bSync({ waitFor: 'win' }), bSync({ block: ['X', 'O'] })], true)

const defaultMoves: Record<string, RulesFunction> = {}
for (const square of squares) {
  defaultMoves[`defaultMoves(${square})`] = bThread(
    [
      bSync<Square>({
        request: {
          type: 'O',
          detail: { square },
        },
      }),
    ],
    true,
  )
}

const startAtCenter = bSync({
  request: {
    type: 'O',
    detail: { square: 4 },
  },
})

const preventCompletionOfLineWithTwoXs = (board: Set<number>) => {
  const threads: Record<string, RulesFunction> = {}
  for (const win of winConditions) {
    threads[`StopXWin(${win})`] = bThread([
      bSync<Square>({
        waitFor: ({ type, detail }) => type === 'X' && win.includes(detail.square),
      }),
      bSync<Square>({
        waitFor: ({ type, detail }) => type === 'X' && win.includes(detail.square),
      }),
      bSync<Square>({
        request: () => ({ type: 'O', detail: { square: win.find((num) => board.has(num)) || 0 } }),
      }),
    ])
  }
  return threads
}
export const TicTacToeBoard = defineElement({
  tag: 'tic-tac-toe-board',
  shadowDom: <BoardMarker />,
  bProgram({ $, bThreads, trigger }) {
    const board = new Set(squares)
    bThreads.set({
      enforceTurns,
      ...squaresTaken,
      ...detectWins('X'),
      ...detectWins('O'),
      stopGame,
      ...preventCompletionOfLineWithTwoXs(board),
      startAtCenter,
      ...defaultMoves,
    })
    return {
      // When BPEvent X happens we delete the square provided in the event's detail
      X({ square }: Square) {
        board.delete(square)
        $(`${square}`)[0]?.render(<XMarker />)
      },
      // When BPEvent X happens we delete the square provided in the event's detail
      O({ square }: Square) {
        board.delete(square)
        $(`${square}`)[0]?.render(<OMarker />)
      },
      // When BPEvent click happens
      click(evt: MouseEvent & { target: HTMLButtonElement }) {
        const { target } = evt
        const { value } = target
        if (value) {
          trigger({ type: 'X', detail: { square: Number(value) } })
        }
      },
    }
  },
})
```

### b. The Game Board UI: `board-marker.tsx`

This functional component renders the 3x3 grid. Each cell is a button that, when clicked, triggers a `click` event. The `p-target` attribute allows the `bProgram` to identify which square was clicked.

```tsx
export const BoardMarker: FT = () => (
  <div
    role='group'
    aria-label='board'
    {...styles.board}
  >
    {Array.from(Array(9).keys()).map((n) => (
      <button
        {...styles.square}
        value={n}
        p-trigger={{ click: 'click' }}
        p-target={`${n}`}
      ></button>
    ))}
  </div>
)
```

### c. Player Markers: `x-marker.tsx` and `o-marker.tsx`

These are simple functional components that render SVG images for the X and O markers. They are dynamically rendered into the clicked squares by the `bProgram` of `TicTacToeBoard`.

**`x-marker.tsx`**
```tsx
export const XMarker: FT = () => (
  <svg
    {...styles.x}
    viewBox='0 0 21 21'
    fill='none'
  >
    <path
      d='M16 0.900002C16.5 0.400002 17.1 0.200001 17.8 0.200001C19.2 0.200001 20.3 1.3 20.3 2.7C20.3 3.4 20 4 19.6 4.5L13.8 10.2L19.4 15.8L19.5 15.9C20 16.4 20.2 17 20.2 17.7C20.2 19.1 19.1 20.2 17.7 20.2C17 20.2 16.4 19.9 15.9 19.5L15.8 19.4L15.7 19.3L10.1 13.7L4.4 19.4C3.9 19.9 3.3 20.1 2.6 20.1C1.2 20.1 0.0999985 19 0.0999985 17.6C0.0999985 16.9 0.399995 16.3 0.799995 15.8L6.5 10.1L0.900002 4.5L0.699997 4.3C0.199997 3.9 0 3.2 0 2.5C0 1.1 1.1 0 2.5 0C3.2 0 3.8 0.300001 4.3 0.700001L4.4 0.799999L10.1 6.4L16 0.900002Z'
      fill='currentColor'
    />
  </svg>
)
```

**`o-marker.tsx`**
```tsx
export const OMarker: FT = () => (
  <svg
    {...styles.o}
    viewBox='0 0 20 20'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
  >
    <path
      d='M0 10C0 15.5 4.5 20 10 20C15.5 20 20 15.5 20 10C20 4.5 15.5 0 10 0C4.5 0 0 4.4 0 10ZM15 10C15 12.8 12.8 15 10 15C7.2 15 5 12.8 5 10C5 7.2 7.2 5 10 5C12.8 5 15 7.2 15 10Z'
      fill='currentColor'
    />
  </svg>
)
```

This example provides a practical demonstration of how Plaited's behavioral programming features can be used to build interactive and rule-driven applications.

## 12. Using Web Workers
Offload computationally intensive tasks to Web Workers using `useWorker` and `defineWorker`.

**Component side (`my-component.tsx`):**
```tsx
// my-component.tsx
import { defineElement, useWorker } from 'plaited'

export const WorkerComponent = defineElement({
  tag: 'worker-component',
  shadowDom: (
    <div>
      <button p-trigger={{ click: 'CALCULATE' }}>Calculate in Worker</button>
      <p p-target="result">Result: (not calculated)</p>
    </div>
  ),
  bProgram({ $, trigger }) {
    const [resultEl] = $('result')
    // Initialize the worker. The trigger will handle messages from the worker.
    const sendToWorker = useWorker(trigger, './calculator.worker.js') // Path to worker script

    return {
      CALCULATE() {
        resultEl.render('Calculating...')
        sendToWorker({ type: 'MULTIPLY', detail: { a: 7, b: 6 } })
      },
      // This action is triggered by messages sent from the worker
      WORKER_RESULT(data: number) {
        resultEl.render(`Result: ${data}`)
      },
      WORKER_ERROR(error: string) {
        resultEl.render(`Error: ${error}`)
      },
    }
  },
})
```

**Worker side (`calculator.worker.ts`):**
```ts
// calculator.worker.ts
import { defineWorker } from 'plaited'

// Define the worker's bProgram and public events it listens to
defineWorker<{ MULTIPLY: (data: { a: number; b: number }) => void }>({
  publicEvents: ['MULTIPLY'], // Events this worker will process from the main thread
  bProgram({ send }) { // `send` is used to post messages back to the main thread
    return {
      MULTIPLY({ a, b }) {
        try {
          const result = a * b;
          send({ type: 'WORKER_RESULT', detail: result });
        } catch (e: unknown) {
          send({ type: 'WORKER_ERROR', detail: (e as Error).message });
        }
      },
    }
  },
})
```
The component uses `useWorker(trigger, path)` to get a function for sending messages to the worker. The worker uses `defineWorker` and its provided `send` function to communicate back.

## 13. Introduction to Behavioral Programming
At its core, Plaited leverages behavioral programming (BP) principles. For more intricate scenarios, you can use BP directly. BP involves defining "b-threads" – small, independent pieces of behavior (generator functions) that run concurrently and synchronize using events.

In `defineElement`, the `bProgram` function is the entry point. `bThread` and `bSync` utilities are provided via `BProgramArgs`:

- `bThread(rules, repeat?)`: Defines a behavioral thread.
- `bSync(idioms)`: Defines a synchronization step with `request`, `waitFor`, `block`, and `interrupt` idioms.

```tsx
// bp-component.tsx
import { defineElement } from 'plaited'

export const BPComponent = defineElement({
  tag: 'bp-component',
  shadowDom: (
    <div>
      <button p-trigger={{ click: 'START_PROCESS' }}>Start</button>
      <p p-target="status">Idle</p>
    </div>
  ),
  bProgram({ $, bThreads, bSync, bThread, trigger }) {
    const [statusEl] = $('status')

    const processThread = bThread([
      // Step 1: Wait for START_PROCESS, then request PROCESSING
      bSync({ waitFor: 'START_PROCESS', request: { type: 'PROCESSING' } }),
      // Step 2: Wait for an external ACK (acknowledgment), then request COMPLETE
      bSync({ waitFor: 'EXTERNAL_ACK', request: { type: 'COMPLETE' } }),
    ])

    // A thread to simulate an external acknowledgment after a delay
    const ackThread = bThread([
      bSync({ waitFor: 'PROCESSING' }), // Wait until processing starts
      function*() { // Custom generator step for async logic
        yield { request: { type: 'ACK_PENDING' } } // Announce ack is pending
        yield new Promise(resolve => setTimeout(resolve, 1000)); // Simulate delay
        yield { request: { type: 'EXTERNAL_ACK'} }; // Send the ack
      }
    ])

    bThreads.set({ processThread, ackThread }) // Activate the threads

    return {
      START_PROCESS() {
        statusEl.render('Start button clicked, process pending...')
      },
      PROCESSING() {
        statusEl.render('Processing...')
      },
      ACK_PENDING() {
        statusEl.insert('beforeend', <span> Waiting for ACK...</span>);
      },
      EXTERNAL_ACK() {
        statusEl.insert('beforeend', <span> ACK received!</span>);
      },
      COMPLETE() {
        statusEl.render('Process Complete!')
        // To make the process repeatable, re-trigger START_PROCESS or re-enable threads
      },
    }
  },
})
```

## 14. Next Steps

This guide has covered the foundational concepts of Plaited. To dive deeper:

1.  **Explore the [API Guide](./api-guide.md)**: Get a comprehensive reference for all Plaited modules and functions.
2.  **Design Tokens**: Manage your application's visual style consistently with design tokens.
3.  **Testing Utilities**: Discover Plaited's tools for testing components and behaviors.
4.  **Advanced Behavioral Scenarios**: Explore more complex patterns with `bProgram`, `bThread`, and `bSync`.

Happy Hacking!
