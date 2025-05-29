# Plaited API Guide

This guide provides a comprehensive reference for all public APIs exported by Plaited's modules.

## Core Module (`plaited`)

### Web Component APIs

#### `defineElement(config)`

Creates a custom web component with behavioral programming support.

```ts
interface ElementConfig<T extends EventDetail = EventDetail> {
  tag: string                          // Custom element tag name
  shadowDom?: Template | string        // Shadow DOM template
  observedAttributes?: string[]        // Attributes to observe
  formAssociated?: boolean            // Enable form association
  delegatesFocus?: boolean            // Delegate focus to shadow DOM
  publicEvents?: string[]             // Events exposed to parent
  usesMotion?: boolean                // Enable motion/animations
  bProgram?: (args: BProgramArgs) => Handlers<T>
}
```

#### `defineWorker(config)`

Creates a type-safe web worker with behavioral programming.

```ts
interface WorkerConfig<T extends EventDetail = EventDetail> {
  publicEvents?: string[]
  bProgram: (args: WorkerBProgramArgs) => Handlers<T>
}
```

#### `useWorker(trigger, path)`

Integrates web workers with Plaited components.

```ts
function useWorker<T extends BPEvent>(
  trigger: Trigger<T> | PlaitedTrigger<T>,
  path: string
): WorkerPostMessage<T> & { disconnect: () => void }
```

#### `useTemplate(template, [target])`

Renders templates with automatic updates.

```ts
function useTemplate(
  template: Template | DocumentFragment | string,
  target?: Element
): TemplateController
```

#### `useDispatch(element)`

Creates a typed event dispatcher.

```ts
function useDispatch<T extends CustomEvent>(
  element: EventTarget
): (event: T) => void
```

#### `useSignal(initialValue)`

Creates reactive state with automatic updates.

```ts
function useSignal<T>(initialValue: T): Signal<T>

interface Signal<T> {
  (): T                    // Get current value
  (newValue: T): void      // Set new value
  subscribe(listener: (value: T) => void): () => void
}
```

#### `useAttributesObserver(element, callback, [attributeFilter])`

Observes attribute changes on elements.

```ts
function useAttributesObserver(
  element: Element,
  callback: (mutation: MutationRecord) => void,
  attributeFilter?: string[]
): () => void
```

### Type Guards

```ts
isTemplate(value: unknown): value is Template
isStyleSheet(value: unknown): value is StyleSheet
isTemplateResult(value: unknown): value is TemplateResult
isPlaitedElement(value: unknown): value is PlaitedElement
isPlaitedTrigger(value: unknown): value is PlaitedTrigger
```

## Behavioral Module (`plaited/behavioral`)

### Core Functions

#### `bProgram()`

Creates a behavioral program instance.

```ts
function bProgram<T extends BPEvent>(): {
  bThreads: BThreads<T>
  trigger: Trigger<T>
  useFeedback: UseFeedback<T>
  useSnapshot: UseSnapshot
}
```

#### `bThread(steps, [repeat])`

Creates a behavioral thread from synchronization steps.

```ts
function bThread<T extends BPEvent>(
  steps: SyncStatement<T>[],
  repeat?: boolean
): BThread<T>
```

#### `bSync(statement)`

Creates a synchronization point.

```ts
interface SyncStatement<T extends BPEvent> {
  request?: T | T[]      // Events to propose
  waitFor?: EventPredicate<T>   // Events to wait for
  block?: EventPredicate<T>     // Events to block
  interrupt?: EventPredicate<T>  // Events that terminate thread
}
```

#### `defineBProgram(config)`

Creates a reusable behavioral program module.

```ts
interface BProgramConfig<T extends BPEvent> {
  publicEvents?: string[]
  bProgram: (args: BProgramFactoryArgs<T>) => Handlers<T>
}
```

### Utility Functions

```ts
randomEvent(requested: BPEvent[]): BPEvent
shuffleSyncs<T>(syncs: SyncStatement<T>[]): SyncStatement<T>[]
getPublicTrigger<T>(trigger: Trigger<T>, publicEvents: string[]): PublicTrigger<T>
getPlaitedTrigger<T>(trigger: Trigger<T>, cleanupFns: Set<() => void>): PlaitedTrigger<T>
```

## Styling Module (`plaited/styling`)

### CSS-in-JS

#### `css.create(styles)`

Creates scoped styles with type safety.

```ts
const styles = css.create({
  className: {
    // CSS properties with TypeScript support
    display: 'flex',
    padding: {
      default: '10px',
      '@media (min-width: 768px)': '20px'
    },
    backgroundColor: {
      default: '#fff',
      ':hover': '#f0f0f0',
      '[data-theme="dark"]': '#222'
    }
  }
})
```

