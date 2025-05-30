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

For more complex state management or when state needs to be shared, Plaited provides `useSignal`. Signals are reactive values that automatically trigger updates in components listening to them.

Let's refactor our counter:

```tsx
// signal-counter.tsx
import { defineElement, useSignal } from 'plaited'

const countSignal = useSignal(0) // Create a signal, initialized to 0. Can be exported and shared.

export const SignalCounter = defineElement({
  tag: 'signal-counter',
  shadowDom: (
    <div>
      <button p-trigger={{ click: 'DECREMENT' }}>-</button>
      {/* The span will be updated reactively when countSignal changes */}
      <span p-target="count">{countSignal.get()}</span>
      <button p-trigger={{ click: 'INCREMENT' }}>+</button>
    </div>
  ),
  bProgram({ $, trigger }) {
    const [countEl] = $('count')

    // Listen to changes in countSignal. When it changes, trigger an 'UPDATE_DISPLAY' action.
    // The `true` argument triggers the listener immediately with the signal's current value.
    countSignal.listen('UPDATE_DISPLAY', trigger, true)

    return {
      INCREMENT() {
        countSignal.set(countSignal.get() + 1) // Update the signal's value
      },
      DECREMENT() {
        countSignal.set(countSignal.get() - 1)
      },
      UPDATE_DISPLAY(newCount: number) { // This action is triggered by countSignal.listen
        countEl.render(`${newCount}`)
      },
    }
  },
})
```

## 4. Styling Your Component

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

## 5. Component Communication

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

## 6. Rendering Lists with `useTemplate`

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

## 7. Interacting with Attributes

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

## 8. Form-Associated Components
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

## 9. A More Complete Example: Todo List

This example ties together `defineElement`, `bProgram`, `useSignal`, `useTemplate`, and `css.create`.

```tsx
// todo-list-app.tsx
import { defineElement, useSignal, useTemplate, css } from 'plaited'

interface TodoItem {
  id: number
  text: string
  completed: boolean
}

const styles = css.create({
  container: { maxWidth: '500px', margin: '20px auto', fontFamily: 'sans-serif' },
  input: { padding: '8px', marginRight: '8px', flexGrow: 1 },
  button: { padding: '8px 12px', cursor: 'pointer' },
  list: { listStyle: 'none', padding: 0 },
  todoItem: {
    display: 'flex',
    alignItems: 'center',
    padding: '10px',
    borderBottom: '1px solid #eee',
  },
  todoText: {
    flexGrow: 1,
    textDecoration: { default: 'none', '.completed': 'line-through' }, // Conditional style based on class
  },
  completed: {}, // Empty style group, used as a conditional class marker
})

const todosSignal = useSignal<TodoItem[]>([])
let nextId = 0

export const TodoListApp = defineElement({
  tag: 'todo-list-app',
  shadowDom: (
    <div {...styles.container}>
      <h1>Todo List</h1>
      <div style={{ display: 'flex', marginBottom: '10px' }}>
        <input type="text" p-target="todoInput" placeholder="Add a new todo" {...styles.input} />
        <button p-trigger={{ click: 'ADD_TODO' }} {...styles.button}>Add</button>
      </div>
      <template p-target="todo-item-tpl">
        <li {...styles.todoItem} p-target="item">
          <input type="checkbox" p-target="checkbox" p-trigger={{ change: 'TOGGLE_TODO' }} />
          <span p-target="text"></span> {/* Removed styles.todoText here, will be applied conditionally */}
          <button p-trigger={{ click: 'REMOVE_TODO' }} {...styles.button}>Remove</button>
        </li>
      </template>
      <ul p-target="todoList" {...styles.list}></ul>
    </div>
  ),
  bProgram({ $, trigger }) {
    const [todoInputEl] = $<HTMLInputElement>('todoInput')
    const [todoListEl] = $('todoList')
    const [todoItemTpl] = $<HTMLTemplateElement>('todo-item-tpl')

    const createTodoElement = useTemplate<TodoItem>(todoItemTpl, (item$, todo) => {
      const [itemEl] = item$('item')
      const [textEl] = item$('text')
      const [checkboxEl] = item$<HTMLInputElement>('checkbox')
      
      itemEl.attr('data-id', todo.id) // Store ID on the <li> for easier targeting
      textEl.render(todo.text)
      checkboxEl.checked = todo.completed // Set checkbox state directly

      // Conditionally apply 'completed' class for styling using css.assign
      if (todo.completed) {
        textEl.attr('class', css.assign(styles.todoText, styles.completed).class)
      } else {
        textEl.attr('class', styles.todoText.class) // Apply base class if not completed
      }
    })

    todosSignal.listen('TODOS_CHANGED', trigger, true) // true: trigger immediately with current value

    return {
      ADD_TODO() {
        const text = todoInputEl.value.trim()
        if (text) {
          const newTodo: TodoItem = { id: nextId++, text, completed: false }
          todosSignal.set([...todosSignal.get(), newTodo])
          todoInputEl.value = ''
        }
      },
      TOGGLE_TODO(event: Event) {
        const checkbox = event.target as HTMLInputElement
        const li = checkbox.closest('[data-id]') // Find parent <li> by data-id
        const todoId = Number(li?.getAttribute('data-id'))

        const updatedTodos = todosSignal.get().map(todo =>
          todo.id === todoId ? { ...todo, completed: checkbox.checked } : todo
        )
        todosSignal.set(updatedTodos)
      },
      REMOVE_TODO(event: Event) {
        const button = event.target as HTMLButtonElement
        const li = button.closest('[data-id]')
        const todoId = Number(li?.getAttribute('data-id'))
        todosSignal.set(todosSignal.get().filter(todo => todo.id !== todoId))
      },
      TODOS_CHANGED(todos: TodoItem[]) {
        todoListEl.render(...todos.map(createTodoElement))
      },
    }
  },
})
```

## 10. Using Web Workers
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

## 11. Introduction to Behavioral Programming
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

## Next Steps

This guide has covered the foundational concepts of Plaited. To dive deeper:

1.  **Explore the [API Guide](./api-guide.md)**: Get a comprehensive reference for all Plaited modules and functions.
2.  **Design Tokens**: Manage your application's visual style consistently with design tokens.
3.  **Testing Utilities**: Discover Plaited's tools for testing components and behaviors.
4.  **Advanced Behavioral Scenarios**: Explore more complex patterns with `bProgram`, `bThread`, and `bSync`.

Happy Hacking!
```