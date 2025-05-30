# Plaited API Guide

This guide provides a comprehensive reference for all public APIs exported by Plaited's modules.

## Core Module (`plaited`)

### Web Component APIs

#### `defineElement(config)`

Creates a custom web component with behavioral programming support.

```ts
import type { CustomElementTag, TemplateObject } from 'plaited/jsx-runtime';
import type { PlaitedElement, PlaitedHandlers, PlaitedElementCallbackHandlers, BProgramArgs } from 'plaited';

type DefineElementArgs<A extends PlaitedHandlers> = {
  tag: CustomElementTag;             // Custom element tag name (required)
  shadowDom: TemplateObject;       // Shadow DOM template (required)
  mode?: 'open' | 'closed';        // Shadow DOM mode (default: 'open')
  delegatesFocus?: boolean;        // Delegate focus to shadow DOM (default: true)
  slotAssignment?: 'named' | 'manual'; // Slot assignment mode (default: 'named')
  observedAttributes?: string[];   // Attributes to observe (default: [])
  formAssociated?: true;           // Enable form association
  streamAssociated?: true;         // Enable stream association with light DOM
  publicEvents?: string[];         // Events exposed via host.trigger (default: [])
  bProgram?: (
    this: PlaitedElement,
    args: BProgramArgs
  ) => A & PlaitedElementCallbackHandlers; // Behavioral program function
};
```

#### `defineWorker(config)`

Creates a type-safe web worker with behavioral programming. This function is called _inside_ the worker script.

```ts
import type { Handlers, Disconnect, DefineBProgramProps, BPEvent } from 'plaited/behavioral';

type WorkerContext = {
  send(data: BPEvent): void; // Function to send messages from the worker
  disconnect: Disconnect;    // Function to disconnect the worker's bProgram
};

function defineWorker<A extends Handlers>(config: {
  publicEvents: string[]; // Event types the worker will listen for from the main thread
  bProgram: (args: DefineBProgramProps & WorkerContext) => A; // Worker's behavioral program
}): void; // defineWorker sets up the worker, it does not return a constructor
```

#### `useWorker(trigger, path)`

Integrates web workers with Plaited components, returning a function to send messages to the worker.

```ts
import type { Trigger, PlaitedTrigger, BPEvent } from 'plaited/behavioral';

function useWorker(
  trigger: Trigger | PlaitedTrigger, // Component's trigger to handle worker responses
  path: string                       // Path to the worker script
): ((args: BPEvent<unknown>) => void) & { disconnect: () => void };
```

#### `useTemplate(el, callback)`

Creates a template factory function for efficient dynamic content generation with dynamic data binding.

```ts
import type { BoundElement, SelectorMatch } from 'plaited';

function useTemplate<T>(
  el: BoundElement<HTMLTemplateElement>, // The <template> element with p-target
  callback: (
    $: <E extends Element = Element>( // Scoped query selector for the template instance
      target: string,
      match?: SelectorMatch
    ) => NodeListOf<BoundElement<E>>,
    data: T // Data to populate the template instance
  ) => void
): (data: T) => DocumentFragment; // Returns a function that takes data and returns a DocumentFragment
```

#### `useDispatch(element)`

Creates a typed event dispatcher for a Plaited element.

```ts
import type { PlaitedElement } from 'plaited';
import type { BPEvent } from 'plaited/behavioral';

type Dispatch = <T = unknown>(
  args: BPEvent<T> & { // BPEvent is { type: string, detail?: T }
    bubbles?: boolean;    // Default: false
    cancelable?: boolean; // Default: true
    composed?: boolean;   // Default: true for events to cross shadow DOM boundaries
  },
) => void;

function useDispatch(element: PlaitedElement): Dispatch;
```

#### `useSignal(initialValue)`

Creates reactive state with automatic updates.

```ts
import type { Trigger, PlaitedTrigger, Disconnect } from 'plaited/behavioral';

// Overload for signal with an initial value
function useSignal<T>(
  initialValue: T
): {
  get(): T;
  set(newValue: T): void;
  listen(eventType: string, trigger: Trigger | PlaitedTrigger, getLVC?: boolean): Disconnect;
};

// Overload for signal without an initial value (starts as undefined)
function useSignal<T>(): {
  get(): T | undefined;
  set(newValue?: T): void;
  listen(eventType: string, trigger: Trigger | PlaitedTrigger, getLVC?: boolean): Disconnect;
};
```

