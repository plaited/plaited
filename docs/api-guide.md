# Plaited API Guide

This guide provides a comprehensive reference for all public APIs exported by Plaited's modules.

## Core Module (`plaited`)

### Web Component APIs

#### `defineElement(config)`

Creates a custom web component with behavioral programming support.

```ts
interface ElementConfig<T extends EventDetail = EventDetail> {
  tag: string                          // Custom element tag name
  shadowDom: Template | string         // Shadow DOM template (required)
  mode?: 'open' | 'closed'             // Shadow DOM mode (default: 'open')
  delegatesFocus?: boolean             // Delegate focus to shadow DOM
  slotAssignment?: 'named' | 'manual'  // Slot assignment mode
  observedAttributes?: string[]        // Attributes to observe
  formAssociated?: boolean            // Enable form association
  streamAssociated?: boolean          // Enable stream association
  publicEvents?: string[]             // Events exposed to parent
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

#### `useTemplate(el, callback)`

Creates a template factory function for efficient dynamic content generation with dynamic data binding.

```ts
function useTemplate<T>(
  el: BoundElement<HTMLTemplateElement>,
  callback: (
    $: <E extends Element = Element>(
      target: string,
      match?: SelectorMatch
    ) => BoundElement<E>[],
    data: T
  ) => void
): (data: T) => DocumentFragment
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
function useSignal<T>(initialValue: T): {
  get(): T                           // Get current value
  set(newValue: T): void             // Set new value
  listen(listener: (value: T) => void): () => void  // Subscribe to changes
}
```

#### `useComputed(compute, deps)`

Creates derived reactive state.

```ts
function useComputed<T>(
  compute: () => T,
  deps: Array<{ get(): unknown }>
): {
  get(): T
  listen(listener: (value: T) => void): () => void
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
isTemplateResult(value: unknown): value is TemplateResult
isPlaitedElement(value: unknown): value is PlaitedElement
isPlaitedTrigger(value: unknown): value is PlaitedTrigger<any>
```

### BProgramArgs Interface

```ts
interface BProgramArgs<T extends EventDetail = EventDetail> {
  $: (selector: string) => BoundElement | null  // Enhanced element selector
  trigger: PlaitedTrigger<T>                    // Event trigger with cleanup
  host: HTMLElement                             // Component host element
  root: ShadowRoot | HTMLElement               // Shadow root or host
  // Direct access to behavioral primitives
  bThread: BThread                              // Thread factory
  bSync: BSync                                  // Sync factory
  // Lifecycle hooks
  onConnected?: () => void
  onDisconnected?: () => void
  onAttributeChanged?: (name: string, oldValue: string | null, newValue: string | null) => void
  onAdopted?: () => void
  // Form-associated callbacks (when formAssociated: true)
  onFormAssociated?: (form: HTMLFormElement) => void
  onFormDisabled?: (disabled: boolean) => void
  onFormReset?: () => void
  onFormStateRestore?: (state: any, mode: 'restore' | 'autocomplete') => void
}
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

#### `bThread(rules, [repeat])`

Creates a behavioral thread from generator functions.

```ts
function bThread(
  rules: RulesFunction[],
  repeat?: true | (() => boolean)
): RulesFunction

type RulesFunction = Generator<Idioms<any>, any, BPEvent<any>>
```

#### `bSync(statement)`

Creates a synchronization point.

```ts
interface Idioms<T extends BPEvent> {
  request?: T | T[]                  // Events to propose
  waitFor?: BPListener<T>            // Events to wait for
  block?: BPListener<T>              // Events to block
  interrupt?: BPListener<T>          // Events that terminate thread
}

type BPListener<T> = string | ((event: T) => boolean)
```

#### `defineBProgram(config)`

Creates a reusable behavioral program module.

```ts
interface DefineBProgramProps<T extends BPEvent> {
  trigger: PlaitedTrigger<T>
  publicEvents?: string[] | ReadonlyArray<string>
}

function defineBProgram<T extends BPEvent>(config: {
  publicEvents?: string[]
  bProgram: (props: DefineBProgramProps<T>) => Handlers<T>
}): (props: DefineBProgramProps<T>) => Handlers<T>
```

### Utility Functions

```ts
randomEvent(...events: BPEvent[]): BPEvent
shuffleSyncs(...syncs: BSync[]): BSync[]
getPublicTrigger(args: { 
  trigger: Trigger; 
  publicEvents?: string[] | ReadonlyArray<string> 
}): Trigger
getPlaitedTrigger<T>(
  trigger: Trigger<T>, 
  cleanupFns: Set<() => void>
): PlaitedTrigger<T>
```

### Behavioral Type Guards

```ts
isBPEvent<T>(event: unknown): event is BPEvent<T>
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
  
  get css(): string                   // CSS custom properties
  get ts(): string                    // TypeScript constants
  get map(): Record<string, string>   // Token mapping
  get entries(): Array<[string, DesignTokenValue]>  // All token entries
  
  has(alias: string): boolean         // Check if token exists
  get(alias: string): DesignTokenValue | undefined  // Get specific token
  filter(callback: (entry: [string, DesignTokenValue]) => boolean): Array<[string, DesignTokenValue]>
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

function findByText<T extends Element = Element>(
  text: string,
  options?: FindOptions
): Promise<T | undefined>
```

#### `findByAttribute(attribute, value, [options])`

Finds elements by attribute.

```ts
function findByAttribute<T extends Element = Element>(
  attribute: string,
  value: string,
  options?: FindOptions
): Promise<T | undefined>
```

#### `fireEvent(element, eventType, [eventArgs])`

Simulates DOM events.

```ts
interface EventArguments {
  bubbles?: boolean
  composed?: boolean
  cancelable?: boolean
  detail?: any
}

function fireEvent(
  element: Element,
  eventType: string,
  eventArgs?: EventArguments
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
  play?: Play
  parameters?: Params
}

type Play = (context: {
  canvasElement: HTMLElement
  step: (name: string, fn: () => void | Promise<void>) => Promise<void>
}) => void | Promise<void>
```

#### `usePlay(story, options)`

Executes story play functions.

```ts
function usePlay(
  story: { play?: Play },
  options: {
    canvasElement: HTMLElement
    onError?: (error: Error) => void
    onSuccess?: () => void
  }
): void
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

### Error Classes

```ts
class AssertionError extends Error
class MissingTestParamsError extends Error
class TimeoutError extends Error
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
hashString(str: string): number | null  // null for empty strings

// Case conversion
camelCase(str: string): string
kebabCase(str: string): string
pascalCase(str: string): string
snakeCase(str: string): string
```

### Data Structures

```ts
deepEqual(a: unknown, b: unknown): boolean
keyMirror<Keys extends string>(...inputs: Keys): KeyMirror<Keys>
```

### Event Handling

```ts
class DelegatedListener {
  constructor(handler: (event: Event) => void)
  handleEvent(event: Event): void
}

// Global delegate storage
const delegates: WeakMap<EventTarget, Map<string, DelegatedListener>>
```

### Async Utilities

```ts
wait(ms: number): Promise<void>
```

### Other Utilities

```ts
noop<T = never>(..._: T[]): void  // No-operation function
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

// HTML response generator type
type GetHTMLResponse = (options: {
  title: string
  lib: string
  socket: string
  route: string
  file: string
  entry: string
  name: string
}) => string
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
