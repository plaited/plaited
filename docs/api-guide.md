# Plaited API Guide

This guide provides a comprehensive reference for all public APIs exported by Plaited's modules.

## Core Module (`plaited`)

### Web Component APIs

#### `defineElement(config)`

Creates a custom web component with behavioral programming support.

```ts
interface DefineElementArgs<A extends PlaitedHandlers> {
  tag: string                          // Custom element tag name (required)
  shadowDom: PlaitedTemplate           // Shadow DOM template (required)
  mode?: ShadowRootMode                // Shadow DOM mode (default: 'open')
  delegatesFocus?: boolean             // Delegate focus to shadow DOM
  slotAssignment?: SlotAssignmentMode  // Slot assignment mode
  observedAttributes?: string[]        // Attributes to observe
  formAssociated?: boolean             // Enable form association
  streamAssociated?: boolean           // Enable stream association
  publicEvents?: string[]              // Events exposed to parent
  bProgram?: (args: GetElementArgs<A>) => A
}
```

#### `defineWorker(config)`

Creates a type-safe web worker with behavioral programming.

```ts
function defineWorker<A extends Handlers>(config: {
  publicEvents?: string[]
  bProgram: (args: WorkerGetBProgramArgs<A>) => A
}): WorkerConstructor
```

#### `useWorker(trigger, path)`

Integrates web workers with Plaited components.

```ts
function useWorker<T>(
  trigger: Trigger<T> | PlaitedTrigger<T>,
  path: string
): ((message: T) => void) & { disconnect: () => void }
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
function useDispatch<T extends PlaitedCustomEvent>(
  element: PlaitedElement
): (detail: T['detail']) => void
```

#### `useSignal(initialValue, [signalName])`

Creates reactive state with automatic updates.

```ts
function useSignal<T>(
  initialValue: T,
  signalName?: string
): {
  get(): T                           // Get current value
  set(newValue: T): void             // Set new value
  listen(eventType: string, trigger: Trigger | PlaitedTrigger, getLVC?: boolean): Disconnect
}
```

#### `useAttributesObserver(element)`

Creates an attribute observer factory for elements.

```ts
function useAttributesObserver(
  element: Element
): (callback: MutationCallback, attributeFilter?: string[]) => Disconnect
```

### Type Guards

```ts
isPlaitedElement(value: unknown): value is PlaitedElement
isPlaitedTrigger(value: unknown): value is PlaitedTrigger<any>
isPlaitedMessage(value: unknown): value is PlaitedMessage<any>
isPlaitedTemplateFunction(value: unknown): value is PlaitedTemplateFunction
```

### BProgramArgs and GetElementArgs Types

```ts
interface BProgramArgs<T> {
  bThreads: BThreads<T>               // Thread management
  trigger: PlaitedTrigger<T>          // Event trigger with cleanup
  internals: ElementInternals | null  // Form-associated internals
  useSnapshot: UseSnapshot            // State snapshot utility
  bThread: BThread                    // Thread factory
  bSync: BSync                        // Sync factory
}

interface GetElementArgs<A extends PlaitedHandlers> extends BProgramArgs<PlaitedMessage<A>> {
  $: <T extends Element = Element>(
    target: string,
    match?: SelectorMatch
  ) => BoundElement<T>[]              // Enhanced element selector
  root: ShadowRoot | HTMLElement     // Shadow root or host
  host: HTMLElement                   // Component host element
}
```

## Behavioral Module (`plaited/behavioral`)

### Core Functions

#### `bProgram()`

Creates a behavioral program instance.

```ts
function bProgram(): {
  bThreads: BThreads
  trigger: Trigger
  useFeedback: UseFeedback
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

type RulesFunction = () => Generator<Idioms, void, undefined>
```

#### `bSync(statement)`

Creates a synchronization point.

```ts
function bSync(idioms: Idioms): RulesFunction

interface Idioms<T = any> {
  request?: BPEvent<T> | BPEventTemplate<T>  // Event to propose
  waitFor?: BPListener<T>                     // Events to wait for
  block?: BPListener<T>                       // Events to block
  interrupt?: BPListener<T>                   // Events that terminate thread
}

type BPListener<T = any> = string | ((args: { type: string; detail: T }) => boolean)
type BPEvent<T = any> = { type: string; detail: T }
type BPEventTemplate<T = any> = (detail?: T) => BPEvent<T>
```

