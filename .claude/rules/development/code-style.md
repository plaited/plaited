# Code Style Preferences

## General Preferences

- Prefer arrow functions over function declarations
- Avoid using `any` type - use proper TypeScript types
- Use `test` instead of `it` in test files
- Prefer Bun native APIs over Node.js equivalents (see @.claude/rules/platform/bun-apis.md)
- **Prefer `type` over `interface`**: Use type aliases instead of interfaces for better consistency and flexibility
- **No `any` types**: Always use proper types; use `unknown` if type is truly unknown and add type guards
- **PascalCase for types and schemas**: All type names and Zod schema names should use PascalCase (e.g., `UserConfigSchema`, `ApiResponseType`)
- Use union types and intersection types effectively
- Leverage TypeScript's type inference where appropriate

## Object Parameter Pattern

**For functions with more than two parameters**, use a single object parameter with named properties instead of positional parameters. This improves readability and makes the function calls self-documenting.

```typescript
// ✅ Good: Object parameter pattern
const toStoryMetadata = ({
  exportName,
  filePath,
  storyExport,
}: {
  exportName: string
  filePath: string
  storyExport: StoryExport
}): StoryMetadata => { ... }

// ❌ Avoid: Multiple positional parameters
const toStoryMetadata = (
  exportName: string,
  filePath: string,
  storyExport: StoryExport
): StoryMetadata => { ... }
```

## Template Creation

**IMPORTANT**: Always use JSX syntax for creating templates in tests, examples, and application code.

- ✅ Use JSX syntax: `<div className="foo">Hello</div>`
- ❌ Avoid `h()` or `createTemplate()` direct calls (these are internal transformation functions)
- JSX is automatically transformed to `createTemplate()` calls by TypeScript/Bun
- JSX provides better type safety, readability, and IDE support

**Rationale:** `h()` and `createTemplate()` are internal JSX transformation functions exported only through jsx-runtime modules. They are not part of the public API and should not be used directly.