#### `useComputed(computeFn, dependencies)`

Creates a reactive computed signal that derives its value from other signals.

```ts
import type { Trigger, PlaitedTrigger, Disconnect } from 'plaited/behavioral';
import type { useSignal } from 'plaited'; // Assuming useSignal is the primary signal type

// Type for the return value of useSignal or another useComputed
type SignalLike<T> = {
  get(): T;
  listen(eventType: string, trigger: Trigger | PlaitedTrigger, getLVC?: boolean): Disconnect;
};

function useComputed<T>(
  computeFn: () => T,      // Function to compute the derived value
  dependencies: SignalLike<any>[] // Array of signals this computed value depends on
): {
  get(): T;                 // Get the current computed value
  listen(
    eventType: string,
    trigger: Trigger | PlaitedTrigger,
    getLVC?: boolean
  ): Disconnect;           // Listen for changes to the computed value
};
```

#### `useAttributesObserver(eventType, trigger)`

Creates an attribute observer factory for elements. This is a higher-order function.

```ts
import type { Trigger, PlaitedTrigger, Disconnect } from 'plaited/behavioral';
import type { ObservedAttributesDetail } from 'plaited'; // { name: string, oldValue: string|null, newValue: string|null }

function useAttributesObserver(
  eventType: string, // Event type to dispatch when an attribute changes
  trigger: Trigger | PlaitedTrigger // Trigger to dispatch the event
): (
  assignedElement: Element, // Element to observe
  attributeFilter: string[] // Attributes to observe
) => Disconnect; // Returns a disconnect function for the observer
```

### Type Guards

```ts
import type { Trigger, PlaitedTrigger, BPEvent } from 'plaited/behavioral';
import type { PlaitedElement, PlaitedTemplate, PlaitedMessage, FunctionTemplate } from 'plaited';

isPlaitedElement(value: unknown): value is PlaitedElement;
isPlaitedTrigger(trigger: Trigger): trigger is PlaitedTrigger; // Takes Trigger, not unknown
isPlaitedMessage(msg: unknown): msg is PlaitedMessage; // msg is PlaitedMessage, not PlaitedMessage<any>
isPlaitedTemplateFunction(template: FunctionTemplate): template is PlaitedTemplate; // Takes FunctionTemplate
```

### `BProgramArgs` (for `defineElement`'s `bProgram` callback)

Arguments passed to the `bProgram` function in `defineElement`.

```ts
import type {
  PlaitedElement, PlaitedTrigger, BThreads, UseSnapshot, BThread, BSync,
  SelectorMatch, BoundElement
} from 'plaited'; // Assuming these types are correctly exported or aliased in plaited's main export

type BProgramArgs = {
  /** Query selector scoped to the component's shadow root. Uses `p-target` values. */
  $: <E extends Element = Element>(
    target: string,
    match?: SelectorMatch
  ) => NodeListOf<BoundElement<E>>;
  /** Reference to the component's shadow root. */
  root: ShadowRoot;
  /** Reference to the custom element instance itself. */
  host: PlaitedElement;
  /** ElementInternals instance (only if `formAssociated: true`). */
  internals: ElementInternals;
  /** Trigger for dispatching events within the component's bProgram. Manages cleanup. */
  trigger: PlaitedTrigger;
  /** Interface for managing behavioral threads. */
  bThreads: BThreads;
  /** Hook to get the current state snapshot of the bProgram. */
  useSnapshot: UseSnapshot;
  /** Factory for creating behavioral threads. */
  bThread: BThread;
  /** Factory for defining synchronization points. */
  bSync: BSync;
};
```

### JSX Exports

Plaited re-exports core JSX functionalities from `plaited/jsx-runtime` for convenience.

#### `h(tag, attrs)`

Alias for `createTemplate`. This is the JSX factory function used when `jsxImportSource` is set to "plaited".