#### `defineBProgram(config)`

Creates a reusable behavioral program module.

```ts
interface DefineBProgramProps<T = any> {
  trigger: PlaitedTrigger<T>
  publicEvents?: string[] | ReadonlyArray<string>
  bSync: BSync
  bThread: BThread
  bThreads: BThreads<T>
  useSnapshot: UseSnapshot
}

function defineBProgram<
  A extends Handlers = Handlers,
  C extends Record<string, unknown> = Record<string, unknown>
>(config: {
  publicEvents?: string[]
  bProgram: (props: DefineBProgramProps<PlaitedMessage<A>> & C) => A
}): (props: { trigger: PlaitedTrigger<PlaitedMessage<A>> } & C) => A
```

### Utility Functions

```ts
randomEvent<T = any>(...events: BPEvent<T>[]): BPEvent<T>
shuffleSyncs(...syncs: RulesFunction[]): RulesFunction[]
getPublicTrigger(args: { 
  trigger: Trigger; 
  publicEvents?: string[] | ReadonlyArray<string> 
}): Trigger
getPlaitedTrigger<T = any>(
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

#### `assert(params)`

Type-safe test assertions.

```ts
function assert<T>(params: AssertParams<T>): void

type AssertParams<T> = {
  given: string      // Test context
  should: string     // Expected behavior
  actual: T          // Actual value
  expected: T        // Expected value
}
```

#### `findByText(searchText, [context])`

Finds elements by text content.

```ts
function findByText<T extends Element = Element>(
  searchText: string | RegExp,
  context?: HTMLElement
): Promise<T | undefined>
```

#### `findByAttribute(attribute, value, [context])`

Finds elements by attribute.

```ts
function findByAttribute<T extends Element = Element>(
  attribute: string,
  value: string,
  context?: HTMLElement
): Promise<T | undefined>
```

#### `fireEvent(element, eventType, [eventArgs])`

Simulates DOM events.

```ts
type EventArguments = {
  bubbles?: boolean
  composed?: boolean
  cancelable?: boolean
  detail?: Record<string, unknown>
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

#### Story Types

```ts
type StoryObj<T> = PlayStoryObj<T> | TemplateStoryObj<T>

interface PlayStoryObj<T> {
  args?: T
  template?: PlaitedTemplate
  description: string
  play: Play
  parameters?: Params
}

interface TemplateStoryObj<T> {
  args?: T
  template?: PlaitedTemplate
  description: string
  play?: Play
  parameters?: Params
}

type Play = (utils: {
  assert: typeof assert
  findByAttribute: typeof findByAttribute
  findByText: typeof findByText
  fireEvent: typeof fireEvent
  hostElement: HTMLElement
  match: typeof match
  throws: typeof throws
  wait: typeof wait
}) => void | Promise<void>

interface Params {
  a11y?: boolean
  headers?: Record<string, string>
  scale?: Scale
  styles?: string
  timeout?: number
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
// Story file discovery
function globStories(cwd: string): Promise<string[]>

// Build artifacts generation
function getStoryArtifacts(
  cwd: string, 
  entrypoints: string[]
): Promise<BuildArtifact[]>

// Route creation
function createStoryRoute(config: { 
  storyFile: string
  exportName: string 
}): string

// Workshop setup
function getWorkshop(config: {
  cwd: string
  streamURL: `/${string}`
  getHTMLResponse?: GetHTMLResponse
}): Promise<{
  stories: [string, TestParams][]
  responses: Map<string, Response>
}>

// Story response mapping
function mapStoryResponses(config: {
  entries: string[]
  responses: Map<string, Response>
  cwd: string
  streamURL: `/${string}`
  libraryImportMap: Record<string, string>
  getHTMLResponse: GetHTMLResponse
}): Promise<[string, TestParams][]>

// Library management
function getLibrary(): Promise<{
  libraryArtifacts: BuildArtifact[]
  libraryImportMap: Record<string, string>
}>

// HTML response generator type
type GetHTMLResponse = (params: {
  story: StoryObj
  route: string
  responses: Map<string, Response>
  storyFile: string
  exportName: string
  streamURL: `/${string}`
  libraryImportMap: Record<string, string>
}) => TestParams
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
