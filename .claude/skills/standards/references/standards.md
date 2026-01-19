# Plaited Development Standards

Standards for generating accurate, idiomatic Plaited code.

## Framework-First Verification

Before reaching for web platform APIs, verify what the Plaited framework already provides.

### Check bElement Built-ins First

**Read type definitions** to understand available context:
- `BProgramArgs` - What's available in the bProgram callback
- `BehavioralElementCallbackDetails` - Lifecycle callback signatures

**Verify framework capabilities:**
```typescript
// What's available in bProgram?
bProgram({ $, root, host, internals, trigger, emit, bThreads, bThread, bSync, inspector }) {
  // $ - Query with p-target
  // root - ShadowRoot
  // host - Element instance
  // internals - ElementInternals (if formAssociated: true)
  // trigger - Internal BP events
  // emit - Cross-element communication
  // bThreads - Thread management
  // bThread, bSync - BP utilities
  // inspector - Debugging
}
```

**Check automatic systems:**
- **p-trigger**: Declarative events (no addEventListener needed)
- **p-target**: Automatic helper methods (render, insert, attr, replace)
- **Lifecycle**: Mapped callbacks (onConnected, onDisconnected, etc.)
- **Form association**: Built-in ElementInternals support

### When to Use Web APIs

Only after confirming the feature isn't built into bElement:
- Browser APIs not wrapped (Intersection Observer, Resize Observer)
- Platform features (Clipboard, File API, Storage)
- CSS APIs (Houdini, Typed OM)

**Sources (priority order):**
1. MDN Web Docs (developer.mozilla.org)
2. WHATWG Living Standards (spec.whatwg.org)
3. W3C Specifications

## Documentation Guidelines

### TSDoc Standards

- Public APIs require comprehensive TSDoc documentation
- **No `@example` sections** - Tests and stories serve as living examples
- Use `@internal` marker for non-public APIs
- Use `@see` tags to connect related APIs
- Always use `type` declarations (not `interface`)

### Content Guidelines

- Document the "why" not just the "what"
- Avoid redundant or obvious comments
- Internal modules need maintainer-focused documentation
- All documentation should be practical and actionable

## Related Resources

- **[code-conventions.md](code-conventions.md)**: Plaited-specific patterns for users
- **code-documentation@plaited_development-skills skill**: Complete TSDoc workflow and templates
- **accuracy.md rule**: 95% confidence threshold and verification protocol
- **code-review.md rule**: Internal style conventions for contributors
