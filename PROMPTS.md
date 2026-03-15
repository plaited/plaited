# Worktree Prompts

Standalone prompts for Claude Code sessions. Each runs in a git worktree branch off `chore/audit-tool`. Prompts are grouped by `src/` directory and can run in parallel within groups.

---

## Tool Improvements (`src/tools/`)

### Prompt 1: Output Truncation + Read Enhancements

```
Work in a worktree branch off chore/audit-tool.

## Task

Add output truncation, offset/limit pagination, and binary file detection to the built-in tools.

## Context

Current tools return unbounded output — a readFile on a 10MB file dumps everything into context. pi-mono caps at 2000 lines / 50KB per tool output. We need the same protection.

## What to Build

### 1. Truncation Utility (src/tools/truncate.ts)

Shared utility used by all tool handlers:

- `truncateHead(text, opts)` — keep first N lines (for readFile)
- `truncateTail(text, opts)` — keep last N lines (for bash output)
- Options: `{ maxLines: 2000, maxBytes: 50 * 1024 }`
- Use `Bun.indexOfLine` for fast native line counting (SIMD-optimized)
- Return metadata: `{ content, truncated, totalLines, totalBytes, outputLines }`
- Export Zod schema for TruncationResult

### 2. Read Tool — Offset/Limit (update src/tools/crud.ts)

Add `offset` and `limit` parameters to readFile:

- `BunFile.slice(start, end)` for byte-range reads without loading entire file
- `BunFile.size` for total size without reading
- Default: truncateHead with 2000 lines / 50KB
- With offset/limit: read specified range, then truncate

### 3. Read Tool — Binary Detection (update src/tools/crud.ts)

Use `BunFile.type` for MIME detection:

- Text files → read as before (with truncation)
- Image files → return `{ type: 'image', mimeType, size, path }` (no binary content)
- Other binary → return `{ type: 'binary', mimeType, size, path }`
- This is the multimodal attachment point for when Vision model is available

### 4. Apply Truncation to All Handlers

- `readFile` → truncateHead
- `bash` → truncateTail (show last N lines of command output)
- `listFiles` → cap results at 1000 entries
- `editFile` → no truncation needed (output is small)

Update crud.schemas.ts for new parameters. Update tests.

## Key Files

- src/tools/crud.ts — existing handlers
- src/tools/crud.schemas.ts — existing schemas
- Bun docs: BunFile.size, BunFile.type, BunFile.slice(), Bun.indexOfLine

## Constraints

- Read CLAUDE.md and AGENTS.md for project conventions
- Use Bun APIs (BunFile, Bun.indexOfLine) not Node.js
- Run `bun --bun tsc --noEmit` and `bun test src/` before committing
```

### Prompt 2: Grep Tool + Find Enrichment

```
Work in a worktree branch off chore/audit-tool.

## Task

Add a dedicated grep tool and enrich the find/listFiles tool with metadata.

## Context

Our agent uses the bash tool for text search, which means read-only searches go through the full simulate+judge pipeline (bash has empty risk tags → default-deny). A dedicated grep tool tagged [workspace] skips simulation for read-only searches.

## What to Build

### 1. Grep Tool (add to src/tools/crud.ts)

Wraps ripgrep with structured output:

```typescript
const result = await $`rg --json ${pattern} ${path}`.cwd(workspace).nothrow().quiet()
```

Parameters:
- `pattern` (string, required) — regex or literal search pattern
- `path` (string, optional) — directory or file to search (default: workspace root)
- `glob` (string, optional) — filter files by glob pattern
- `ignoreCase` (boolean, optional)
- `literal` (boolean, optional) — treat pattern as literal, not regex
- `context` (number, optional) — lines before/after each match
- `limit` (number, optional, default: 100) — max matches

Use `Bun.JSONL.parse()` to parse `rg --json` output natively.

Risk tags: `[RISK_TAG.workspace]` — read-only, skips simulation.

Add to `BUILT_IN_RISK_TAGS`, `builtInHandlers`, `BUILT_IN_TOOLS`.

Apply truncation from Prompt 1 to grep output.

### 2. ensureTool Utility (src/tools/cli.utils.ts)

Add a utility that checks for external binary dependencies at tool registration time:

```typescript
export const ensureTool = (name: string): string => {
  const path = Bun.which(name)
  if (!path) throw new Error(`Required tool '${name}' not found on PATH. Install it or add it to your node's setup.`)
  return path
}
```

Call `ensureTool('rg')` at grep handler creation time — fail fast with a clear message rather than failing at first use. This is the Bun-native equivalent of pi-mono's tools-manager, without auto-downloading binaries (that's a deployment/seed concern).

### 3. Find/ListFiles Enrichment (update src/tools/crud.ts)

Enrich listFiles results with metadata:

- `BunFile.size` for file size
- `BunFile.type` for MIME type
- Add `limit` parameter (default: 1000)
- Return sorted results (most recently modified first if possible)

Update schemas and tests for both.

## Key Files

- src/tools/crud.ts — existing handlers
- src/tools/crud.schemas.ts — existing schemas
- src/agent/agent.constants.ts — BUILT_IN_TOOLS, RISK_TAG
- Bun docs: Bun.$ (shell), Bun.JSONL.parse(), BunFile.size, BunFile.type

## Constraints

- Read CLAUDE.md and AGENTS.md for project conventions
- grep must use Bun.$ to run rg (check Bun.which('rg') at startup)
- Run `bun --bun tsc --noEmit` and `bun test src/` before committing
```

### Prompt 3: Edit with Scan-Assisted Matching

```
Work in a worktree branch off chore/audit-tool.

## Task

Enhance the edit tool with Bun.Transpiler.scan()-based symbol location and fallback fuzzy matching.

## Context

Current editFile does exact string match only. When the model produces old_string with slightly different whitespace, the edit fails. pi-mono uses fuzzy matching with Unicode normalization. We can do better: use Bun.Transpiler.scan() to locate symbols by name, then apply edits within that range.

## What to Build

### 1. Scan-Assisted Edit Mode (update src/tools/crud.ts)

New optional parameter: `symbol` (string) — if provided, use scan() to locate:

```typescript
const transpiler = new Bun.Transpiler({ loader: getLoader(path) })
const { exports } = transpiler.scan(content)
const target = exports.find(e => e.name === symbol)
// Now we know the exact line range — edit within it
```

Flow:
1. If `symbol` provided → scan() to find position → match old_string within that range only
2. If no `symbol` → exact match first (existing behavior)
3. If exact match fails → normalize whitespace (trimEnd per line) and retry
4. If still fails → error with helpful message

### 2. Whitespace Normalization Fallback

Simple normalization (not pi-mono's full Unicode handling — greenfield, keep simple):

```typescript
const normalize = (s: string) => s.split('\n').map(l => l.trimEnd()).join('\n')
```

When exact match fails:
- Normalize both content and old_string
- Find match in normalized content
- Map the match position back to original content
- Apply edit to original (preserving original whitespace for untouched lines)

### 3. Parse Validation After Edit

After applying the edit, use scan() to verify the result still parses:

```typescript
try {
  transpiler.scan(updatedContent) // throws on syntax error
} catch {
  throw new Error('Edit produced invalid TypeScript syntax')
}
```

This is optional (controlled by file extension — only validate .ts/.tsx/.js/.jsx).

Update schemas (add `symbol` parameter), update tests.

## Key Files

- src/tools/crud.ts — editFile handler
- src/tools/crud.schemas.ts — EditFileConfigSchema
- Bun docs: Bun.Transpiler, scan(), scanImports()

## Constraints

- Read CLAUDE.md and AGENTS.md for project conventions
- scan() is microseconds — no performance concern for per-edit usage
- The existing exact-match path must still work unchanged
- Run `bun --bun tsc --noEmit` and `bun test src/` before committing
```

### Prompt 4: Scan Integration in Ingestion + LSP

