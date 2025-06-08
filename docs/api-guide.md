# Plaited API Guide

This guide provides a comprehensive overview of the Plaited framework's public API, organized by module.

## Core Module (`plaited`)

The main module providing core functionalities for creating web components and managing their behavior.

### Web Component APIs

#### `defineElement(config)`

Defines and registers a Plaited custom element.

```ts
<A extends PlaitedHandlers>(config: DefineElementArgs<A>): PlaitedTemplate
```

-   `config`: A `DefineElementArgs` object specifying the element's configuration.
-   Returns: A `PlaitedTemplate` function that can be used to create instances of the custom element in JSX.

**`DefineElementArgs<A extends PlaitedHandlers>`**

An object with the following properties:

```ts
type DefineElementArgs<A extends PlaitedHandlers> = {
  tag: CustomElementTag; // The tag name for the custom element (e.g., 'my-element'). Must contain a hyphen.
  shadowDom: TemplateObject; // The Plaited template object defining the element's shadow DOM structure.
  delegatesFocus?: boolean; // If true (default), focus requests on the host are delegated to its shadow DOM.
  mode?: 'open' | 'closed'; // Shadow DOM encapsulation mode (default: 'open').
  slotAssignment?: 'named' | 'manual'; // Slot assignment mode (default: 'named').
  observedAttributes?: string[]; // Attributes to observe for changes.
  publicEvents?: string[]; // Event types allowed to be triggered externally on the component.
  formAssociated?: true; // If true, registers as a Form-Associated Custom Element.
  streamAssociated?: true; // If true, enables stream-based Light DOM (Slot) mutation handlers.
  bProgram?: (
    this: PlaitedElement,
    args: BProgramArgs
  ) => A & PlaitedElementCallbackHandlers; // Behavioral program function.
};
```