#### `css.host(styles)`

Styles the host element in shadow DOM.

```ts
const hostStyles = css.host({
  display: 'block',
  width: '100%'
})
```

#### `css.keyframes(name, frames)`

Defines CSS animations.

```ts
const fadeIn = css.keyframes('fadeIn', {
  from: { opacity: 0 },
  to: { opacity: 1 }
})
```

#### `css.assign(...styles)`

Combines multiple style objects.

```ts
const combined = css.assign(
  styles.base,
  isActive && styles.active,
  ...fadeIn()
)
```

### Design Tokens

#### `TransformDesignTokens`

Transforms design tokens to CSS variables and TypeScript.

```ts
class TransformDesignTokens {
  constructor(options: {
    tokens: DesignTokensMap
    tokenPrefix?: string
    tokenCase?: 'camelCase' | 'kebabCase'
  })
  
  get css(): string      // CSS custom properties
  get ts(): string       // TypeScript constants
  get map(): Record<string, string>  // Token mapping
}
```

#### `getDesignTokensElement(css, tag)`

Creates a custom element for token injection.

```ts
function getDesignTokensElement(
  css: string,
  tag: string
): CustomElementConstructor
```

#### `getDesignTokensSchema(tokens)`

Generates JSON schema for token validation.

```ts
function getDesignTokensSchema(
  tokens: DesignTokensMap
): object
```

## Testing Module (`plaited/testing`)

### Assertion and Testing

#### `assert(config)`

Type-safe test assertions.

```ts
interface AssertConfig {
  given: string      // Test context
  should: string     // Expected behavior
  actual: unknown    // Actual value
  expected: unknown  // Expected value
}
```

#### `findByText(text, [options])`

Finds elements by text content.

```ts
interface FindOptions {
  container?: Element
  timeout?: number
  exact?: boolean
}
```

#### `findByAttribute(attribute, value, [options])`

Finds elements by attribute.

```ts
function findByAttribute(
  attribute: string,
  value: string,
  options?: FindOptions
): Promise<Element>
```

#### `fireEvent(element, eventType, [detail])`

Simulates DOM events.

```ts
function fireEvent(
  element: Element,
  eventType: string,
  detail?: any
): Promise<void>
```

#### `throws(fn, [expectedError])`

Asserts that a function throws.

```ts
function throws(
  fn: () => void | Promise<void>,
  expectedError?: string | RegExp | ErrorConstructor
): Promise<void>
```

#### `match(pattern)`

Pattern matching for flexible assertions.

```ts
const result = match({
  string: 'contains this',
  number: match.number,
  array: match.array(match.string),
  object: match.shape({
    id: match.string,
    count: match.number
  })
})
```

### Story Testing

#### `StoryObj<T>`

Story configuration type.

```ts
interface StoryObj<T> {
  args?: Partial<T>
  play?: PlayFunction
  parameters?: Record<string, any>
}
```

#### `PlaitedFixture`

Test fixture custom element for story runners.

```html
<plaited-test-fixture
  p-socket="/_plaited"
  p-route="component--story"
  p-file="src/component.stories.ts"
  p-entry="/dist/component.stories.js"
  p-name="Story"
/>
```

## Utilities Module (`plaited/utils`)

### Type Checking

```ts
isTypeOf<T>(value: unknown, type: string): value is T
trueTypeOf(value: unknown): string
```

### DOM Utilities

```ts
canUseDOM(): boolean
ueid(): string  // Unique element ID
```

### String Manipulation

```ts
escape(str: string): string
unescape(str: string): string
hashString(str: string): number

// Case conversion
camelCase(str: string): string
kebabCase(str: string): string
pascalCase(str: string): string
snakeCase(str: string): string
```

### Data Structures

```ts
deepEqual(a: unknown, b: unknown): boolean
keyMirror<T extends string>(keys: T[]): Record<T, T>
```

### Event Handling

```ts
class DelegatedListener {
  constructor(handler: (event: Event) => void)
  handleEvent(event: Event): void
}
```

### Async Utilities

```ts
wait(ms: number): Promise<void>
```

## Workshop Module (`plaited/workshop`)

### Development Tools

```ts
// Story file utilities
globStories(patterns: string[]): Promise<string[]>
getStoryArtifacts(file: string): Promise<StoryArtifacts>

// Server utilities
createStoryRoute(config: StoryRouteConfig): Route
getWorkshop(config: WorkshopConfig): Workshop
mapStoryResponses(stories: StoryMap): ResponseMap

// Library management
getLibrary(stories: StoryFile[]): Library
```

## JSX Configuration

To use JSX with Plaited, configure TypeScript:

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "plaited"
  }
}
```

This enables the use of JSX syntax in `.tsx` files with full type checking and IntelliSense support.