```ts
import type { TemplateObject, Attrs, FunctionTemplate, CustomElementTag } from 'plaited/jsx-runtime';

type Tag = string | CustomElementTag | FunctionTemplate;

type InferAttrs<T extends Tag> =
  T extends keyof ElementAttributeList ? ElementAttributeList[T]
  : T extends FunctionTemplate ? Parameters<T>[0]
  : T extends CustomElementTag ? DetailedHTMLAttributes
  : Attrs;

function h<T extends Tag>(tag: T, attrs: InferAttrs<T>): TemplateObject;
```

#### `Fragment(props)`

A component that allows grouping children without adding an extra DOM node.

```ts
import type { TemplateObject, Attrs } from 'plaited/jsx-runtime';

function Fragment(props: Attrs): TemplateObject; // Primarily uses props.children
```

### Server-Side Rendering

#### `ssr(...templates)`

Serializes Plaited template objects into an HTML string, primarily for server-side rendering or static site generation.

```ts
import type { TemplateObject } from 'plaited/jsx-runtime';

function ssr(...templates: TemplateObject[]): string;
```

## Behavioral Module (`plaited/behavioral`)

### Core Functions

#### `bProgram()`

Creates a behavioral program instance.

```ts
import type { BThreads, Trigger, UseFeedback, UseSnapshot } from 'plaited/behavioral';

function bProgram(): Readonly<{ // Returns a Readonly object
  bThreads: BThreads;
  trigger: Trigger;
  useFeedback: UseFeedback;
  useSnapshot: UseSnapshot;
}>;
```

#### `bThread(rules, [repeat])`

Creates a behavioral thread from generator functions.

```ts
import type { Idioms, RulesFunction, Repeat } from 'plaited/behavioral';
// type Repeat = true | (() => boolean);
// type RulesFunction = () => Generator<Idioms, void, undefined>; // undefined for the final 'next' value

function bThread(
  rules: RulesFunction[],
  repeat?: Repeat
): RulesFunction;
```

#### `bSync(idioms)`

Creates a synchronization point (a single-step `RulesFunction`).

```ts
import type { BPEvent, BPEventTemplate, BPListener, Idioms, RulesFunction } from 'plaited/behavioral';

// type BPListener<T = unknown> = string | ((args: { type: string; detail: T }) => boolean);
// type BPEvent<T = unknown> = { type: string; detail?: T }; // detail is optional
// type BPEventTemplate<T = unknown> = () => BPEvent<T>; // Takes no arguments

// Idioms allows array for waitFor, block, interrupt
// type Idioms<T = unknown> = {
//   request?: BPEvent<T> | BPEventTemplate<T>;
//   waitFor?: BPListener<T> | BPListener<T>[];
//   block?: BPListener<T> | BPListener<T>[];
//   interrupt?: BPListener<T> | BPListener<T>[];
// };

function bSync<T = unknown>(idioms: Idioms<T>): RulesFunction;
```

#### `defineBProgram(config)`

Creates a reusable behavioral program module with managed lifecycle.

```ts
import type {
  Handlers, DefineBProgramProps as CoreBProgramProps, Disconnect, Trigger, PlaitedTrigger
} from 'plaited/behavioral'; // DefineBProgramProps is specific to defineBProgram's callback

// DefineBProgramProps for the callback (from behavioral/define-b-program.ts)
// export type DefineBProgramProps = {
//   bSync: BSync;
//   bThread: BThread;
//   bThreads: BThreads;
//   trigger: PlaitedTrigger; // This is the enhanced trigger
//   useSnapshot: UseSnapshot;
// };

// Callback type
// type BProgramCallback<A extends Handlers, C extends Record<string, unknown>> =
//  (props: DefineBProgramProps & C) => A;

// Type of the returned initializer function
// type BProgramInitializer<C extends Record<string, unknown>> = ((ctx?: C) => Trigger) & {
//   addDisconnectCallback: (cb: Disconnect) => void;
// };

function defineBProgram<
  A extends Handlers = Handlers,
  C extends Record<string, unknown> = Record<string, unknown>
>(config: {
  publicEvents?: string[]; // Events triggerable on the returned public trigger
  disconnectSet?: Set<Disconnect>; // Optional: for external cleanup management
  bProgram: (props: CoreBProgramProps & C) => A; // The behavioral program logic
}): ((ctx?: C) => Trigger) & { addDisconnectCallback: (cb: Disconnect) => void };
```

