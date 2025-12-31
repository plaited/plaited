# LSP Verification

Use the typescript-lsp MCP tools during planning and implementation to ensure type safety.

## When to Use LSP

**During Planning:**
- Verify type signatures before proposing changes
- Check references to exports before planning deletions
- Understand type relationships between modules

**During Implementation:**
- Validate new code matches existing type patterns
- Check for breaking changes when modifying exports
- Verify imports resolve correctly after refactoring

## LSP Workflow

```bash
# 1. Start the LSP server (required first)
mcp__typescript-lsp__lsp_start

# 2. Open documents you're working with
mcp__typescript-lsp__lsp_open_document(filePath)

# 3. Use verification tools
mcp__typescript-lsp__lsp_hover(filePath, line, character)      # Check types
mcp__typescript-lsp__lsp_definition(filePath, line, character) # Go to definition
mcp__typescript-lsp__lsp_references(filePath, line, character) # Find all usages
mcp__typescript-lsp__lsp_document_symbols(filePath)            # List exports
mcp__typescript-lsp__lsp_workspace_symbols(query)              # Search symbols

# 4. Close documents when done
mcp__typescript-lsp__lsp_close_document(filePath)

# 5. Stop server when finished
mcp__typescript-lsp__lsp_stop
```

## Key Use Cases

### Before Deleting Exports
```typescript
// Use lsp_references to find all usages before removing
mcp__typescript-lsp__lsp_references(filePath, exportLine, exportChar)
```

### Before Modifying Types
```typescript
// Use lsp_hover to understand current type signature
mcp__typescript-lsp__lsp_hover(filePath, typeLine, typeChar)
```

### When Creating New Types
```typescript
// Use lsp_workspace_symbols to find similar patterns
mcp__typescript-lsp__lsp_workspace_symbols("Schema")
```

## Integration with Accuracy Standards

LSP verification supports the 95% confidence threshold from `.claude/rules/standards/accuracy.md`:
- Verify type signatures match live code before generating
- Check references exist before claiming usage patterns
- Validate imports resolve before proposing new exports
