# Module Organization and Critical Implementation Details

## Module Organization

- **`src/main/`**: Core framework including:
  - Web Components: `bElement`, `bWorker`, type guards (`isBehavioralElement`, `isBehavioralTemplate`)
  - Behavioral Programming: `behavioral`, `bThread`, `bSync`, `useBehavioral`, behavioral type guards
  - Cross-Island Communication: `useSignal`, `useComputed` for communication between islands outside normal parent-child event flow
  - Styling: `createStyles`, `createHostStyles`, `createKeyframes`, `createTokens`, `joinStyles`
  - Templates: `ssr`, `useTemplate`, template types
  - Utilities: `useDispatch`, `useAttributesObserver`, `useWorker`
- **`src/utils/`**: Pure utility functions (type checking, string manipulation, DOM utilities, etc.)
- **`src/workshop/`**: Development and testing tools:
  - Template discovery: `getBehavioralTemplateMetadata`, `discoverBehavioralTemplateMetadata`
  - Story discovery: `getStoryMetadata`, `discoverStoryMetadata`
  - Test infrastructure: `useRunner`, `TEST_RUNNER_EVENTS`
  - Types: `TemplateType`, `TemplateExport`, `StoryMetadata`, `TestResult`, `TestStoriesOutput`
- **`src/testing/`**: Story factory function (`story`) and type definitions for template-based testing
- **`src/stories/`**: Example story files demonstrating framework usage

## Critical Implementation Details

1. **DOM Updates**: Helper methods (`render`, `insert`, `attr`, `replace`) are attached once per element via `Object.assign` for performance

2. **Style Management**: Uses WeakMap caching to prevent duplicate style adoption per ShadowRoot; hash-based class names for deduplication

3. **Event Scheduling**: Priority-based event selection with blocking capabilities in super-step execution model

4. **Memory Management**: Automatic cleanup via internal PlaitedTrigger system and WeakMap for styles; disconnect callbacks invoked on component removal

5. **Type Safety**: Runtime type guards (`isBehavioralElement`, `isBehavioralTemplate`, `isBPEvent`, `isPlaitedTrigger`) ensure type correctness

6. **Form Integration**: ElementInternals API support for form-associated custom elements with full lifecycle callbacks

7. **Security**: Public event filtering prevents unauthorized internal event triggering; automatic HTML escaping in templates