### Utility Functions

```ts
import type { BPEvent, RulesFunction, Trigger, PlaitedTrigger, Disconnect } from 'plaited/behavioral';

// randomEvent: T defaults to unknown
randomEvent<T = unknown>(...events: BPEvent<T>[]): BPEvent<T>;

// shuffleSyncs: Takes RulesFunction[], not BSync[] directly. But BSync output is RulesFunction.
shuffleSyncs(...syncs: RulesFunction[]): RulesFunction[];

getPublicTrigger(args: {
  trigger: Trigger;
  publicEvents?: string[] | ReadonlyArray<string>;
}): Trigger;

// getPlaitedTrigger: No generics for T.
getPlaitedTrigger(
  trigger: Trigger,
  disconnectSet: Set<Disconnect> // disconnectSet instead of cleanupFns
): PlaitedTrigger;
```

### Behavioral Type Guards

```ts
import type { BPEvent } from 'plaited/behavioral';

isBPEvent<T = unknown>(event: unknown): event is BPEvent<T>;
```

## Styling Module (`plaited/styling`)

### CSS-in-JS

#### `css.create(styles)`

Creates scoped styles with type safety. `styles` is an object where keys are logical class group names.

```ts
import { css } from 'plaited/styling';
// type CSSClasses = { [key: string]: { [key in keyof CSSProperties]: CSSProperties[key] | CreateNestedCSS<key> | string } }
// Returns StyleObjects<T>

const styles = css.create({
  myClassName: { // Key 'myClassName' becomes part of the generated class, e.g., myClassName_abc
    display: 'flex',
    padding: { // Nested property values for responsive/conditional styles
      default: '10px',
      '@media (min-width: 768px)': '20px'
    },
    backgroundColor: {
      default: '#fff',
      ':hover': '#f0f0f0', // Pseudo-class
      '[data-theme="dark"]': '#222' // Attribute selector
    }
  }
});
// Access: styles.myClassName.class, styles.myClassName.stylesheet
```

#### `css.host(styles)`

Styles the host element in shadow DOM. `styles` is `CSSHostProperties`.

```ts
import { css } from 'plaited/styling';
// type CSSHostProperties = { [key in keyof CSSProperties]: CSSProperties[key] | CreateHostCSSWithSelector<key> }
// Returns StylesObject (class will be undefined, stylesheet will contain :host rules)

const hostStyles = css.host({
  display: 'block',
  width: '100%',
  border: { // Conditional host styles
    default: '1px solid gray',
    ':hover': '1px solid black',
    '[focused]': '2px solid blue',
  }
});
```

#### `css.keyframes(name, frames)`

Defines CSS animations. Returns a function that generates the `StylesObject` and has an `id` property.

```ts
import { css } from 'plaited/styling';
// type CSSKeyFrames = { from?: CSSProperties; to?: CSSProperties; [key: `${number}%`]: CSSProperties; }
// Returns (() => StylesObject) & { id: string }

const fadeIn = css.keyframes('fadeIn', {
  from: { opacity: 0 },
  to: { opacity: 1 }
});
// fadeIn.id contains the generated animation name, e.g., "fadeIn_xyz"
// fadeIn() returns { stylesheet: ["@keyframes fadeIn_xyz {...}"] }
```

#### `css.assign(...styles)`

Combines multiple style objects. Ignores falsy values.

```ts
import { css } from 'plaited/styling';
// Takes ...styleObjects: Array<StylesObject | undefined | false | null>
// Returns StylesObject

const baseStyles = css.create({ base: { color: 'black' } });
const activeStyles = css.create({ active: { fontWeight: 'bold' } });
const isActive = true;

const combined = css.assign(
  baseStyles.base,
  isActive && activeStyles.active // Conditionally include activeStyles.active
  // fadeIn() // if fadeIn is from css.keyframes, it should be fadeIn() to get the StylesObject
);
// combined.class will be "base_abc p123 active_def p456" (if isActive)
// combined.stylesheet will contain rules for both
```

### Design Tokens

#### Design Token Types

Defines the structure and allowed values for design tokens used within Plaited.

