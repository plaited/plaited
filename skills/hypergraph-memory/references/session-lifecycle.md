# Session Lifecycle

The complete flow from decision writes through commit_snapshot, consolidation, and defrag — coordinated by bThreads.

## Overview

```
BP decision → write .jsonld → [accumulate] → side-effect tool → commit_snapshot
                                                                      ↓
                                                            git commit (code + decisions)
                                                                      ↓
                                                            write commit vertex (pending)
                                                                      ↓
                                                 [next side-effect bundles it into next commit]
                                                                      ↓
                                                            session end → consolidate
                                                                      ↓
                                                            decisions/ → decisions.jsonl
                                                                      ↓
                                                         N sessions → defrag (archive)
```

## bThread Coordination

Four bThreads orchestrate memory operations:

### sideEffectCommit

Commits code + pending decisions on side-effect-producing tool results.

```typescript
sideEffectCommit: bThread([
  bSync({
    waitFor: (e) => e.type === 'tool_result' &&
      ['write_file', 'edit_file', 'bash'].includes(e.detail?.tool),
    interrupt: ['message'],
  }),
  bSync({ request: { type: 'commit_snapshot' } }),
], true)
```

### sessionClose

Archives decisions at session end.

```typescript
sessionClose: bThread([
  bSync({ waitFor: 'message' }),
  bSync({ request: { type: 'consolidate' } }),
], true)
```

### defragSchedule

Triggers defrag after N session completions.

```typescript
defragSchedule: bThread([
  ...Array.from({ length: N }, () =>
    bSync({ waitFor: 'message' })
  ),
  bSync({ request: { type: 'defrag' } }),
], true)
```

### contextGate

Blocks inference until all context contributors report.

```typescript
contextGate: bThread([
  bSync({
    waitFor: 'context_assembly',
    block: 'invoke_inference',
    interrupt: ['message'],
  }),
  // N bSync({ waitFor: isContextSegment }) — count set dynamically
  bSync({ request: { type: 'invoke_inference' }, interrupt: ['message'] }),
], true)
```

### memoryIntegrity

Constitution rule protecting the base vocabulary.

```typescript
memoryIntegrity: bThread([
  bSync({
    block: (e) => e.type === 'execute' &&
      e.detail?.command?.includes('.memory/@context.jsonld'),
  }),
], true)
```

## commit_snapshot Handler

The handler runs after the `sideEffectCommit` bThread requests `commit_snapshot`:

```typescript
useFeedback({
  async [AGENT_EVENTS.commit_snapshot]({ modulePath, toolResult }) {
    // 1. Gather pending decision files + commit vertices from previous commits
    const pendingDecisions = glob(`${modulePath}/.memory/sessions/*/decisions/*.jsonld`)
    const pendingCommitVertices = glob(`${modulePath}/.memory/sessions/*/commits/*.jsonld`)

    // 2. Stage code changes + pending memory files
    await Bun.$`git add ${changedFiles} ${pendingDecisions} ${pendingCommitVertices}`

    // 3. Commit
    await Bun.$`git commit -m ${'feat: ' + summarize(toolResult)}`

    // 4. Capture SHA
    const sha = (await Bun.$`git rev-parse HEAD`.text()).trim()

    // 5. Write commit vertex — PENDING for next commit (one-behind)
    const commitVertex = {
      '@context': '../../../@context.jsonld',
      '@id': `git:${sha}`,
      '@type': 'Commit',
      session: `session/${sessionId}`,
      attestsTo: pendingDecisions.map(fileToDecisionId),
      artifacts: await getChangedFiles(sha),
      timestamp: new Date().toISOString(),
    }
    await Bun.write(
      `${modulePath}/.memory/sessions/${sessionId}/commits/${sha}.jsonld`,
      JSON.stringify(commitVertex, null, 2),
    )

    // 6. Notify
    trigger({ type: 'snapshot_committed', detail: { sha, modulePath } })
  },
})
```

### One-Behind Pattern Explained

You cannot include a receipt inside the transaction it describes — the transaction's identity (SHA) depends on its contents. So:

| Commit | Contains |
|---|---|
| N | Code change + decision files + commit vertex for N-1 |
| N+1 | Next code change + more decisions + commit vertex for N |
| Final (session close) | Remaining commit vertices + consolidated JSONL |

The very last commit vertex (for the session-closing commit itself) is orphaned in the working tree until the next session or defrag cycle.

## Consolidation Flow

The `consolidate` handler runs when `sessionClose` requests it:

1. **Read** all `decisions/*.jsonld` files in the session
2. **Concatenate** into `decisions.jsonl` (one JSON-LD document per line)
3. **Write** `meta.jsonld` with summary, embedding, outcome via `buildSessionSummary()`
4. **Remove** individual decision files from working tree
5. **Commit** the JSONL + meta.jsonld + cleanup

**Post-consolidation session directory:**
```
.memory/sessions/{session_id}/
├── meta.jsonld          # summary, embedding, outcome
├── trajectory.jsonld    # tool calls + outputs
├── decisions.jsonl      # consolidated archive (one doc per line)
└── commits/             # commit vertices
```

The `hypergraph` CLI loads from either format — directory of individual files OR single JSONL.

## Defrag Flow

The `defrag` handler runs after N sessions complete:

1. **Identify** old sessions beyond retention window
2. **Archive** via `git archive` — removes from working tree
3. **Reorganize** remaining files
4. Full history preserved in git's object store — `git log .memory/sessions/` still works

## Commit Frequency Matrix

| Event | Write `.jsonld`? | Git commit? | Commit vertex? |
|---|---|---|---|
| Any BP decision | Yes (decision file) | No | No |
| `tool_result` from read_file, list_files | Yes | No | No |
| `tool_result` from write_file, edit_file, bash | Yes | **Yes** | **Yes** (pending) |
| `message` (session end) | Yes | **Yes** (final) | **Yes** (orphaned) |

**Why per-side-effect:**
- Per-session: loses correlation between decisions and code changes
- Per-decision: too noisy — most supersteps produce no code diff
- Per-side-effect: every commit has a meaningful code diff paired with its reasoning chain — a labeled `(reasoning, code_change)` training pair
