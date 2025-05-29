# Getting Started with Plaited

Plaited is a design system first framework for rapidly designing and developing interfaces as requirements change and evolve. It combines web components, behavioral programming, and a comprehensive styling system to create maintainable, scalable applications.

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

## Core Concepts

### 1. Web Components with `defineElement`

Create custom elements with encapsulated behavior and styling:

```tsx
import { defineElement } from 'plaited'

const Counter = defineElement({
  tag: 'my-counter',
  shadowDom: (
    <div>
      <button p-target="decBtn" p-trigger={{ click: 'DECREMENT' }}>-</button>
      <span p-target="count">0</span>
      <button p-target="incBtn" p-trigger={{ click: 'INCREMENT' }}>+</button>
    </div>
  ),
  bProgram({ $ }) {
    const [countEl] = $('count');
    let count = 0;

    return {
      INCREMENT() {
        count++;
        countEl.render(`${count}`);
      },
      DECREMENT() {
        count--;
        countEl.render(`${count}`);
      }
    };
  }
});
```

Key features:
- `p-target`: Identifies elements for programmatic access
- `p-trigger`: Binds DOM events to behavioral events
- `bProgram`: Defines the component's behavioral logic
- Shadow DOM encapsulation for style and markup isolation

### 2. Behavioral Programming

Plaited uses behavioral programming to coordinate complex interactions through declarative threads:

```ts
import { bProgram, bThread, bSync } from 'plaited/behavioral'

const { bThreads, trigger, useFeedback } = bProgram()

// Define behavioral threads
bThreads.set({
  // Request events
  producer: bThread([
    bSync({ request: { type: 'PRODUCE_ITEM' } })
  ], true), // true = repeat indefinitely
  
  // Wait for and block events
  controller: bThread([
    bSync({ waitFor: 'PRODUCE_ITEM', block: 'CONSUME_ITEM' }),
    bSync({ waitFor: 'CONSUME_ITEM', block: 'PRODUCE_ITEM' })
  ], true)
})

// Handle selected events
useFeedback({
  PRODUCE_ITEM: () => console.log('Item produced'),
  CONSUME_ITEM: () => console.log('Item consumed')
})

// Start the program
trigger({ type: 'START' })
```

### 3. Styling with CSS-in-JS

Type-safe styling with automatic scoping:

```tsx
import { css } from 'plaited/styling'

const styles = css.create({
  button: {
    padding: '8px 16px',
    borderRadius: '4px',
    backgroundColor: {
      default: '#0066cc',
      ':hover': '#0052a3',
      ':active': '#004080'
    },
    color: 'white',
    border: 'none',
    cursor: 'pointer',
    transition: 'background-color 0.2s ease'
  }
})

// Use in components
const Button = ({ children }) => (
  <button {...styles.button}>{children}</button>
)
```

### 4. JSX Support

Plaited includes built-in JSX support with TypeScript integration:

```tsx
// Configure TypeScript (tsconfig.json)
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "plaited"
  }
}

// Use JSX in your components
import { createTemplate } from 'plaited'

const template = createTemplate((props) => (
  <div class="container">
    <h1>{props.title}</h1>
    <p>{props.description}</p>
  </div>
))
```

## Basic Example: Todo List

Here's a complete example combining all concepts:

```tsx
import { defineElement } from 'plaited'
import { css } from 'plaited/styling'

const styles = css.create({
  container: {
    maxWidth: '600px',
    margin: '0 auto',
    padding: '20px'
  },
  input: {
    width: '70%',
    padding: '8px',
    marginRight: '10px'
  },
  button: {
    padding: '8px 16px',
    backgroundColor: '#0066cc',
    color: 'white',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer'
  },
  todoItem: {
    padding: '10px',
    borderBottom: '1px solid #eee',
    display: 'flex',
    justifyContent: 'space-between'
  }
})

const TodoList = defineElement({
  tag: 'todo-list',
  shadowDom: (
    <div {...styles.container}>
      <h2>Todo List</h2>
      <div>
        <input 
          type="text" 
          p-target="input" 
          placeholder="Add a todo..."
          {...styles.input}
        />
        <button 
          p-target="addBtn" 
          p-trigger={{ click: 'ADD_TODO' }}
          {...styles.button}
        >
          Add
        </button>
      </div>
      <div p-target="list"></div>
    </div>
  ),
  bProgram({ $, trigger }) {
    const [input] = $<HTMLInputElement>('input')
    const [list] = $('list')
    const todos: string[] = []

    return {
      ADD_TODO() {
        const value = input.value.trim()
        if (value) {
          todos.push(value)
          input.value = ''
          renderTodos()
        }
      },
      REMOVE_TODO({ index }: { index: number }) {
        todos.splice(index, 1)
        list.render(
        <>
          {todos.map((todo, index) => (
            <div {...styles.todoItem}>
              <span>{todo}</span>
              <button 
                p-trigger={{ click: ['REMOVE_TODO', { index }] }}
                {...styles.button}
              >
                Remove
              </button>
            </div>
          ))}
        </>
      )
      }
    }
  }
})
```

## Next Steps

1. **Explore Advanced Features**:
   - Form-associated custom elements
   - Web Worker integration with `useWorker`
   - Design token management
   - Server-side rendering

2. **Testing**:
   - Use Plaited's testing utilities
   - Create stories for components
   - Set up the workshop test runner

3. **Build a Design System**:
   - Define design tokens
   - Create reusable components
   - Establish styling patterns

For detailed API documentation, see the [API Guide](./api-guide.md).