```ts
// Template literal type representing a reference to another design token (e.g., '{colors.primary}')
type Alias = `{${string}}`;

// Basic value types for tokens
type DefaultValue = string | number | Alias | (string | number | Alias)[];
type AmountValue = number | `${number}%` | Alias; // Numeric or percentage values, or alias
type AngleValue = `${number}deg` | `${number}grad` | `${number}rad` | `${number}turn` | Alias;

// Color value definition
type ColorValue = {
  l?: AmountValue; c?: AmountValue; h?: number | AngleValue; a?: AmountValue;
} | `#${string}` | 'transparent' | Alias;

// Size measurements
type SizeValue = `${number}%` | `${number}px` | `${number}rem` | Alias | (`${number}%` | `${number}px` | `${number}rem` | Alias)[];

// CSS function definitions
type FunctionValue = { function: string; arguments: DefaultValue; } | Alias;

// Composite tokens combining multiple token references
type CompositeValue = { [key: string]: Alias } | Alias;

// Union of all possible design token value types
type DesignValue = DefaultValue | ColorValue | SizeValue | FunctionValue | CompositeValue;

// Media query definitions
type MediaQueries = Map<`@${string}`, string>;
type DefaultMediaQueries = { colorScheme?: '@light' | '@dark'; screen?: `@${string}`; };

// Responsive value definition for design tokens
type MediaValue<V extends DesignValue = DesignValue> = { [key: `@${string}`]: V };

// Base structure for all design tokens
type BaseToken<V extends DesignValue, T = undefined> = {
  $description: string;
  $csv?: boolean; // If value is an array, should it be comma-separated in CSS?
  $value: V | MediaValue<V>;
} & (T extends undefined ? { $type?: never } : { $type: T });

// Specific token types
type DefaultToken = BaseToken<DefaultValue>;
type AmountToken = BaseToken<AmountValue, 'amount'>;
type AngleToken = BaseToken<AngleValue, 'angle'>;
type ColorToken = BaseToken<ColorValue, 'color'>;
type SizeToken = BaseToken<SizeValue, 'size'>;
type FunctionToken = BaseToken<FunctionValue, 'function'>;
type CompositeToken = {
  $description: string;
  $type: 'composite';
  $value: CompositeValue;
};

// Union of all possible token types
type DesignToken = DefaultToken | AmountToken | AngleToken | ColorToken | SizeToken | FunctionToken | CompositeToken;

// Hierarchical structure for organizing design tokens
type DesignTokenGroup = { [key: string]: DesignTokenGroup | DesignToken };

// Extended token type with resolution and dependency information (used internally by TransformDesignTokens)
type DesignTokenEntry = DesignToken & {
  dependencies: Alias[];
  dependents: Alias[];
  exportName?: string;
  ts?: string;
  cssVar?: string;
  css?: string;
};
```

#### `TransformDesignTokens`

Transforms design tokens to CSS variables and TypeScript.

```ts
import type {
  DesignTokenGroup, Alias, DesignTokenEntry,
  MediaQueries, DefaultMediaQueries
} from 'plaited/styling';

class TransformDesignTokens {
  constructor(options: {
    tokens: DesignTokenGroup; // Instead of DesignTokensMap
    tokenPrefix?: string;     // Default 'pl'
    mediaQueries?: MediaQueries;
    defaultMediaQueries?: DefaultMediaQueries;
    // tokenCase is not an option in source
  });

  get css(): string;                   // CSS custom properties string
  get ts(): string;                    // TypeScript constants string
  get entries(): Array<[Alias, DesignTokenEntry]>; // All token entries

  has(alias: Alias): boolean;         // Check if token exists by Alias
  get(alias: Alias): DesignTokenEntry | undefined;  // Get specific token entry by Alias
  filter(
    callback: (
      entry: [Alias, DesignTokenEntry],
      index: number,
      arr: [Alias, DesignTokenEntry][]
    ) => boolean
  ): Array<[Alias, DesignTokenEntry]>;
}
```

#### `getDesignTokensElement(stylesheet, tag)`

Creates a custom element template for token injection.

```ts
import type { CustomElementTag, PlaitedTemplate } from 'plaited';