```
Work in a worktree branch off chore/audit-tool.

## Task

Replace regex-based scanning with Bun.Transpiler.scan() in ingestion tools, and add a lightweight scan sub-operation to the LSP tool.

## Context

ingest-skill.ts currently uses regex (/bp:thread\/(\w+)/g, /bp:event\/(\w+)/g, /from\s+['"]\.\.\/([^/'"]+)\//g) to extract references from TypeScript files. Bun.Transpiler.scan() gives imports and exports natively — more reliable, no false positives from comments or strings.

The LSP tool (typescript-lsp.ts) spawns a subprocess for every query. For structural queries (imports, exports), scan() gives the same information instantly with zero subprocess cost.

## What to Build

### 1. Replace Regex Scanning in ingest-skill.ts

Replace scanReferences() (lines 43-79) with Bun.Transpiler.scan():

```typescript
const transpiler = new Bun.Transpiler({ loader: 'tsx' })
const { imports, exports } = transpiler.scan(sourceCode)
```

- Extract skill dependencies from `imports[].path` (replaces regex for cross-skill deps)
- Keep regex for bp:thread/ and bp:event/ references (these appear in string literals that scan() doesn't parse — scan() only gives imports/exports, not string content)

### 2. Add 'scan' Operation to typescript-lsp.ts

New operation type alongside hover/references/definition/symbols/exports/find:

```typescript
case 'scan': {
  const transpiler = new Bun.Transpiler({ loader: getLoader(absolutePath) })
  const result = transpiler.scan(text)
  return { imports: result.imports, exports: result.exports }
}
```

This runs in microseconds with no LSP subprocess. The agent can:
- Use 'scan' for structural queries (what does this file import/export?)
- Use 'symbols'/'hover'/'references' for type-aware queries (what type is this? who uses it?)

Risk tags: same as LSP ([RISK_TAG.workspace]).

Update LspOperationSchema to include 'scan'. Update tests.

### 3. Validate bThread Code with scan()

In validate-thread.ts, use scan() for the sandbox check (no imports outside behavioral types) instead of regex:

```typescript
const { imports } = transpiler.scan(source)
const disallowed = imports.filter(i => !allowedImports.has(i.path))
```

More reliable than the current regex-based import detection.

### 4. Skill Collision Detection (update src/tools/skill-discovery.ts)

When discovering skills from multiple sources (PROJECT-ISOLATION.md defines three tool layers: framework built-ins, global `~/.agents/skills/`, project `skills/`), detect name collisions:

```typescript
// After scanning all skill directories, check for duplicates
const seen = new Map<string, string>()  // name → source path
for (const skill of allSkills) {
  const existing = seen.get(skill.name)
  if (existing) {
    diagnostics.push({
      type: 'collision',
      message: `Skill '${skill.name}' found in both ${existing} and ${skill.path}. Using ${skill.path} (project wins over global).`,
    })
  }
  seen.set(skill.name, skill.path)
}
```

Priority: project skills > global skills > framework built-ins. The last-loaded source wins, and a diagnostic is emitted for shadowed skills. This prevents silent skill shadowing when an enterprise node and a worker node both define a skill with the same name.

## Key Files

- src/tools/ingest-skill.ts — scanReferences function
- src/tools/typescript-lsp.ts — operation dispatch
- src/tools/validate-thread.ts — sandbox check
- src/tools/skill-discovery.ts — skill scanning
- Bun docs: Bun.Transpiler, scan(), scanImports()

## Constraints

- Read CLAUDE.md and AGENTS.md for project conventions
- Keep bp:thread/ and bp:event/ regex (these are in strings, not imports)
- Run `bun --bun tsc --noEmit` and `bun test src/` before committing
```

---

## Bun-Native Optimizations (`src/tools/` + `src/agent/`)

### Prompt 5: JSONL, Archive, Hash, DeepEquals

```
Work in a worktree branch off chore/audit-tool.

## Task

Replace manual implementations with Bun-native APIs: JSONL parsing, archive creation, hashing, and deep comparison.

## Context

Several tools and handlers use manual implementations where Bun provides native, faster alternatives. These are low-effort, high-value replacements.

## What to Build

### 1. Bun.JSONL.parse() for Decision Files (src/agent/memory-handlers.ts)

The consolidate handler concatenates .jsonld files into decisions.jsonl. When reading back, use Bun.JSONL.parse() instead of manual line splitting:

```typescript
const content = await Bun.file(path).text()
const decisions = Bun.JSONL.parse(content)
```

Also update any code that reads decisions.jsonl files (e.g., buildSessionSummary in hypergraph.utils.ts if applicable).

### 2. Bun.Archive for Defrag (src/agent/memory-handlers.ts)

The defrag handler currently uses `git rm -rf` for old sessions. For archival before deletion, use Bun.Archive:

```typescript
const archive = new Bun.Archive(entries)
await archive.writeTo(join(sessionsDir, `${session}.tar.gz`), { compression: 'gzip' })
```

This preserves old sessions as compressed archives without git subprocess.

### 3. Bun.hash for Constitution Hashing (src/modnet/modnet.constants.ts or new modnet.utils.ts)

Add a utility for computing the modnet:constitutionHash metadata value:

```typescript
export const hashConstitution = (source: string): string => {
  const hash = Bun.hash(source)
  return `wyhash:${hash.toString(16)}`
}
```

For non-cryptographic purposes (comparing constitutions between nodes). For cryptographic attestation, keep crypto.subtle.

### 4. Bun.deepEquals in Validation (src/tools/validate-thread.ts)

Replace manual comparison logic with Bun.deepEquals where applicable.

### 5. Startup Timing Utility (src/agent/agent.utils.ts)

Add a minimal timing utility using `Bun.nanoseconds()` for startup profiling:

```typescript
const ENABLED = Bun.env.PLAITED_TIMING === '1'
const marks: Array<{ label: string; ns: number }> = []
let lastNs = Bun.nanoseconds()

export const mark = (label: string) => {
  if (!ENABLED) return
  const now = Bun.nanoseconds()
  marks.push({ label, ns: now - lastNs })
  lastNs = now
}

export const printTimings = () => {
  if (!ENABLED || marks.length === 0) return
  const total = marks.reduce((a, b) => a + b.ns, 0)
  for (const m of marks) console.error(`  ${m.label}: ${(m.ns / 1e6).toFixed(1)}ms`)
  console.error(`  TOTAL: ${(total / 1e6).toFixed(1)}ms`)
}
```

Add `mark()` calls to `createAgentLoop` at key checkpoints: BP engine creation, constitution loading, goal loading, handler registration, snapshot writer setup. Enabled by `PLAITED_TIMING=1` environment variable. Uses `Bun.nanoseconds()` for ns-precision (vs pi-mono's `Date.now()` ms-precision).

### 6. Bun.markdown for Rule Parsing (src/tools/ingest-rules.ts)

If Bun.markdown provides structured AST output, use it to replace the manual section parser in parseRuleSections(). This would give more reliable heading detection and content extraction. If Bun.markdown only renders HTML, keep the current manual parser (it works correctly).

Tests for each change.

## Key Files

- src/agent/memory-handlers.ts — consolidate, defrag
- src/modnet/modnet.constants.ts — MODNET_METADATA
- src/tools/validate-thread.ts — comparison logic
- src/tools/ingest-rules.ts — parseRuleSections
- Bun docs: Bun.JSONL.parse, Bun.Archive, Bun.hash, Bun.deepEquals, Bun.markdown

## Constraints

- Read CLAUDE.md and AGENTS.md for project conventions
- Only replace where Bun API is a clear improvement — don't force it
- Run `bun --bun tsc --noEmit` and `bun test src/` before committing
```

---

## Transport Pluggability (`src/agent/`)

### Prompt 6: Document and Type the Executor Pattern

