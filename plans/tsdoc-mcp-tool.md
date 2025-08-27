# TSDoc MCP Tool Implementation Plan

## Overview
Create an MCP (Model Context Protocol) tool for automated TSDoc generation and updates based on the patterns defined in `.claude/instructions.md`.

## Decision: MCP Tool vs Agent

### Why MCP Tool Over Agent
1. **Direct Integration**: The `.claude/instructions.md` file is already used by Claude Code. An MCP tool can leverage this same documentation source.
2. **Flexibility**: Tools can be invoked both manually by users and automatically by Claude when needed.
3. **Maintainability**: The TSDoc patterns in `.claude/instructions.md` serve as a single source of truth.
4. **Scope**: TSDoc updates are focused operations that fit well within the MCP tool paradigm.

## Architecture

The TSDoc MCP tool will:
1. Read `.claude/instructions.md` for documentation patterns
2. Analyze TypeScript/TSX files to understand code structure
3. Generate appropriate TSDoc based on context (public API vs internal)
4. Update files with proper formatting

## File Structure

```
src/workshop/
├── mcp-tsdoc-server.ts       # Main MCP server
├── mcp-tsdoc-registry.ts     # Tool registration
└── tsdoc-generator.ts        # Core TSDoc generation logic
```

## Implementation Steps

### 1. Create TSDoc Generator Module (`tsdoc-generator.ts`)

**Responsibilities:**
- Parse TypeScript AST to understand code structure
- Determine if code is public API or internal
- Apply appropriate documentation pattern from instructions
- Handle different code types (functions, types, classes, modules)

**Key Functions:**
```typescript
// Analyze code to determine documentation needs
analyzeCodeElement(ast: Node): CodeElementInfo

// Generate TSDoc based on element type and context
generateTSDoc(element: CodeElementInfo, pattern: DocPattern): string

// Parse .claude/instructions.md for patterns
loadDocPatterns(): Map<DocType, DocPattern>
```

### 2. Create MCP Registry (`mcp-tsdoc-registry.ts`)

**Tools to Register:**

#### `updateTSDoc` Tool
```typescript
{
  primitive: 'tool',
  config: {
    title: 'Update TSDoc Documentation',
    description: 'Generate or update TSDoc comments following project patterns',
    inputSchema: z.object({
      filePath: z.string().describe('Path to the TypeScript file'),
      identifier: z.string().optional().describe('Specific function/type to document'),
      mode: z.enum(['single', 'file', 'missing']).default('single')
        .describe('Documentation mode: single item, entire file, or missing only'),
      context: z.object({
        isPublicAPI: z.boolean().optional(),
        moduleType: z.enum(['behavioral', 'dom', 'css', 'utils']).optional()
      }).optional()
    })
  }
}
```

#### `analyzeTSDoc` Tool
```typescript
{
  primitive: 'tool',
  config: {
    title: 'Analyze TSDoc Coverage',
    description: 'Check documentation coverage and quality',
    inputSchema: z.object({
      path: z.string().describe('File or directory path to analyze'),
      includeInternal: z.boolean().default(false),
      reportFormat: z.enum(['summary', 'detailed', 'missing']).default('summary')
    })
  }
}
```

### 3. Create MCP Server (`mcp-tsdoc-server.ts`)

**Implementation Details:**
- Load and parse `.claude/instructions.md` patterns on startup
- Handle tool invocations with proper error handling
- Support both individual and batch documentation updates
- Integrate with TypeScript compiler API for accurate parsing

**Handler Example:**
```typescript
async bProgram({ trigger, tools }) {
  const patterns = await loadDocPatterns();
  
  return {
    updateTSDoc: async ({ resolve, reject, args }) => {
      try {
        const updates = await generateDocUpdates(args, patterns);
        await applyUpdates(updates);
        
        resolve({
          content: [{
            type: 'text',
            text: `Updated ${updates.length} documentation blocks`
          }]
        });
      } catch (error) {
        reject(error);
      }
    },
    
    analyzeTSDoc: async ({ resolve, args }) => {
      const analysis = await analyzeDocumentation(args.path, args);
      resolve({
        content: [{
          type: 'text',
          text: formatAnalysisReport(analysis, args.reportFormat)
        }]
      });
    }
  };
}
```

### 4. Add Launch Configuration

**Package.json Script:**
```json
{
  "scripts": {
    "mcp:tsdoc": "bun run src/workshop/mcp-tsdoc-server.ts"
  }
}
```

## Key Features

### Pattern Detection
- Automatically detect whether to use public API, internal, or behavioral patterns
- Check for `@internal` markers
- Identify module boundaries and types

### Documentation Quality
- **Named Examples**: Generate contextual example titles
- **Cross-References**: Suggest related functions/types for `@see` tags
- **Factory Function Enforcement**: For behavioral code, ensure examples use `bThread`/`bSync` instead of raw generators
- **Type Preference**: Always use `type` over `interface` in documentation

### Validation
- Check that generated docs follow the style guide
- Verify examples are syntactically correct
- Ensure all required sections are present
- Validate cross-references exist

## Usage Examples

### Command Line Usage
```bash
# Document a single function
mcp call updateTSDoc --filePath src/main/css.ts --identifier css

# Document all missing TSDoc in a file
mcp call updateTSDoc --filePath src/behavioral/b-thread.ts --mode missing

# Analyze documentation coverage for entire source
mcp call analyzeTSDoc --path src/ --reportFormat detailed

# Check only public APIs
mcp call analyzeTSDoc --path src/main --reportFormat missing
```

### Integration with Claude Code
Claude can automatically invoke the tool when:
- Creating new functions or types
- Refactoring existing code
- Responding to documentation review requests
- Preparing code for public API release

## Special Considerations

### Behavioral Module Documentation
For behavioral programming modules, ensure:
- Event flow and synchronization are documented
- Thread lifecycle is explained
- Examples ALWAYS use factory functions (`bSync`, `bThread`)
- Never show raw `yield` statements in examples

### Internal vs Public Documentation
- Public APIs: Comprehensive examples, multiple use cases, version tracking
- Internal modules: Maintainer focus, implementation details, modification scenarios
- Auto-detect based on export patterns and `@internal` markers

### Performance Optimization
- Cache parsed `.claude/instructions.md` patterns
- Use incremental TypeScript compilation
- Batch file updates when processing multiple files
- Stream large analysis reports

## Success Metrics
- 100% documentation coverage for public APIs
- Consistent formatting across entire codebase
- Reduced manual documentation effort
- Improved code maintainability through better docs

## Future Enhancements
1. **IDE Integration**: VS Code extension for real-time TSDoc suggestions
2. **CI/CD Pipeline**: Automated documentation checks in PR reviews
3. **Documentation Site**: Auto-generate docs site from TSDoc comments
4. **AI Learning**: Train on project-specific patterns for better suggestions
5. **Multi-language Support**: Extend to support JSDoc, Python docstrings, etc.

## References
- `.claude/instructions.md`: Source of documentation patterns
- `CLAUDE.md`: Project-specific Claude Code guidance
- `src/mcp/b-server.ts`: MCP server implementation reference
- TypeScript Compiler API: For AST parsing and manipulation