function getDesignTokensElement(
  stylesheet: string, // Changed from css to stylesheet for clarity
  tag?: CustomElementTag // tag is optional, defaults to 'design-tokens'
): PlaitedTemplate; // Returns PlaitedTemplate, not CustomElementConstructor
```

#### `getDesignTokensSchema(tokens)`

Generates JSON schema for token validation.

```ts
import type { DesignTokenGroup } from 'plaited/styling';

function getDesignTokensSchema<T extends DesignTokenGroup = DesignTokenGroup>(
  tokens: T // Takes DesignTokenGroup
): object;
```

## Testing Module (`plaited/testing`)

### Assertion and Testing

#### `assert(params)`

Type-safe test assertions.

```ts
type AssertParams<T> = {
  given: string;      // Test context
  should: string;     // Expected behavior
  actual: T;          // Actual value
  expected: T;        // Expected value
};

function assert<T>(params: AssertParams<T>): void;
```

#### `findByText(searchText, [context])`

Finds elements by text content. Context defaults to `document.body`.

```ts
function findByText<T extends HTMLElement = HTMLElement>(
  searchText: string | RegExp,
  context?: HTMLElement // Defaults to document.body
): Promise<T | undefined>;
```

#### `findByAttribute(attribute, value, [context])`

Finds elements by attribute. Context defaults to `document`.

```ts
function findByAttribute<T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
  attributeName: string, // Renamed from attribute
  attributeValue: string | RegExp, // Renamed from value, can be RegExp
  context?: HTMLElement | SVGElement // Defaults to document
): Promise<T | undefined>;
```

#### `fireEvent(element, eventType, [eventArgs])`

Simulates DOM events.

```ts
type EventArguments = {
  bubbles?: boolean;    // Default true
  composed?: boolean;   // Default true
  cancelable?: boolean; // Default true
  detail?: Record<string, unknown>; // For CustomEvent
};

function fireEvent<T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
  element: T,
  eventName: string, // Renamed from eventType
  options?: EventArguments // Renamed from eventArgs. Defaults: bubbles/composed/cancelable all true
): Promise<void>;
```

#### `throws(fn, ...args)`

Asserts that a function throws. Returns the error message as a string or undefined.

```ts
// The guide's expectedError parameter is not how the source 'throws' works.
// 'throws' executes fn(...args) and returns error.toString() or undefined.
function throws<U extends unknown[], V>(
  fn: (...args: U) => V, // Function to test
  ...args: U              // Arguments for the function
): string | undefined | Promise<string | undefined>; // Returns error message or undefined
```

#### `match(str)`

Pattern matching for flexible assertions. This is a higher-order function.

```ts
// The guide's example for match({ object: match.shape(...) }) is incorrect for the provided 'match' utility.
// The actual 'match' utility is simpler:
function match(str: string): (pattern: string | RegExp) => string;

// Example:
// const textMatcher = match("Hello world, 123!");
// const worldMatch = textMatcher("world"); // "world"
// const numberMatch = textMatcher(/\d+/); // "123"
```

### Story Testing

#### Story Types

```ts
import type { Attrs, FunctionTemplate } from 'plaited/jsx-runtime'; // Assuming Attrs is from jsx
import type { Scale, StylesObject, Play } from 'plaited/testing'; // Assuming these are exported

// Play function type (from assert.types.ts)
// type Play = (utils: { /* ...testing utilities... */ }) => Promise<void>;

// Params type (from assert.types.ts)
type Params = {
  a11y?: Record<string, string> | false; // Changed from boolean
  headers?: (env: NodeJS.ProcessEnv) => Headers; // Added from source
  scale?: Scale;
  styles?: StylesObject; // Changed from string
  timeout?: number; // Default is 5000ms
};

// Base for story objects
interface BaseStoryObj<T extends Attrs = Attrs> {
  args?: T; // Should be Attrs or T if T extends Attrs.
  description: string;
  parameters?: Params;
  template?: FunctionTemplate<T>; // Use FunctionTemplate
}

// Story with mandatory play function
interface PlayStoryObj<T extends Attrs = Attrs> extends BaseStoryObj<T> {
  play: Play;
}