```
Work in a worktree branch off chore/audit-tool.

## Task

Document and formalize the transport-level executor pattern for remote tool execution via SSH and A2A.

## Context

createAgentLoop already has a `toolExecutor` callback:

```typescript
toolExecutor: (toolCall: AgentToolCall, signal: AbortSignal) => Promise<unknown>
```

This is the pluggability seam. Local execution calls handlers directly. SSH execution serializes tool calls over SSH. A2A execution sends tool calls as A2A messages. Same tool code runs everywhere — only the transport varies.

Every built-in tool already has a CLI contract (JSON in/out, --schema) that makes remote execution straightforward: serialize the tool call, run the CLI on the remote machine, parse the result.

## What to Build

### 1. ToolExecutor Type Refinement (src/agent/agent.types.ts)

Formalize the executor type with factory functions:

```typescript
type ToolExecutor = (toolCall: AgentToolCall, signal: AbortSignal) => Promise<unknown>

type CreateLocalExecutorOptions = {
  workspace: string
  handlers: Record<string, ToolHandler>
}

type CreateSshExecutorOptions = {
  host: string
  port?: number
  username: string
  privateKey?: string
  workspace: string  // remote workspace path
}

type CreateA2AExecutorOptions = {
  client: A2AClient
  taskTimeout?: number
}
```

### 2. Local Executor Factory (src/agent/agent.executor.ts)

```typescript
export const createLocalExecutor = ({ workspace, handlers }: CreateLocalExecutorOptions): ToolExecutor => {
  return async (toolCall, signal) => {
    const handler = handlers[toolCall.name]
    if (!handler) throw new Error(`Unknown tool: ${toolCall.name}`)
    return handler(toolCall.arguments, { workspace, signal })
  }
}
```

This is what createAgentLoop uses by default when no custom executor is provided.

### 3. SSH Executor Factory (src/agent/agent.executor.ts)

Uses Bun.$ to run the tool CLI on a remote machine via SSH:

```typescript
export const createSshExecutor = ({ host, port, username, privateKey, workspace }: CreateSshExecutorOptions): ToolExecutor => {
  return async (toolCall, signal) => {
    const input = JSON.stringify({ ...toolCall.arguments, path: toolCall.arguments.path })
    const sshArgs = ['-o', 'StrictHostKeyChecking=accept-new']
    if (privateKey) sshArgs.push('-i', privateKey)
    if (port) sshArgs.push('-p', String(port))

    const result = await $`ssh ${sshArgs} ${username}@${host} bun run plaited ${toolCall.name} ${input}`
      .nothrow().quiet()

    if (result.exitCode !== 0) throw new Error(result.stderr.toString())
    return JSON.parse(result.stdout.toString())
  }
}
```

### 4. A2A Executor Factory (src/agent/agent.executor.ts)

Uses the A2A client to send tool calls as tasks to a remote node:

```typescript
export const createA2AExecutor = ({ client, taskTimeout = 30_000 }: CreateA2AExecutorOptions): ToolExecutor => {
  return async (toolCall, signal) => {
    const result = await client.sendMessage({
      message: {
        kind: 'message',
        messageId: crypto.randomUUID(),
        role: 'user',
        parts: [{ kind: 'data', data: { tool: toolCall.name, arguments: toolCall.arguments } }],
      },
      configuration: { blocking: true },
    })
    // Extract tool result from response
    if (result.kind === 'task' && result.artifacts?.[0]) {
      const part = result.artifacts[0].parts[0]
      if (part?.kind === 'data') return part.data
      if (part?.kind === 'text') return JSON.parse(part.text)
    }
    throw new Error('Unexpected A2A response format')
  }
}
```

### 5. Update createAgentLoop Default

If no toolExecutor is provided, createAgentLoop creates a local executor from builtInHandlers:

```typescript
const executor = toolExecutor ?? createLocalExecutor({ workspace: memoryPath, handlers: builtInHandlers })
```

Tests: test each executor factory. Mock SSH with a local Bun.spawn. Test A2A executor with a mock A2A server.

## Key Files

- src/agent/agent.loop.ts — createAgentLoop options
- src/agent/agent.types.ts — ToolExecutor type
- src/tools/crud.ts — builtInHandlers
- src/a2a/a2a.client.ts — A2AClient
- Bun docs: Bun.$ (shell), Bun.connect (TCP)

## Constraints

- Read CLAUDE.md and AGENTS.md for project conventions
- SSH executor uses Bun.$ not child_process
- A2A executor imports from src/a2a/
- All executors respect AbortSignal
- Run `bun --bun tsc --noEmit` and `bun test src/` before committing
```

---

## Context Management (`src/agent/`)

### Prompt 7: Tiered Context (Hot/Warm/Cold) with D→A Migration Path