**`PlaitedElementCallbackHandlers`** (within `bProgram`'s return value)

An object mapping lifecycle and form-associated callbacks to their handlers:

```ts
type PlaitedElementCallbackHandlers = {
  onAdopted?: () => void | Promise<void>;
  onAttributeChanged?: (args: { name: string, oldValue: string | null, newValue: string | null }) => void | Promise<void>;
  onConnected?: () => void | Promise<void>;
  onDisconnected?: () => void | Promise<void>;
  onFormAssociated?: (args: { form: HTMLFormElement }) => void | Promise<void>;
  onFormDisabled?: (args: { disabled: boolean }) => void | Promise<void>;
  onFormReset?: () => void | Promise<void>;
  onFormStateRestore?: (args: { state: unknown, reason: 'autocomplete' | 'restore' }) => void | Promise<void>;
  // Note: onAppend, onPrepend, onReplaceChildren are handled internally if streamAssociated is true.
};
```

#### `defineWorker(config)`

Creates a behavioral program worker for background processing. Typically used in a separate worker file.

```ts
<A extends Handlers>(config: {
  publicEvents: string[];
  bProgram: (args: DefineBProgramProps & WorkerContext) => A;
}): void
```

-   `config.publicEvents`: An array of event types allowed to be received by the worker.
-   `config.bProgram`: A function defining the worker's behavior and event handlers.

**`WorkerContext`** (provided to worker's `bProgram`)

```ts
type WorkerContext = {
  send(data: BPEvent): void; // Function to send messages from the worker.
  disconnect: Disconnect;    // Function to clean up worker resources.
};
```

#### `useWorker(trigger, path)`

Creates an interface for communicating with a Web Worker from a Plaited web component's `bProgram`.

```ts
(trigger: PlaitedTrigger | Trigger, path: string): ((args: BPEvent<T>) => void) & { disconnect: () => void }
```

-   `trigger`: The component's trigger function for handling worker responses.
-   `path`: The path to the worker module file.
-   Returns: An enhanced `postMessage`-like function to send messages to the worker. This function also has a `disconnect` method to terminate the worker and clean up listeners. If used with a PlaitedTrigger it auto disconnect when the PlaiteElement or module unmounts or disconnects itself.

#### `useTemplate(el, callback)`

Creates a template factory function for efficient dynamic content generation within a Plaited component.

```ts
<T>(
  el: BoundElement<HTMLTemplateElement>,
  callback: (
    $: <E extends Element = Element>(target: string, match?: SelectorMatch) => BoundElement<E>[],
    data: T
  ) => void
): (data: T) => DocumentFragment
```

-   `el`: A `BoundElement<HTMLTemplateElement>` (obtained via the `$` query function) to be used as the template.
-   `callback`: A function called for each data item to populate a cloned instance of the template.
    -   `$`: A query selector function scoped to the cloned template instance.
    -   `data`: The data item of type `T` for the current template instance.
-   Returns: A factory function that takes a data item of type `T` and returns a populated `DocumentFragment`.

#### `useDispatch(element)`

Creates an event dispatch function for a Plaited element, enabling component-to-component communication.

```ts
<T = unknown>(element: PlaitedElement): (args: BPEvent<T> & {
  bubbles?: boolean;
  cancelable?: boolean;
  composed?: boolean;
}) => void
```

-   `element`: The `PlaitedElement` instance from which events will be dispatched.
-   Returns: A `Dispatch` function to create and send custom events.
    -   `args.type`: The event type/name.
    -   `args.detail`: Optional event-specific data.
    -   `args.bubbles` (default: `false`): Whether the event bubbles.
    -   `args.cancelable` (default: `true`): Whether the event can be canceled.
    *   `args.composed` (default: `true`): Whether the event crosses shadow DOM boundaries.

#### `useSignal(initialValue?)`

Creates a reactive signal for state management.

```ts
// With initial value
function useSignal<T>(initialValue: T): {
  set(value: T): void;
  listen: Listen;
  get(): T;
}

// Without initial value
function useSignal<T>(initialValue?: never): {
  set(value?: T): void;
  listen: Listen;
  get(): T | undefined;
}
```

-   `initialValue`: Optional initial value for the signal.
-   Returns an object with:
    -   `get()`: Returns the current value of the signal.
    -   `set(value)`: Sets the signal's value and notifies listeners.
    -   `listen(eventType, trigger, getLVC?)`: Subscribes to signal changes.
        -   `eventType`: The event type to dispatch when the signal changes.
        -   `trigger`: The component's trigger function.
        -   `getLVC?` (default: `false`): If `true`, immediately triggers with the current value upon listening.
        -   Returns a `Disconnect` function to unsubscribe.

#### `useComputed(computeFn, dependencies)`

Creates a computed signal that automatically updates based on its dependencies.

```ts
<T>(
  computeFn: () => T,
  dependencies: (SignalWithInitialValue<unknown> | SignalWithoutInitialValue<unknown>)[]
): {
  get(): T;
  listen: Listen;
}
```

-   `computeFn`: A function that calculates the derived value.
-   `dependencies`: An array of `useSignal` instances that this computation depends on.
-   Returns an object with:
    -   `get()`: Returns the current computed value.
    -   `listen(eventType, trigger, getLVC?)`: Subscribes to changes in the computed value. (See `useSignal` for `listen` parameters).

**`SignalLike` (Type for `useComputed` dependencies)**

```ts
type SignalLike = {
  listen: Listen;
  get: () => unknown;
}
```

#### `useAttributesObserver(eventType, trigger)`

Creates a utility to observe attribute changes on a slotted element.

```ts
(
  eventType: string,
  trigger: PlaitedTrigger | Trigger
): (assignedElement: Element, attributeFilter: string[]) => Disconnect
```

-   `eventType`: The event type to dispatch when an observed attribute changes.
-   `trigger`: The component's trigger function.
-   Returns: A function that, when called with an `assignedElement` and an `attributeFilter` array, starts the observation and returns a `Disconnect` function to stop it.

**`ObservedAttributesDetail`** (Event detail for attribute changes)

```ts
type ObservedAttributesDetail = {
  oldValue: null | string;
  newValue: null | string;
  name: string;
};
```

### Type Guards

Utilities for runtime type checking of Plaited-specific objects.

-   **`isPlaitedMessage(msg: unknown): msg is PlaitedMessage`**
    Checks if a value conforms to the `PlaitedMessage` structure.
-   **`isPlaitedElement(el: unknown): el is PlaitedElement`**
    Checks if an element is a Plaited custom element (has a `trigger` method).
-   **`isPlaitedTemplateFunction(template: FunctionTemplate): template is PlaitedTemplate`**
    Checks if a function template was created by `defineElement`.

### `BProgramArgs` (for `defineElement`'s `bProgram` callback)

The argument object passed to the `bProgram` function when defining a Plaited element.

```ts
type BProgramArgs = {
  $: <E extends Element = Element>(
    target: string,
    match?: SelectorMatch, // e.g., '=', '*=', '^='
  ) => NodeListOf<BoundElement<E>>; // Scoped query selector for shadow DOM
  root: ShadowRoot; // Reference to the component's shadow root
  host: PlaitedElement; // Reference to the custom element instance
  internals: ElementInternals; // ElementInternals instance (if formAssociated: true)
  trigger: PlaitedTrigger; // Enhanced trigger function for the component's bProgram
  bThreads: BThreads; // Interface for managing behavioral threads
  useSnapshot: UseSnapshot; // Function to get bProgram state snapshot
  bThread: BThread; // Utility to create behavioral threads
  bSync: BSync; // Utility to define synchronization points
};
```

### JSX Exports

Plaited provides standard JSX factory functions and a `Fragment` component.

#### `h(tag, attrs)` (alias for `jsx`, `jsxs`, `jsxDEV`)

The core JSX factory function.

```ts
<T extends Tag>(tag: T, attrs: InferAttrs<T>): TemplateObject
```

-   `tag`: An HTML/SVG tag name (string), a `CustomElementTag`, or a `FunctionTemplate`.
-   `attrs`: An object containing attributes/props for the element, including `children`.
-   Returns: A `TemplateObject`.

**`Tag`** (Type for `h` function's first argument)

```ts
type Tag = string | CustomElementTag | FunctionTemplate;
```

**`InferAttrs<T extends Tag>`** (Utility to infer attributes type based on tag)

```ts
type InferAttrs<T extends Tag> =
  T extends keyof ElementAttributeList ? ElementAttributeList[T]
  : T extends FunctionTemplate ? Parameters<T>[0]
  : T extends CustomElementTag ? DetailedHTMLAttributes
  : Attrs;
```

#### `Fragment(props)`

A component that allows grouping children without adding an extra node to the DOM.

```ts
(props: { children?: Children }): TemplateObject
```

-   `props.children`: The children to group.

### Server-Side Rendering

#### `ssr(...templates)`

Generates a static HTML string from Plaited template objects.

```ts
(...templates: TemplateObject[]): string
```

-   `templates`: One or more `TemplateObject` instances to render.
-   Returns: A string representation of the rendered HTML, with collected stylesheets injected.

### Core Types

Essential types used throughout the Plaited framework.

-   **`PlaitedElement`**: Interface extending `HTMLElement` for Plaited custom elements, including `trigger` and lifecycle callbacks.
-   **`PlaitedTemplate`**: The type returned by `defineElement`, a function template that includes metadata like `tag` and `registry`.
-   **`PlaitedMessage<D extends JSONDetail = JSONDetail>`**: Structure for messages in Plaited (`{ address: string, type: string, detail?: D }`).
-   **`TemplateObject`**: The internal representation of a compiled JSX template (`{ html: string[], stylesheets: string[], registry: string[], $: unique_symbol }`).
-   **`Position`**: DOM insertion positions (`'beforebegin' | 'afterbegin' | 'beforeend' | 'afterend'`).
-   **`Bindings`**: Helper methods (`render`, `insert`, `replace`, `attr`) bound to elements queried by `p-target`.
-   **`BoundElement<T extends Element = Element>`**: An `Element` augmented with `Bindings`.
-   **`SelectorMatch`**: Attribute selector match types (`'=' | '~=' | '|=' | '^=' | '$=' | '*='`).
-   **`JSONDetail`**: Types allowed in `PlaitedMessage` detail payloads (JSON-serializable primitives, objects, arrays).

### JSX Types

Types relevant when using JSX with Plaited.

-   **`PlaitedAttributes`**: Core attributes applicable to all Plaited elements (e.g., `class`, `children`, `p-target`, `p-trigger`, `stylesheet`, `trusted`, `style`).
-   **`AriaAttributes`**: Standard WAI-ARIA attributes.
-   **`DetailedHTMLAttributes`**: Base HTML attributes including ARIA and Plaited-specific ones, allowing `data-*`.
-   **`ElementAttributeList`**: A mapping of HTML/SVG tag names to their detailed attribute types.
-   **`Attrs<T extends DetailedHTMLAttributes = DetailedHTMLAttributes>`**: Generic type for template attributes/props.
-   **`FunctionTemplate<T extends Attrs = Attrs>`**: Signature for Plaited functional templates.
-   **`CustomElementTag`**: Type for custom element tag names (`\${string}-\${string}`).
-   **`Children`**: Valid children in JSX (`number | string | TemplateObject | Child[]`).

## Behavioral Module (`plaited/behavioral`)

Provides tools for implementing behavioral programming patterns.

### Core Functions

#### `bProgram()`

Factory function that creates and initializes a new behavioral program instance.

```ts
(): Readonly<{
  bThreads: BThreads;
  trigger: Trigger;
  useFeedback: UseFeedback;
  useSnapshot: UseSnapshot;
}>
```

-   Returns an object with:
    -   `bThreads`: For managing threads (`set`, `has`).
    -   `trigger`: For injecting external events.
    -   `useFeedback`: For subscribing to selected events.
    -   `useSnapshot`: For monitoring internal state.

#### `bThread(rules, [repeat])`

Constructs a b-thread by composing multiple synchronization steps.

```ts
(rules: RulesFunction[], repeat?: true | (() => boolean)): RulesFunction
```

-   `rules`: An array of `RulesFunction`s created with `bSync`.
-   `repeat`: Optional. `true` for indefinite repeat, or a function returning `boolean` for conditional repeat.
-   Returns: A `RulesFunction` (generator function) representing the b-thread.

#### `bSync(idioms)`

Creates a single synchronization step (a `RulesFunction`) for a b-thread.

```ts
<T>(idioms: Idioms<T>): () => Generator<Idioms, void, unknown>
```

-   `idioms`: An `Idioms<T>` object defining `request`, `waitFor`, `block`, and/or `interrupt` declarations.
-   Returns: A `RulesFunction` that yields the `idioms` object once.

**`Idioms<T = any>`**

```ts
type Idioms<T = any> = {
  waitFor?: BPListener<T> | BPListener<T>[];
  interrupt?: BPListener<T> | BPListener<T>[];
  request?: BPEvent<T> | BPEventTemplate<T>;
  block?: BPListener<T> | BPListener<T>[];
}
```

#### `defineBProgram(config)`

A higher-order function factory for creating and configuring behavioral programs, often for framework integration.

```ts
<A extends Handlers, C extends Record<string, unknown> = Record<string, unknown>>(
  config: {
    publicEvents?: string[];
    disconnectSet?: Set<Disconnect>; // NEWLY ADDED
    bProgram: (props: DefineBProgramProps & C) => A;
  }
): ((ctx?: C) => Trigger) & { addDisconnectCallback: (cb: Disconnect) => void } // MODIFIED RETURN
```

-   `config.publicEvents`: Defines which events can be triggered via the returned public trigger.
-   `config.disconnectSet`: Optional `Set` to store cleanup functions.
-   `config.bProgram`: Callback defining threads and feedback handlers.
-   Returns: An `init` function that sets up the bProgram and returns a public `Trigger`. The `init` function also has an `addDisconnectCallback` method.

**`DefineBProgramProps`** (passed to `bProgram` callback in `defineBProgram`)

```ts
type DefineBProgramProps = {
  bSync: BSync;
  bThread: BThread;
  bThreads: BThreads;
  trigger: PlaitedTrigger; // Enhanced trigger
  useSnapshot: UseSnapshot;
};
```

### Utility Functions

Functions to aid in creating and managing behavioral programs.

-   **`randomEvent(...events: BPEvent[]): BPEvent`**
    Selects and returns a single `BPEvent` randomly from a provided list.
-   **`shuffleSyncs(...syncs: BSync[]): BSync[]`**
    Randomly shuffles an array of `BSync` (synchronization points).
-   **`getPublicTrigger(args: { trigger: Trigger; publicEvents?: string[] | ReadonlyArray<string> }): Trigger`**
    Creates a wrapped `Trigger` that filters events based on `publicEvents`.
-   **`getPlaitedTrigger(trigger: Trigger, disconnectSet: Set<Disconnect>): PlaitedTrigger`**
    Augments a standard `Trigger` with `addDisconnectCallback` for cleanup management.

### Behavioral Type Guards

Runtime checks for behavioral programming types.

-   **`isBPEvent(data: unknown): data is BPEvent`**
    Checks if a value conforms to the `BPEvent` structure (`{ type: string, detail?: any }`).
-   **`isPlaitedTrigger(trigger: Trigger): trigger is PlaitedTrigger`**
    Checks if a trigger is an enhanced `PlaitedTrigger` (has `addDisconnectCallback` method).

## Styling Module (`plaited/styling`)

Provides utilities for CSS-in-JS styling.

### CSS-in-JS

#### `css.create(styles)`

Generates style objects with hashed class names from style definitions.

```ts
<T extends CSSClasses>(classNames: T): StyleObjects<T>
```

-   `classNames`: An object where keys are logical style group names and values are `CSSProperties` objects.
-   Returns: An object where each key holds a `StylesObject` (`{ class: string, stylesheet: string[] }`).

Example `styles` input:

```ts
const styles = css.create({
  element: {
    padding: '10px',
    backgroundColor: 'blue',
    ':hover': {
      backgroundColor: 'darkblue',
    },
    '@media (min-width: 768px)': {
      padding: '20px',
    }
  }
});
// Usage: <div {...styles.element}>...</div>
```

#### `css.host(styles)`

Creates shadow DOM host styles.

```ts
(props: CSSHostProperties): StylesObject
```

-   `props`: An object of `CSSHostProperties` where keys are CSS properties and values can be primitives or objects for conditional styling (e.g., `':hover'`, `'[disabled]'`).
-   Returns: A `StylesObject` containing only the `stylesheet` array.

Example `styles` input:

```ts
const hostStyles = css.host({
  display: 'block',
  borderColor: {
    default: 'gray',
    ':focus-within': 'blue',
  }
});
// Usage: <my-element {...hostStyles}>...</my-element>
```

#### `css.keyframes(name, frames)`

Defines reusable CSS animations with unique identifiers.

```ts
(name: string, frames: CSSKeyFrames): (() => StylesObject) & { id: string }
```

-   `name`: A base name for the animation (e.g., 'fadeIn').
-   `frames`: A `CSSKeyFrames` object defining animation steps (`'from'`, `'to'`, `'0%'`, etc.).
-   Returns: A function that, when called, returns a `StylesObject` for the `@keyframes` rule. This function also has an `id` property (the hashed animation name).

Example `frames` input:

```ts
const fadeIn = css.keyframes('fadeIn', {
  from: { opacity: 0 },
  to: { opacity: 1 },
});
// Usage: css.create({ animated: { animationName: fadeIn.id } }); ... assign(fadeIn())
```

#### `css.assign(...styles)`

Combines and conditionally applies multiple `StylesObject` instances.

```ts
(...styles: Array<StylesObject | undefined | false | null>): StylesObject
```

-   `styles`: A variable number of `StylesObject` instances or falsy values.
-   Returns: A new `StylesObject` with combined `class` and `stylesheet` properties.

Example usage:

```ts
const primaryButtonStyles = css.assign(
  baseStyles.button,
  themeStyles.primary,
  sizeStyles.large,
  isActive && activeStyles.active // conditional
);
```

### Design Tokens

Utilities for working with design tokens.

#### Design Token Types

A suite of types defining the structure of design tokens. Key types include:

-   `Alias`: `{token.path}` string for referencing other tokens.
-   `DesignValue`: Union of all possible token values (string, number, color object, size string, function object, composite object).
-   `MediaValue<V>`: Allows responsive values using media query keys (e.g., `{'@desktop': '2rem'}`).
-   `BaseToken<V, T>`: Core structure (`$description`, `$value`, optional `$type`).
-   `DefaultToken`, `AmountToken`, `AngleToken`, `ColorToken`, `SizeToken`, `FunctionToken`, `CompositeToken`: Specific token types inheriting from `BaseToken`.
-   `DesignToken`: Union of all specific token types.
-   `DesignTokenGroup`: Hierarchical structure for organizing tokens (`{ [key: string]: DesignTokenGroup | DesignToken }`).
-   `DesignTokenEntry`: Extended token type used by `TransformDesignTokens`, including resolved dependencies.

#### `TransformDesignTokens`

A class for processing a `DesignTokenGroup` and generating CSS custom properties and TypeScript/JavaScript references.

```ts
class TransformDesignTokens {
  constructor(options: {
    tokens: DesignTokenGroup;
    tokenPrefix?: string; // Default: 'pl'
    mediaQueries?: MediaQueries; // Map of query names to query strings
    defaultMediaQueries?: DefaultMediaQueries; // e.g., { colorScheme: '@dark', screen: '@desktop' }
  });

  get ts(): string; // Generated TypeScript module content
  get css(): string; // Generated CSS stylesheet content
  get entries(): [Alias, DesignTokenEntry][]; // All processed token entries
  filter(cb: (entry: [Alias, DesignTokenEntry], ...) => boolean): [Alias, DesignTokenEntry][];
  get(alias: Alias): DesignTokenEntry | undefined;
  has(alias: Alias): boolean;
}
```

#### `getDesignTokensElement(stylesheet, tag?)`

Creates a custom element template for injecting design token stylesheets into the DOM.

```ts
(stylesheet: string, tag?: CustomElementTag): PlaitedTemplate
```

-   `stylesheet`: A string containing CSS custom property definitions.
-   `tag` (optional, default: `'design-tokens'`): The tag name for the custom element.
-   Returns: A `PlaitedTemplate` for the design tokens element.

#### `getDesignTokensSchema(tokens)`

Converts a `DesignTokenGroup` into a JSON Schema for validation.

```ts
<T extends DesignTokenGroup = DesignTokenGroup>(tokens: T): SchemaObject
```

-   `tokens`: The design token group to convert.
-   Returns: A JSON Schema object.

## Testing Module (`plaited/workshop`)

Provides utilities for testing Plaited components and stories.

### Assertion and Testing

#### `assert(params)`

A powerful assertion function for testing with detailed error reporting.

```ts
<T>(params: {
  given: string;
  should: string;
  actual: T;
  expected: T;
}): void
```

-   `params.given`: Description of the test context.
-   `params.should`: Expected behavior.
-   `params.actual`: The actual value.
-   `params.expected`: The expected value.
-   Throws `AssertionError` or `MissingTestParamsError`.

#### `findByText(searchText, [context])`

Asynchronously finds an element containing specific text content.

```ts
<T extends HTMLElement = HTMLElement>(
  searchText: string | RegExp,
  context?: HTMLElement // Default: document.body
): Promise<T | undefined>
```

#### `findByAttribute(attribute, value, [context])`

Asynchronously finds an element by a specific attribute name and value.

```ts
<T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
  attributeName: string,
  attributeValue: string | RegExp,
  context?: HTMLElement | SVGElement // Default: document
): Promise<T | undefined>
```

#### `fireEvent(element, eventType, [eventArgs])`

Asynchronously dispatches DOM events with configurable options.

```ts
<T extends HTMLElement | SVGElement = HTMLElement | SVGElement>(
  element: T,
  eventName: string,
  eventArgs?: EventArguments
): Promise<void>
```

**`EventArguments`**

```ts
type EventArguments = {
  bubbles?: boolean;    // Default: true
  composed?: boolean;   // Default: true
  cancelable?: boolean; // Default: true
  detail?: Record<string, unknown>; // For CustomEvent
};
```

#### `throws(fn, ...args)`

Tests if a function throws an error, capturing sync and async errors.

```ts
<U extends unknown[], V>(
  fn: (...args: U) => V,
  ...args: U
): string | undefined | Promise<string | undefined>
```

-   Returns error message as string if thrown, `undefined` otherwise. Handles promises.

#### `match(str)`

Creates a curried string pattern matcher.

```ts
(str: string): (pattern: string | RegExp) => string
```

-   `str`: The source string to search within.
-   Returns a function that takes a `pattern` (string or RegExp) and returns the first matched substring or `''`.

### Story Testing

#### Story Types

Types for defining template stories.

-   **`StoryObj<T extends Attrs = Attrs>`**: The primary type for a story definition.
    -   `args?: Attrs`: Props for the story's template.
    -   `description: string`: A mandatory description of the story.
    -   `parameters?: Params`: Optional test environment configuration.
    -   `play?: Play`: Optional asynchronous function for interactions and assertions.
    -   `template?: FunctionTemplate<T>`: Optional Plaited template function.
-   **`InteractionStoryObj<T extends Attrs = Attrs>`**: A `StoryObj` where `play` is required.
-   **`SnapshotStoryObj<T extends Attrs = Attrs>`**: A `StoryObj` where `play` is never.

**`Params`** (Story parameters)

```ts
type Params = {
  a11y?: Record<string, string> | false; // Axe-core configuration or false to disable
  headers?: (env: NodeJS.ProcessEnv) => Headers; // Custom HTTP headers
  scale?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 'rel'; // Agentic Card Scale
  styles?: StylesObject; // Story-specific styles
  timeout?: number; // Play function timeout (default: 5000ms)
};
```

**`Play`** (Signature for the `play` function)

```ts
type Play = (args: {
  assert: typeof assert;
  findByAttribute: typeof findByAttribute;
  findByText: typeof findByText;
  fireEvent: typeof fireEvent;
  hostElement: Element;
  match: typeof match;
  throws: typeof throws;
  wait: typeof wait;
}) => Promise<void>;
```

**`Args<T extends FunctionTemplate>`** (Utility to extract props type from a template)

```ts
type Args<T extends FunctionTemplate> = Parameters<T>[0];
```

#### `PlaitedFixture`

A custom element (`<plaited-test-fixture>`) that hosts and executes a single Plaited story test.
It's configured via attributes:

-   `p-socket`: WebSocket URL path for the test runner.
-   `p-route`: Unique route identifier for the story.
-   `p-file`: Source file path of the story.
-   `p-entry`: Path to the compiled story module.
-   `p-name`: Exported name of the story object.

### Error Classes

Custom error classes used by the testing utilities.

-   `AssertionError`: Thrown when an `assert()` condition fails.
-   `MissingTestParamsError`: Thrown by `assert()` if required parameters are missing.
-   `TimeoutError`: Thrown when a `play` function exceeds its timeout.

## Utilities Module (`plaited/utils`)

General-purpose utility functions.

### Type Checking

-   **`isTypeOf<T>(obj: unknown, type: string): obj is T`**
    Checks if `obj` is of the specified `type` (e.g., 'string', 'array', 'date') using precise type detection.
-   **`trueTypeOf(obj?: unknown): string`**
    Returns the precise type of `obj` as a lowercase string (e.g., 'array', 'asyncfunction').

### DOM Utilities

-   **`canUseDOM(): boolean`**
    Returns `true` if running in a browser-like environment with DOM access, `false` otherwise.

### String Manipulation

-   **`camelCase(str: string): string`**
    Converts `str` to camelCase (e.g., 'hello-world' -> 'helloWorld').
-   **`kebabCase(str: string): string`**
    Converts `str` to kebab-case (e.g., 'helloWorld' -> 'hello-world').
-   **`escape(sub: string): string`**
    Escapes HTML special characters (`&`, `<`, `>`, `'`, `"`).
-   **`unescape(sub: string): string`**
    Converts HTML entities back to their original characters.
-   **`hashString(str: string): number | null`**
    Generates a 32-bit integer hash (djb2 algorithm) from `str`. Returns `null` for empty string.
-   **`ueid(prefix?: string): string`**
    Generates a "Unique Enough Identifier" (e.g., `prefix + 'lpf98qw2'`). Not cryptographically secure.

### Data Structures

-   **`deepEqual(objA: unknown, objB: unknown, map?: WeakMap<object, unknown>): boolean`**
    Performs a deep equality comparison between `objA` and `objB`. Handles primitives, objects, arrays, Sets, Maps, Dates, RegExp, and circular references.
-   **`keyMirror<Keys extends string[]>(...inputs: Keys): { readonly [K in Keys[number]]: K }`**
    Creates an immutable object where keys mirror their string values.

### Event Handling

-   **`DelegatedListener<T extends Event = Event>`** (Class)
    An `EventListener` implementation for robust event delegation.
    `constructor(callback: (ev: T) => void | Promise<void>)`
    `handleEvent(evt: T): void`
-   **`delegates: WeakMap<EventTarget, DelegatedListener>`**
    A global `WeakMap` used internally for storing event delegation relationships.

### Async Utilities

-   **`wait(ms: number): Promise<unknown>`**
    Returns a Promise that resolves after `ms` milliseconds.

### Other Utilities

-   **`noop<T = never>(..._: T[]): void`**
    A no-operation function that does nothing.

## Workshop Module (`plaited/workshop`)

This module provides utilities for Plaited's template development and testing workshop.
_This section is a stub and will be updated with more detailed API information in the future._

The primary function likely to be used programmatically (e.g., in custom build scripts) is:

-   **`getWorkshop(options)`**
    Collects stories, builds necessary artifacts, and prepares responses for the workshop server.
    ```ts
    async ({
      cwd: string; // Root directory of the project containing stories
      streamURL: `/${string}`; // WebSocket URL for the test runner communication
      getHTMLResponse?: GetHTMLResponse; // Optional custom HTML response generator
    }): Promise<{
      stories: [string, TestParams][]; // Array of [route, testParams]
      responses: Map<string, Response>; // Map of routes to Response objects
    }>
    ```

Other exported utilities include: `createStoryRoute`, `defaultGetHTMLResponse`, `getLibrary`, `getStoryArtifacts`, `globStories`, `mapStoryResponses`. Their specific use cases are generally internal to the workshop setup but are available if needed.

**`GetHTMLResponse`** (Type for customizing HTML page generation for stories)
```ts
type GetHTMLResponse = ({
  story: StoryObj;
  route: string;
  responses: Map<string, Response>;
  storyFile: string;
  exportName: string;
  streamURL: `/${string}`;
  libraryImportMap: Record<string, string>;
}) => TestParams;
```

## JSX Configuration

To use JSX with Plaited, configure your `tsconfig.json` (or equivalent JavaScript build tool settings):

```json
{
  "compilerOptions": {
    "jsx": "react-jsx", // or "react-jsxdev" for development
    "jsxImportSource": "plaited"
  }
}
```

Plaited exports the standard JSX factory functions:
-   `jsx` (typically for `h` or `React.createElement`)
-   `jsxs` (optimized for multiple children)
-   `jsxDEV` (development version of `jsx` with more checks)
-   `Fragment` (for grouping elements without a DOM wrapper)
-   `h` (an alias for `jsx`)

These are available via imports from `plaited/jsx-runtime` or `plaited/jsx-dev-runtime`.