// Story with optional play function
interface TemplateStoryObj<T extends Attrs = Attrs> extends BaseStoryObj<T> {
  play?: Play;
}

type StoryObj<T extends Attrs =
 Attrs> = PlayStoryObj<T> | TemplateStoryObj<T>;
```

#### `PlaitedFixture`

Test fixture custom element for story runners. Attributes `p-socket`, `p-route`, `p-file`, `p-entry`, `p-name`.

```html
<plaited-test-fixture
  p-socket="/_plaited"
  p-route="component--story"
  p-file="src/component.stories.ts"
  p-entry="/dist/component.stories.js"
  p-name="StoryName"
>
  <!-- Story content is rendered here by the fixture -->
</plaited-test-fixture>
```

### Error Classes

```ts
class AssertionError extends Error {}
class MissingTestParamsError extends Error {}
class TimeoutError extends Error {}
```

## Utilities Module (`plaited/utils`)

### Type Checking

```ts
isTypeOf<T>(value: unknown, type: string): value is T;
trueTypeOf(value: unknown): string;
```

### DOM Utilities

```ts
canUseDOM(): boolean;
ueid(prefix?: string): string;  // ueid takes an optional prefix
```

### String Manipulation

```ts
escape(str: string): string;
unescape(str: string): string;
hashString(str: string): number | null;  // Returns null for empty strings

// Case conversion
camelCase(str: string): string;
kebabCase(str: string): string;
```

### Data Structures

```ts
deepEqual(a: unknown, b: unknown): boolean;
// keyMirror: Keys should be string[]
keyMirror<Keys extends string[]>(...inputs: Keys): Readonly<{ [K in Keys[number]]: K }>;
```

### Event Handling

```ts
// DelegatedListener constructor takes a callback that can be async
class DelegatedListener<T extends Event = Event> {
  constructor(callback: (ev: T) => void | Promise<void>);
  handleEvent(evt: T): void;
}

// Global delegate storage: WeakMap<EventTarget, DelegatedListener> is a more direct representation of use
// The Map<string, DelegatedListener> might be an internal detail of how multiple event types are handled by one listener instance
const delegates: WeakMap<EventTarget, DelegatedListener>;
```

### Async Utilities

```ts
wait(ms: number): Promise<unknown>; // Returns Promise<unknown>, not Promise<void>
```

### Other Utilities

```ts
noop<T = never>(...args: T[]): void; // Parameter name changed from _ to args for clarity
```

## Workshop Module (`plaited/workshop`)

Internal tools for the Plaited development and testing workshop.

```ts
import type { StoryObj, TestParams } from 'plaited/testing';
import type { Response } from 'bun'; // Assuming Bun's Response type

// BuildArtifact type is not defined in provided sources, assumed internal structure
type BuildArtifact = { path: string; text: () => Promise<string>; /* ... other properties */ };

// Story file discovery
function globStories(cwd: string): Promise<string[]>;

// Build artifacts generation
function getStoryArtifacts(
  cwd: string,
  entrypoints: string[]
): Promise<BuildArtifact[]>;

// Route creation
function createStoryRoute(config: {
  storyFile: string;
  exportName: string;
}): string;

// Type for HTML response generator function (from default-get-html-responses.tsx)
type GetHTMLResponse = (params: {
  story: StoryObj;
  route: string;
  responses: Map<string, Response>;
  storyFile: string;
  exportName: string;
  streamURL: `/${string}`;
  libraryImportMap: Record<string, string>;
}) => TestParams;

// Workshop setup
function getWorkshop(config: {
  cwd: string;
  streamURL: `/${string}`;
  getHTMLResponse?: GetHTMLResponse; // Optional
}): Promise<{
  stories: [string, TestParams][];
  responses: Map<string, Response>;
}>;

// Story response mapping
function mapStoryResponses(config: {
  entries: string[];
  responses: Map<string, Response>;
  cwd: string;
  streamURL: `/${string}`;
  libraryImportMap: Record<string, string>;
  getHTMLResponse: GetHTMLResponse;
}): Promise<[string, TestParams][]>;

// Library management
function getLibrary(): Promise<{
  libraryArtifacts: BuildArtifact[];
  libraryImportMap: Record<string, string>;
}>;
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
```