```
Work in a worktree branch off chore/audit-tool.

## Task

Implement tiered context management (Variant D) — hot/warm/cold layers using existing infrastructure. This is the starting point for a migration path toward full hypergraph-backed recall (Variant A) as the model learns to search.

## Context

Current state:
- `agent.context.ts` has priority-based contributors with budget trimming
- `trimHistory` drops oldest messages when over budget
- `buildSessionSummary` in `hypergraph.utils.ts` produces structured metadata from decision documents (thread types, outcome events, tools used, decision count, commits)
- `consolidate` handler writes `meta.jsonld` with this summary
- `search` tool queries the hypergraph (causal-chain, co-occurrence, reachability, similar, match, provenance)

The problem: when context approaches the model's limit, older messages are dropped completely. The model loses orientation — it doesn't know what happened earlier or what decisions were made.

## Design: Three Tiers

### Hot Layer (in context, full detail)
Last N turns of conversation history. ~60% of budget. This is what `historyContributor` already provides via `trimHistory`.

### Warm Layer (in context, structured summary)
Session metadata from `.memory/sessions/{sessionId}/meta.jsonld`. Injected by a new `sessionSummaryContributor`. ~10% of budget. Gives the model orientation: "here's what this session has done so far." No LLM summarization — reads the already-persisted `meta.jsonld`.

### Cold Layer (on-demand via search tool)
Full decision history in `.memory/`. Available via the `search` tool when the model needs deeper recall. 0% of budget (not in context until the model queries it).

## What to Build

### 1. Session Summary Contributor (update src/agent/agent.context.ts)

New contributor function:

```typescript
export const sessionSummaryContributor = (memoryPath: string, sessionId: string): ContextContributor => ({
  name: 'sessionSummary',
  priority: 80,  // high — trimmed late, after history but before system prompt
  contribute: (state) => {
    // Read meta.jsonld synchronously if it exists
    // This runs during context assembly — needs to be fast
    const metaPath = join(memoryPath, 'sessions', sessionId, 'meta.jsonld')
    const file = Bun.file(metaPath)
    // Since contribute must be sync, cache the meta on first read
    // and update it when consolidate fires
    if (!cachedMeta) return null

    const summary = formatSessionSummary(cachedMeta)
    return {
      role: 'system',
      content: summary,
      tokenEstimate: estimateTokens(summary),
    }
  },
})
```

The contributor reads the `meta.jsonld` that `consolidate` already writes. Format the metadata into a concise prompt segment:

```
Session context (${meta.decisionCount} decisions):
Threads active: ${meta.threadTypes.join(', ')}
Events observed: ${meta.outcomeEvents.join(', ')}
Tools used: ${meta.toolsUsed.join(', ')}
${meta.commits ? `Commits: ${meta.commits.length}` : ''}
```

### 2. Async Meta Caching

The contributor function must be synchronous (per ContextContributor contract). But `Bun.file().text()` is async. Solution: cache the meta on session start and update it when `consolidate` fires.

```typescript
// In createAgentLoop, after consolidate handler runs:
useFeedback({
  [AGENT_EVENTS.consolidate]: async () => {
    // ... existing consolidate logic ...
    // After consolidate writes meta.jsonld, update the cache
    cachedSessionMeta = await loadMeta(memoryPath, sessionId)
  }
})
```

Or make the contributor factory async and load once at startup:

```typescript
export const createSessionSummaryContributor = async (
  memoryPath: string,
  sessionId: string,
): Promise<ContextContributor> => {
  let meta = await loadMetaIfExists(memoryPath, sessionId)
  return {
    name: 'sessionSummary',
    priority: 80,
    contribute: () => {
      if (!meta) return null
      return { role: 'system', content: formatSessionSummary(meta), tokenEstimate: estimateTokens(formatSessionSummary(meta)) }
    },
    // Expose updater for consolidate handler
    updateMeta: (newMeta: SessionMeta) => { meta = newMeta },
  }
}
```

### 3. Progressive History Trimming

Update `trimHistory` to be more aggressive in stages:

- **Stage 1** (mild): Drop messages older than N turns, keep tool results for context
- **Stage 2** (moderate): Drop tool result content, keep only `{ role: 'tool', content: '[truncated]', tool_call_id }` so the model knows a tool was called but not the full output
- **Stage 3** (aggressive): Keep only the last 3-5 turns

The current `trimHistory` does Stage 3 directly. Adding Stage 1 and 2 gives the model more context before hitting the wall.

### 4. Wire into createAgentLoop

Update `createAgentLoop` to:
1. Create the session summary contributor
2. Add it to the contributors list
3. Pass the updater to the consolidate handler

### 5. Structured System Prompt Builder (update src/agent/agent.context.ts)

Enhance `systemPromptContributor` from a simple string wrapper to a structured builder that composes multiple sources:

```typescript
export const createSystemPromptContributor = ({
  basePrompt,
  tools,
  skills,
  constitutionRules,
}: {
  basePrompt: string
  tools: ToolDefinition[]
  skills?: Array<{ name: string; description: string }>
  constitutionRules?: string[]
}): ContextContributor => ({
  name: 'systemPrompt',
  priority: 100,
  contribute: () => {
    const sections = [basePrompt]

    // Tool descriptions
    if (tools.length > 0) {
      sections.push('## Available Tools\n' + tools.map(t =>
        `- **${t.function.name}**: ${t.function.description}`
      ).join('\n'))
    }

    // Active skills
    if (skills && skills.length > 0) {
      sections.push('## Active Skills\n' + skills.map(s =>
        `- **${s.name}**: ${s.description}`
      ).join('\n'))
    }

    // Constitution rules (human-readable summary)
    if (constitutionRules && constitutionRules.length > 0) {
      sections.push('## Constraints\n' + constitutionRules.map(r => `- ${r}`).join('\n'))
    }

    const content = sections.join('\n\n')
    return { role: 'system', content, tokenEstimate: estimateTokens(content) }
  },
})
```

This replaces the current `systemPromptContributor(prompt: string)` with a factory that assembles the prompt from tools, skills, and constitution rules — like pi-mono's `buildSystemPrompt` but integrated into our contributor model.

### 6. Search Tool Hint in System Prompt

Update `systemPromptContributor` to include a hint about the search tool when the warm layer is active:

```
If you need to recall earlier decisions or context from this session,
use the search tool to query the hypergraph memory.
```

This primes the model for the D→A transition. As training progresses, the model learns to search proactively.

Tests:
- Test sessionSummaryContributor with mock meta.jsonld
- Test progressive trimming stages
- Test integration: context assembly with all three tiers
- Test that warm layer is included when meta.jsonld exists, absent when it doesn't

## Key Files

- src/agent/agent.context.ts — existing contributors and assembler
- src/agent/agent.loop.ts — createAgentLoop wiring
- src/tools/hypergraph.utils.ts — buildSessionSummary, SessionMeta type
- src/tools/hypergraph.schemas.ts — SessionMetaSchema
- src/agent/memory-handlers.ts — consolidate handler

## Design Decisions

**Why not LLM summarization (pi-mono pattern)?**
Our hypergraph already persists structured decision data. Spending an inference call to generate a lossy natural language summary is redundant when the full history is queryable on disk.

**Why tiered (D) before recall-only (A)?**
The model needs to learn to search. The warm layer gives it orientation passively (no learned behavior needed). As distillation trains search behavior, the warm layer's priority drops and eventually it's trimmed first.

**Why is the contributor priority 80?**
- System prompt: 100 (never trimmed)
- Session summary: 80 (trimmed after history but before system prompt)
- Rejections: 70 (trimmed before session summary — recent rejections are in history anyway)
- Tools: 60 (trimmed before rejections)
- Plan: 50 (trimmed before tools)
- History: 40 (trimmed first — the hot layer shrinks before the warm layer does)

## Constraints

- Read CLAUDE.md and AGENTS.md for project conventions
- Contributors must be pure functions (the caching is at the factory level, not in contribute())
- No LLM calls for summarization — use existing buildSessionSummary/meta.jsonld
- The search tool hint is a one-line addition to the system prompt, not a new contributor
- Run `bun --bun tsc --noEmit` and `bun test src/` before committing
```

---

## Training Skills (`skills/`)

### Prompt 8: Hypergraph Recall Skill (Phase 2 — Teach Search-Based Context Recall)

```
Work in a worktree branch off chore/audit-tool.

## Task

Create a skill that teaches agents (and the distillation pipeline) how to use the hypergraph search tool for proactive context recall. This skill enables the transition from Variant D (tiered context with passive warm layer) to Variant A (model-driven recall via search).

## Context

The agent has a hypergraph memory (`.memory/` with JSON-LD decision vertices) and a `search` tool with 7 query types: causal-chain, co-occurrence, check-cycles, match, similar, reachability, provenance. Currently the model receives a warm layer summary passively. The goal is to train the model to actively query its memory when it needs context.

This skill serves two audiences:
1. **Claude Code (distillation source)** — teaches the frontier model to use search in patterns we want our distilled model to learn
2. **Trial runner** — provides prompt cases and grading criteria for evaluating recall behavior

## What to Build

### 1. Skill Structure

```
skills/
  hypergraph-recall/
    SKILL.md                    ← when to search, which query for which situation
    references/
      recall-patterns.md        ← detailed search query selection guide
      context-triggers.md       ← signals that indicate context recall is needed
    assets/
      recall-prompts.jsonl      ← trial prompts for training recall behavior
```

### 2. SKILL.md

Teach the agent when and how to search:

**When to search:**
- Starting a new task that references earlier work ("continue the refactoring", "fix what we discussed")
- Encountering a gate rejection and needing to understand why a similar action succeeded/failed before
- Working on a file that has been modified in earlier decisions
- User references context from earlier in the session or previous sessions

**Which query for which situation:**

| Situation | Query | Example |
|---|---|---|
| "What led to this state?" | `causal-chain` | `{ query: 'causal-chain', from: 'session/s1/decision/5', to: 'session/s1/decision/20' }` |
| "What else touched this thread/event?" | `co-occurrence` | `{ query: 'co-occurrence', vertex: 'bp:thread/taskGate' }` |
| "Have I seen this problem before?" | `similar` | `{ query: 'similar', embedding: [...], topK: 5 }` (requires Indexer) |
| "Which decisions are reachable from here?" | `reachability` | `{ query: 'reachability', startVertices: ['session/s1/decision/1'], maxDepth: 5 }` |
| "What type of decisions followed this pattern?" | `match` | `{ query: 'match', pattern: { sequence: ['gate_approved', 'execute', 'tool_result'] } }` |
| "Are there circular dependencies?" | `check-cycles` | `{ query: 'check-cycles' }` |
| "What caused what?" | `provenance` | `{ query: 'provenance' }` |

**Key pattern: search before acting.** When the model needs context beyond the hot layer (recent messages), search the hypergraph first. The warm layer (session summary) provides orientation for knowing WHAT to search for.

### 3. references/recall-patterns.md

Detailed guide with examples for each query type, including:
- Input format with real-world `@id` URI patterns (`session/s1/decision/N`, `bp:thread/name`, `bp:event/name`)
- Output interpretation — what the results mean and how to use them
- Composition — chaining queries (e.g., co-occurrence → causal-chain to understand HOW two things are related)

### 4. references/context-triggers.md

Signals in the conversation that should trigger a search:
- User says "earlier", "before", "we discussed", "like last time", "continue"
- A gate rejects an action the model thought would succeed
- A tool result references a file the model hasn't seen in the hot layer
- The warm layer mentions threads/events the model wants to know more about
- The model's plan references a step that depends on earlier work

### 5. assets/recall-prompts.jsonl

Trial prompt cases for training recall behavior. Each prompt sets up a scenario where the model SHOULD search but might not:

```jsonl
{"id": "recall-earlier-decision", "input": "Continue the server refactoring we started earlier", "context": {"meta": {"threadTypes": ["taskGate", "batchCompletion"], "toolsUsed": ["edit_file", "bash"]}}, "expected_tool": "search", "expected_query": "co-occurrence"}
{"id": "recall-rejection-context", "input": "Try running the deploy command again", "context": {"priorRejections": ["bash: Rejected by gate (irreversible)"]}, "expected_tool": "search", "expected_query": "causal-chain"}
{"id": "recall-similar-problem", "input": "I'm getting the same error as before", "context": {}, "expected_tool": "search", "expected_query": "similar"}
{"id": "no-recall-needed", "input": "Read the contents of main.ts", "context": {}, "expected_tool": "read_file", "expected_query": null}
```

The grader checks: did the model call `search` when expected? Did it use the right query type? Did it NOT search when recall wasn't needed (avoid over-searching)?

### 6. Grader Integration

The recall prompts should work with the existing trial runner and bthread-grader infrastructure. The grader for recall behavior scores:
- **Recall precision:** searched when needed (true positive) / total searches (avoid false positives)
- **Recall coverage:** searched when needed / times search was needed (avoid false negatives)
- **Query selection:** correct query type for the situation

## Key Files

- src/tools/hypergraph.ts — search tool handler
- src/tools/hypergraph.schemas.ts — HypergraphQuerySchema (all 7 query types)
- src/agent/agent.context.ts — sessionSummaryContributor (provides warm layer)
- skills/trial-runner/ — trial infrastructure
- skills/compare-trials/ — analysis patterns
- docs/HYPERGRAPH-MEMORY.md — memory design

## Constraints

- Read CLAUDE.md and AGENTS.md for project conventions
- This is a SKILL (skills/), not framework code (src/)
- The skill teaches behavior — it doesn't implement code
- Recall prompts must be valid JSONL parseable by the trial runner
- Validate with: `bun plaited validate-skill skills/hypergraph-recall`
- The skill should be usable by both Claude Code (as context for distillation) and the trial runner (as eval criteria)
```

---

## Summary

| # | Prompt | Directory | Parallel Group |
|---|---|---|---|
| 1 | Output truncation + read enhancements | `src/tools/` | A |
| 2 | Grep tool + find enrichment + `ensureTool` | `src/tools/` | A (after #1 — uses truncation) |
| 3 | Edit with scan-assisted matching | `src/tools/` | A |
| 4 | Scan integration in ingestion + LSP + collision detection | `src/tools/` | A |
| 5 | Bun-native optimizations (JSONL, Archive, Hash, timing, etc.) | `src/tools/` + `src/agent/` + `src/modnet/` | B |
| 6 | Transport executor pattern (local, SSH, A2A) | `src/agent/` | B |
| 7 | Tiered context (hot/warm/cold) + structured system prompt | `src/agent/` | B |
| 8 | Hypergraph recall skill (Phase 2 training) | `skills/` | C (after #7 — uses warm layer) |

**pi-mono features folded in:** `ensureTool` utility (Prompt 2), skill collision detection (Prompt 4), startup timing via `Bun.nanoseconds()` (Prompt 5), structured system prompt builder (Prompt 7).

Group A (tools) and Group B (optimizations + transport + context) can run in parallel. Within Group A, prompt 2 depends on prompt 1 (grep uses truncation). Prompts 3 and 4 are independent. Prompts 5, 6, and 7 are independent within Group B. Prompt 8 depends on prompt 7 (the warm layer provides the orientation that recall builds on).

---

## Docs → Skills Migration (`docs/` + `skills/`)

Goal: Move implementation patterns from docs into skills (for agent training), slim docs down to public-facing framework documentation. Drop resolved historical artifacts.

### Prompt 9: Drop Resolved Historical Docs

```
Work in a worktree branch off chore/audit-tool.

## Task

Delete docs/GAP-ANALYSIS.md and docs/CRITIQUE-RESPONSE.md. Update all cross-references.

## Context

GAP-ANALYSIS.md identified 7 design gaps. CRITIQUE-RESPONSE.md resolved all 7. Both are historical artifacts — the resolutions are captured in the architecture docs they affected (SAFETY.md, CONSTITUTION.md, HYPERGRAPH-MEMORY.md, MODNET-IMPLEMENTATION.md, TRAINING.md). Keeping them adds confusion (TODO.md already noted "CRITIQUE-RESPONSE.md claims gaps are resolved — they aren't" because the distinction between "design exists" and "code exists" wasn't clear).

## What to Do

1. Delete docs/GAP-ANALYSIS.md
2. Delete docs/CRITIQUE-RESPONSE.md
3. Search all remaining docs, CLAUDE.md, TODO.md, and skills for references to these files and remove/update them
4. Verify no broken cross-references remain

## Constraints

- Read CLAUDE.md and AGENTS.md for project conventions
- Run `bun --bun tsc --noEmit` and `bun test src/` before committing (docs changes shouldn't break anything but verify)
```

### Prompt 10: Extract Agent Loop Patterns → Skill

```
Work in a worktree branch off chore/audit-tool.

## Task

Create skills/agent-loop/ seed skill by extracting implementation patterns from docs/AGENT-LOOP.md. Slim the doc down to a public-facing overview.

## Context

AGENT-LOOP.md is 440+ lines covering the 6-step loop, event flow, selective simulation, sub-agent harness, ACP interface, and proactive heartbeat. Most of this is implementation patterns that agents need to BUILD code — it belongs in a skill, not a doc.

## What to Build

### 1. Create skills/agent-loop/SKILL.md

Frontmatter:
```yaml
name: agent-loop
description: 6-step BP-orchestrated agent pipeline. Use when implementing createAgentLoop, wiring handlers, designing event flow, or building sub-agent coordination.
license: ISC
compatibility: Requires bun
```

Move INTO the skill:
- Event vocabulary table (all events, who produces, who consumes)
- BP pattern examples (taskGate, batchCompletion, sim_guard, maxIterations)
- Handler granularity guide
- Anti-pattern summary
- Selective simulation routing table
- Sub-agent 4-step harness
- Proactive mode (heartbeat, sensor sweep, tickYield)
- ACP interface (AgentNode shape)

### 2. Create skills/agent-loop/references/

- `event-flow.md` — the mermaid event flow diagrams
- `proactive-mode.md` — heartbeat design, sensor sweep, cost table
- `sub-agents.md` — 4-step harness, SubAgentHandle

### 3. Slim docs/AGENT-LOOP.md

Keep ONLY:
- Status header
- One-paragraph overview ("The agent loop is a 6-step pipeline...")
- The main mermaid diagram (high-level flow)
- Step descriptions (1-2 sentences each, not full patterns)
- Cross-reference to skills/agent-loop/ for implementation details

Target: ~60 lines (down from 440+).

### 4. Update cross-references

CLAUDE.md, TODO.md, other docs that reference AGENT-LOOP.md patterns — point them to the skill instead.

## Constraints

- Read CLAUDE.md and AGENTS.md for project conventions
- Validate skill: `bun plaited validate-skill skills/agent-loop`
```

### Prompt 11: Extract Constitution Patterns → Skill

```
Work in a worktree branch off chore/audit-tool.

## Task

Create skills/constitution/ seed skill from docs/CONSTITUTION.md. Slim the doc.

## What to Build

### 1. Create skills/constitution/SKILL.md

Move INTO the skill:
- Governance factory contract (type signatures, branded factories)
- MAC/DAC loading patterns
- Generated bThread flow (test-first, verification stack)
- protectGovernance bThread pattern
- Goal/workflow factory examples

### 2. Create skills/constitution/references/

- `factory-patterns.md` — factory signatures, brand emoji, return shapes
- `generated-bthreads.md` — generation flow, verification layers, .memory/goals/ structure
- `mac-rules.md` — default MAC factories (noRmRf, noEtcWrites, noForcePush, protectGovernance)

### 3. Slim docs/CONSTITUTION.md

Keep ONLY:
- Neuro-symbolic split rationale (WHY symbolic constraints + neural reasoning)
- MAC/DAC/ABAC conceptual explanation (not implementation)
- Ratchet principle explanation
- Cross-reference to skills/constitution/

Target: ~80 lines.

## Constraints

- Validate skill: `bun plaited validate-skill skills/constitution`
```

### Prompt 12: Merge BP Reference → behavioral-core Skill

```
Work in a worktree branch off chore/audit-tool.

## Task

Merge docs/BEHAVIORAL-PROGRAMMING.md content into skills/behavioral-core/. Delete the doc.

## Context

behavioral-core skill already covers BP patterns. BEHAVIORAL-PROGRAMMING.md is the formal algorithm reference. Most content overlaps. The formal definitions and algorithm description should become a reference file in the skill.

## What to Do

1. Move the formal algorithm content (super-step execution, priority selection, timing semantics) into skills/behavioral-core/references/algorithm-formal.md
2. Move pattern catalog (stopGame, shared state, counter-based) into skills/behavioral-core/references/ if not already there
3. Delete docs/BEHAVIORAL-PROGRAMMING.md
4. Update cross-references

## Constraints

- Don't duplicate — if behavioral-core already covers a pattern, don't copy it again
- Validate: `bun plaited validate-skill skills/behavioral-core`
```

### Prompt 13: Extract Hypergraph Memory → Skill

```
Work in a worktree branch off chore/audit-tool.

## Task

Create skills/hypergraph-memory/ from docs/HYPERGRAPH-MEMORY.md. Slim the doc.

## What to Build

### 1. Create skills/hypergraph-memory/SKILL.md

Move INTO the skill:
- JSON-LD vertex taxonomy (@context, @id, @type patterns)
- Session lifecycle (decisions → consolidate → defrag)
- Commit vertex architecture (one-behind pattern)
- Context assembly as BP event
- Training data extraction patterns

### 2. references/

- `vertex-schemas.md` — Decision, Session, Commit, Skill, RuleSet vertex shapes
- `causation-map.md` — EVENT_CAUSATION relationships
- `session-lifecycle.md` — commit_snapshot → consolidate → defrag flow

### 3. Slim docs/HYPERGRAPH-MEMORY.md

Keep ONLY: "Why JSON-LD over SQLite", "Why git-versioned", high-level memory architecture overview.

## Constraints

- Validate: `bun plaited validate-skill skills/hypergraph-memory`
```

### Prompt 14: Extract Training Pipeline → Skill

```
Work in a worktree branch off chore/audit-tool.

## Task

Create skills/training-pipeline/ from docs/TRAINING.md. Slim the doc.

## Context

TRAINING.md overlaps heavily with existing trial-runner, trial-adapters, compare-trials skills. The new skill focuses on the distillation pipeline design, training tiers, and data format requirements that those skills don't cover.

## What to Build

### 1. Create skills/training-pipeline/SKILL.md

Move INTO the skill:
- Distillation stages (bootstrap → refinement → probing)
- SFT/GRPO data mix requirements
- Training tier selection (consumer LoRA, enterprise full-parameter)
- DecisionStep as process signal
- GradingDimensions scoring
- Cross-project knowledge transfer via weights

### 2. references/

- `data-format.md` — trajectory format, decision step schema, grading dimensions
- `distillation-stages.md` — bootstrap, refinement, probing with examples

### 3. Slim docs/TRAINING.md

Keep ONLY: high-level training philosophy, why distillation (not pre-trained), flywheel concept.

## Constraints

- Validate: `bun plaited validate-skill skills/training-pipeline`
```

### Prompt 15: Merge UI + WebSocket → generative-ui Skill

```
Work in a worktree branch off chore/audit-tool.

## Task

Merge implementation patterns from docs/UI.md and docs/WEBSOCKET-ARCHITECTURE.md into skills/generative-ui/. Slim both docs.

## Context

generative-ui skill already covers the controller protocol and custom elements. UI.md has rendering pipeline details and CSS system. WEBSOCKET-ARCHITECTURE.md has design decisions (some resolved, some open).

## What to Do

1. Move rendering pipeline details (createSSR, decorateElements, CSS system) from UI.md into generative-ui/references/ if not already there
2. Move resolved WebSocket decisions (replay buffer, reconnection, CSP) from WEBSOCKET-ARCHITECTURE.md into generative-ui/references/
3. Slim UI.md to overview only (~40 lines)
4. Delete WEBSOCKET-ARCHITECTURE.md if all content is moved (or slim to "open questions" only if any remain)
5. Update cross-references

## Constraints

- Don't duplicate — check what generative-ui already covers
- Validate: `bun plaited validate-skill skills/generative-ui`
```

### Prompt 16: Extract Project Isolation → Skill

```
Work in a worktree branch off chore/audit-tool.

## Task

Create skills/project-isolation/ from docs/PROJECT-ISOLATION.md. Slim the doc.

## What to Build

### 1. Create skills/project-isolation/SKILL.md

Move INTO the skill:
- Orchestrator + subprocess architecture (mermaid diagram)
- IPC trigger bridge code patterns
- Tool layer assembly (framework → global → project)
- Constitution loading at spawn
- Two levels of Bun.spawn (project subprocess vs sub-agent)

### 2. references/

- `ipc-bridge.md` — Bun.spawn IPC patterns, structured clone serialization
- `tool-assembly.md` — three-layer tool discovery, approval model

### 3. Slim docs/PROJECT-ISOLATION.md

Keep ONLY: "Why process isolation", isolation guarantees table, cross-reference to skill.

## Constraints

- Validate: `bun plaited validate-skill skills/project-isolation`
```

---

## Updated Summary

| # | Prompt | Directory | Parallel Group |
|---|---|---|---|
| 1 | Output truncation + read enhancements | `src/tools/` | A |
| 2 | Grep tool + find enrichment + `ensureTool` | `src/tools/` | A (after #1) |
| 3 | Edit with scan-assisted matching | `src/tools/` | A |
| 4 | Scan integration in ingestion + LSP + collision detection | `src/tools/` | A |
| 5 | Bun-native optimizations (JSONL, Archive, Hash, timing, etc.) | `src/tools/` + `src/agent/` + `src/modnet/` | B |
| 6 | Transport executor pattern (local, SSH, A2A) | `src/agent/` | B |
| 7 | Tiered context (hot/warm/cold) + structured system prompt | `src/agent/` | B |
| 8 | Hypergraph recall skill (Phase 2 training) | `skills/` | C (after #7) |
| 9 | Drop resolved historical docs | `docs/` | D |
| 10 | Agent loop patterns → skill | `docs/` + `skills/` | D |
| 11 | Constitution patterns → skill | `docs/` + `skills/` | D |
| 12 | BP reference → merge into behavioral-core | `docs/` + `skills/` | D |
| 13 | Hypergraph memory → skill | `docs/` + `skills/` | D |
| 14 | Training pipeline → skill | `docs/` + `skills/` | D |
| 15 | UI + WebSocket → merge into generative-ui | `docs/` + `skills/` | D |
| 16 | Project isolation → skill | `docs/` + `skills/` | D |

Groups A, B, C, D, E can all run in parallel. All prompts in Group D are independent of each other (each touches different docs and skills).

---

## ACP Integration (`src/agent/`)

### Prompt 17: ACP Debug Viewport via @agentclientprotocol/sdk

```
Work in a worktree branch off chore/audit-tool.

## Task

Implement ACP (Agent Client Protocol) as a debug/admin viewport into any Plaited node. An admin SSHs into a box via their editor (Zed, VS Code Remote), then runs `plaited acp --node <name>` to ACP into any node on that box — observing all BP events, A2A traffic, and interacting with the node.

## Context

ACP is the standard protocol for editor ↔ coding agent communication. It uses JSON-RPC over stdio. Our architecture has:
- `createAgentLoop()` returning `AgentNode { trigger, subscribe, snapshot, destroy }`
- A2A protocol in `src/a2a/` for agent-to-agent communication
- Multiple nodes per box in enterprise deployments (PM, registry, workers)

**Key insight:** When an admin SSHs into a box via their editor, they have admin access to ALL nodes running on that box. ACP over stdio gives them a debug viewport into any node — same as the generative UI (WebSocket) but from their code editor.

**ACP is a control UI transport** — like WebSocket for browsers, ACP is for editors. Both bridge to the same AgentNode interface. The adapter is the same pattern as `src/server/server.ts` but over stdio instead of WebSocket.

### ACP Lifecycle

1. `initialize` — negotiate capabilities
2. `session/new` — create a session (receives cwd, MCP server configs)
3. `session/prompt` — user sends a message → agent processes
4. `session/update` — agent streams progress (message chunks, tool calls, plans, A2A traffic)
5. `session/cancel` — user cancels in-progress work

## Dependency

```bash
bun add @agentclientprotocol/sdk
```

Reference: https://agentclientprotocol.github.io/typescript-sdk/classes/AgentSideConnection.html

## What to Build

### 1. ACP Agent Adapter (src/agent/acp-adapter.ts)

Implement the `Agent` interface from @agentclientprotocol/sdk:

```typescript
import { AgentSideConnection, ndJsonStream } from '@agentclientprotocol/sdk'
import type { Agent } from '@agentclientprotocol/sdk'

type CreateAcpAdapterOptions = {
  resolveNode: (name?: string) => AgentNode | Promise<AgentNode>
}

export const createAcpAdapter = (options: CreateAcpAdapterOptions): Agent => { ... }
```

**Method mappings:**

| ACP Method | Our Architecture |
|---|---|
| `initialize` | Return capabilities (text prompts, MCP stdio support, A2A observation extension) |
| `newSession` | Resolve the target node via `resolveNode()`, create session against its AgentNode |
| `prompt` | Trigger `{ type: 'task', detail: { prompt } }`. Subscribe to events. Stream `session/update` back via `conn.sessionUpdate()`. Return on `message` event. |
| `cancel` | Propagate abort signal |
| `loadSession` | Restore from hypergraph memory if session exists |

**Event bridging (BP events → ACP session/update):**

| BP Event | ACP session/update |
|---|---|
| `thinking_delta` | `agent_thought_chunk` with text content |
| `text_delta` | `agent_message_chunk` with text content |
| `execute` (start) | `tool_call` with status `in_progress` |
| `tool_result` | `tool_call` with status `completed` + result content |
| `gate_rejected` | `tool_call` with status `completed` + error content |
| `message` | Return `PromptResponse` with `stopReason: 'endTurn'` |
| `inference_error` | Return `PromptResponse` with `stopReason: 'error'` |

**Permission bridging:**

Non-workspace risk tags → `conn.requestPermission()` to ask the editor user.
- `selected` (approved) → continue execute
- `cancelled` → trigger gate_rejected

BP gate does structural safety. ACP permission does user consent. Both must approve.

### 2. A2A Traffic Observation (extNotification)

Use ACP's `extNotification` for custom A2A observation. When the admin is debugging a node, they see all A2A messages:

```typescript
// Subscribe to A2A events on the target node
node.subscribe({
  // Inbound A2A messages
  a2a_inbound(detail: unknown) {
    conn.extNotification('plaited/a2a_inbound', detail as Record<string, unknown>)
  },
  // Outbound A2A messages
  a2a_outbound(detail: unknown) {
    conn.extNotification('plaited/a2a_outbound', detail as Record<string, unknown>)
  },
})
```

ACP clients that don't understand `plaited/a2a_*` extensions silently ignore them (per spec). Editors that support it can render A2A traffic in a dedicated panel.

### 3. Multi-Node CLI Entry Point (src/acp.ts)

```typescript
#!/usr/bin/env bun
import { AgentSideConnection, ndJsonStream } from '@agentclientprotocol/sdk'
import { createAcpAdapter } from './agent/acp-adapter.ts'

// --node flag selects which node to connect to
const nodeName = process.argv.find((_, i, a) => a[i - 1] === '--node') ?? 'default'

const adapter = createAcpAdapter({
  resolveNode: async (name) => {
    // Resolve node by name → connect via unix socket or direct import
    // Nodes on same box use unix sockets (from MODNET-IMPLEMENTATION.md)
    return connectToNode(name ?? nodeName)
  },
})

const conn = new AgentSideConnection(() => adapter, ndJsonStream(process.stdin, process.stdout))
await conn.closed
```

Usage from editor terminal (after SSH):
```bash
plaited acp                        # connect to default/only node
plaited acp --node pm              # connect to PM/orchestrator
plaited acp --node registry        # connect to Registry node
plaited acp --node worker-alice    # connect to Alice's worker
```

### 4. Node Resolution

Discover running nodes on the box:

```typescript
const connectToNode = async (name: string): Promise<AgentNode> => {
  // Option A: Unix socket (nodes expose AgentNode via unix socket)
  const socketPath = `/tmp/plaited-${name}.sock`
  if (await Bun.file(socketPath).exists()) {
    return connectViaSocket(socketPath)
  }

  // Option B: Direct import (single-node development)
  const { createAgentLoop } = await import('./agent/agent.loop.ts')
  return createAgentLoop({ ... })
}
```

For enterprise boxes with multiple nodes, each node publishes a unix socket. The ACP adapter connects to the target node's socket. For single-node development, the adapter creates the loop directly.

### 5. Session Management + MCP Passthrough

Map ACP sessions to AgentNode interactions:

```typescript
const sessions = new Map<string, { node: AgentNode; disconnect: () => void }>()
```

Forward editor-provided MCP servers to the node's tool discovery using existing `skills/add-mcp/` infrastructure.

## Key Files

- src/agent/agent.loop.ts — createAgentLoop, AgentNode
- src/agent/agent.types.ts — existing types
- src/server/server.ts — reference for WebSocket transport adapter pattern
- src/a2a/ — A2A protocol (the traffic we're observing)
- skills/add-mcp/ — MCP client for tool discovery
- @agentclientprotocol/sdk — TypeScript SDK
- https://agentclientprotocol.github.io/typescript-sdk/classes/AgentSideConnection.html
- https://agentclientprotocol.com/protocol/prompt-turn

## Design Notes

**ACP is a control UI transport, not a separate mode.** Like WebSocket (browsers) and IPC (orchestrator), ACP (editors) is another way to reach the AgentNode interface. The node doesn't know which transport delivered the task.

**SSH + editor remote = admin access to all nodes.** When you SSH into an enterprise box via Zed/VS Code Remote, you can `plaited acp --node <name>` into any node. No additional auth — SSH provides the admin credential.

**A2A observation via extNotification.** The admin sees all inbound/outbound A2A traffic for the connected node. For the PM node, this means seeing all orchestration traffic to registry, observer, gateway, and workers. Standard ACP clients ignore extensions they don't understand.

**Same adapter, any node type.** Whether you connect to a PM node, a worker node, or a registry node, the ACP adapter works identically — it bridges to that node's AgentNode. The node's constitution determines what the node can/can't do; the ACP adapter just exposes it.

## Tests (src/agent/tests/acp-adapter.spec.ts)

Test with mock stdio streams:

1. Initialize → capabilities include A2A observation extension
2. New session → AgentNode resolved and connected
3. Prompt → task triggered, events streamed as session/updates
4. Cancel → abort signal propagated
5. A2A observation → extNotification sent for inbound/outbound A2A traffic
6. Multi-session → independent connections to same node
7. Node resolution → correct node resolved by name

## Constraints

- Read CLAUDE.md and AGENTS.md for project conventions
- Use `@agentclientprotocol/sdk` — don't re-implement JSON-RPC
- The adapter is a thin bridge — same pattern as src/server/server.ts but stdio
- `extNotification` for A2A observation (prefixed `plaited/`)
- If your changes affect docs/ or skills/, update in the same commit
- Run `bun --bun tsc --noEmit` and `bun test src/` before committing
```

---

---

## Secret Management (`skills/`)

### Prompt 18: Varlock Integration — AI-Safe Environment Configuration

```
Work in a worktree branch off chore/audit-tool.

## Task

Create a Varlock integration skill and MCP-backed search skill for AI-safe environment configuration. Varlock lets agents understand environment configuration requirements (.env.schema) without ever seeing actual secret values.

## Context

Varlock (https://varlock.dev/) provides:
- `.env.schema` files that describe environment variables with metadata (@sensitive, @required, @type)
- Runtime resolution from multiple sources (local files, env-specific overrides, external secret managers)
- AI-safe design — agents read schemas for context, never access actual secrets
- Leak detection and prevention for logs and bundled code
- Secret provider plugins (1Password, Infisical, AWS, Azure, Google, Bitwarden)

This is critical for our enterprise deployment model: when seeds generate nodes, they need to declare environment requirements. When the PM provisions worker nodes, it needs to know what secrets each node requires without seeing the values.

## What to Build

### 1. Varlock Docs MCP Skill (skills/search-varlock-docs/)

Generate a search skill from Varlock's MCP documentation server using the existing add-remote-mcp skill infrastructure.

MCP server URL: `https://docs.mcp.varlock.dev/mcp`

Use the add-remote-mcp skill to:
1. Discover the MCP server capabilities: `mcpDiscover('https://docs.mcp.varlock.dev/mcp')`
2. List available tools: `mcpListTools('https://docs.mcp.varlock.dev/mcp')`
3. Generate a search wrapper script following the same pattern as search-bun-docs, search-mcp-docs, search-agent-skills
4. Create the SKILL.md with appropriate frontmatter

```
skills/search-varlock-docs/
  SKILL.md
  scripts/
    search.ts          ← wrapper calling the MCP server
    tests/
      search.spec.ts
```

### 2. Varlock Integration Skill (skills/varlock/)

A skill that teaches agents how to use Varlock for node configuration:

```
skills/varlock/
  SKILL.md                    ← when/how to use Varlock in the Plaited context
  references/
    schema-patterns.md        ← .env.schema patterns for node configuration
    enterprise-secrets.md     ← secret provider setup for enterprise deployments
    constitution-rules.md     ← MAC bThread patterns for secret protection
```

#### SKILL.md content:

**When to use:**
- Setting up a new node that needs environment configuration
- Enterprise provisioning where secrets come from external providers
- Generating seeds that declare environment requirements
- Ensuring agent never leaks secrets into context/history/training data

**Schema patterns for Plaited nodes:**

```ini
# .env.schema for a Plaited agent node

# Model inference
INFERENCE_URL=http://localhost:11434
  @type url
  @required
  @description Local inference server endpoint

INFERENCE_API_KEY=
  @sensitive
  @required
  @description API key for hosted inference (empty for local)
  @source exec('op read "op://Plaited/inference-key/credential"')

# A2A
A2A_CERT_PATH=
  @sensitive
  @required
  @type path
  @description mTLS certificate for A2A communication

A2A_KEY_PATH=
  @sensitive
  @required
  @type path
  @description mTLS private key

# Node identity
NODE_ROLE=worker
  @type enum(pm,worker,registry,observer)
  @required

NODE_NAME=
  @required
  @description Human-readable node identifier
```

**Constitution rules for secret protection:**

A MAC bThread that blocks the agent from including .env content in context assembly or tool outputs:

```typescript
// Block reading .env files (only .env.schema is safe)
bSync({
  block: (e) =>
    e.type === AGENT_EVENTS.execute &&
    e.detail?.toolCall?.name === 'read_file' &&
    e.detail?.toolCall?.arguments?.path?.match(/\.env($|\.)/) &&
    !e.detail?.toolCall?.arguments?.path?.endsWith('.env.schema'),
}, true)
```

**Enterprise secret providers:**

For enterprise nodes, secrets resolve from the org's secret manager at runtime via Varlock's provider plugins:

```ini
DATABASE_URL=
  @sensitive
  @required
  @source exec('aws secretsmanager get-secret-value --secret-id plaited/db-url --query SecretString --output text')
```

The agent sees the schema (knows a DATABASE_URL is needed), generates code that reads `process.env.DATABASE_URL`, but never sees the actual connection string.

### 3. CLI Integration

Add `varlock` as an optional tool in the node setup flow:

```bash
# Initialize Varlock in a node workspace
bunx varlock init

# Validate environment against schema
bunx varlock validate

# Run node with validated environment
bunx varlock run -- bun run src/main.ts
```

The seed skill for node generation should include Varlock initialization when the deployment requires secret management.

## Key Files

- skills/add-remote-mcp/ — MCP skill generation infrastructure
- skills/search-bun-docs/ — reference pattern for generated MCP search skills
- src/agent/agent.governance.ts — constitution MAC factories (reference for secret protection bThread)
- src/modnet/modnet.constants.ts — NODE_ROLE (used in schema patterns)
- docs/MODNET-IMPLEMENTATION.md — enterprise topology (where secrets matter)

## Design Notes

**Varlock replaces .env.example files.** Instead of stale .env.example with placeholder values, .env.schema is the single source of truth with types, sensitivity markers, and provider references. Seeds generate .env.schema as part of node setup.

**Secret protection is a constitution concern.** The bThread blocking .env reads is a MAC rule — the agent can't override it. Only .env.schema is readable. This prevents secret leakage into context/history/training data by design.

**MCP server for docs.** Varlock provides its own MCP server for documentation search. Using add-remote-mcp to generate a search skill gives us the same pattern as our other doc search skills (bun docs, MCP docs, AgentSkills docs).

## Constraints

- Read CLAUDE.md and AGENTS.md for project conventions
- Use add-remote-mcp skill to generate the MCP search skill (don't build from scratch)
- The Varlock integration skill is a SKILL (skills/), not framework code (src/)
- The constitution bThread for secret protection is a PATTERN in the skill, not implemented code — it's a reference for seeds to use when generating nodes
- Validate: `bun plaited validate-skill skills/search-varlock-docs skills/varlock`
- If your changes affect docs/ or skills/, update in the same commit
- Run `bun --bun tsc --noEmit` and `bun test src/ skills/` before committing
```

---

## Final Summary

| # | Prompt | Directory | Parallel Group |
|---|---|---|---|
| 1 | Output truncation + read enhancements | `src/tools/` | A |
| 2 | Grep tool + find enrichment + `ensureTool` | `src/tools/` | A (after #1) |
| 3 | Edit with scan-assisted matching | `src/tools/` | A |
| 4 | Scan integration in ingestion + LSP + collision detection | `src/tools/` | A |
| 5 | Bun-native optimizations (JSONL, Archive, Hash, timing, etc.) | `src/tools/` + `src/agent/` + `src/modnet/` | B |
| 6 | Transport executor pattern (local, SSH, A2A) | `src/agent/` | B |
| 7 | Tiered context (hot/warm/cold) + structured system prompt | `src/agent/` | B |
| 8 | Hypergraph recall skill (Phase 2 training) | `skills/` | C (after #7) |
| 9 | Drop resolved historical docs | `docs/` | D |
| 10 | Agent loop patterns → skill | `docs/` + `skills/` | D |
| 11 | Constitution patterns → skill | `docs/` + `skills/` | D |
| 12 | BP reference → merge into behavioral-core | `docs/` + `skills/` | D |
| 13 | Hypergraph memory → skill | `docs/` + `skills/` | D |
| 14 | Training pipeline → skill | `docs/` + `skills/` | D |
| 15 | UI + WebSocket → merge into generative-ui | `docs/` + `skills/` | D |
| 16 | Project isolation → skill | `docs/` + `skills/` | D |
| 17 | ACP debug viewport (multi-node, A2A observation) | `src/agent/` | E |
| 18 | Varlock integration (AI-safe secrets, MCP docs) | `skills/` | F (after B/Prompt 6) |

Groups A–F can run in parallel where dependencies allow. Prompt 18 depends loosely on Prompt 6 (transport executor pattern establishes the seam that secret-aware node setup builds on), but the skill itself is independent.
