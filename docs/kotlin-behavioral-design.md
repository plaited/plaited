# Kotlin Behavioral Programming — Design Spec (Mobile Agent Runtime)

## Overview

This document defines the Kotlin behavioral engine architecture for the Android agent.
It is a **semantic twin** of the TypeScript server runtime and the Swift iOS runtime —
same algorithm, same data model, same Spec JSON contract, same SQLite schema.

Kotlin targets Android. The engine integrates with **App Functions** to expose
agent capabilities to Gemini and the Android AI subsystem.

**Related documents:**
- `docs/typescript-behavioral-design.md` — TS server runtime
- `docs/swift-behavioral-design.md` — iOS runtime
- `docs/dart-behavioral-design.md` — original Dart design (informational)

---

## Table of Contents

1. [Thread Representation](#1-thread-representation)
2. [Behavioral Engine](#2-behavioral-engine)
3. [Persistence & Storage](#3-persistence--storage)
4. [Spec Contract](#4-spec-contract)
5. [App Functions Integration](#5-app-functions-integration)
6. [Frontier Analysis](#6-frontier-analysis)
7. [Summary](#7-summary)

---

## 1. Thread Representation

### Decision

Use a **class-based model** (`BThread` + `advance()`) with an optional
Kotlin `sequence { }` / `iterator { }` bridge. Kotlin has generators
(`Sequence<T>`, `Iterator<T>`, `Flow<T>`) but they are **pull-based
collections** not resumable coroutines suitable for the BP engine's
side-effect model. A class with explicit position cursor gives serialization
and matches the Swift/Dart approach.

### Rationale

| Concern | Kotlin Sequence/Flow | Object-based (class + advance()) |
|---|---|---|
| Serialize thread state | ❌ `sequence { }` position is opaque | ✅ `position` is an int |
| Restore mid-execution | ❌ Must replay all events | ✅ Set `position` and go |
| Spec JSON → runtime | ❌ | ✅ `Spec.fromJson()` → `BThread` |
| Store in SQLite | ❌ | ✅ One row per thread |
| CRDT sync with TS | ❌ No shared representation | ✅ Identical Spec JSON |
| Coroutine-style feel | ✅ Natural Kotlin | ❌ More imperative |

**Hybrid approach**: Use `sequence { }` as a DSL sugar for constructing
BThreads, but the engine operates on the class model. The Spec JSON is
always the serialization boundary.

### Class Design

```kotlin
// src/main/kotlin/com/plaited/behavioral/BThread.kt

data class Idioms(
    val request: BPEvent? = null,
    val waitFor: List<BPListener>? = null,
    val block: List<BPListener>? = null,
    val interrupt: List<BPListener>? = null
)

class BThread(
    val label: String,
    val syncPoints: List<Idioms>,
    val once: Boolean = false,
    var position: Int = 0
) {
    /** Advance to the next sync point. Returns null when the thread completes. */
    fun advance(): Idioms? {
        if (syncPoints.isEmpty()) return null
        if (position >= syncPoints.size) {
            if (once) return null
            position = 0
        }
        return syncPoints[position++]
    }

    fun reset() { position = 0 }
}
```

### Spec → BThread Conversion

```kotlin
// src/main/kotlin/com/plaited/behavioral/Spec.kt

@Serializable
data class Spec(
    val label: String,
    val thread: ThreadSpec
)

@Serializable
data class ThreadSpec(
    val once: Boolean? = null,
    val syncPoints: List<SpecIdioms>
)

@Serializable
data class SpecIdioms(
    val request: SpecEvent? = null,
    @SerialName("waitFor") val waitFor: List<SpecListener>? = null,
    val block: List<SpecListener>? = null,
    val interrupt: List<SpecListener>? = null
)

@Serializable
data class SpecEvent(
    val type: String,
    val detail: JsonElement? = null
)

@Serializable
data class SpecListener(
    val type: String,
    val detailSchema: JsonObject? = null,
    val detailMatch: String? = null,
    val topic: String? = null
)

fun Spec.toBThread(): BThread {
    val idioms = thread.syncPoints.map { specIdioms ->
        Idioms(
            request = specIdioms.request?.toBPEvent(),
            waitFor = specIdioms.waitFor?.map(SpecListener::toBPListener),
            block = specIdioms.block?.map(SpecListener::toBPListener),
            interrupt = specIdioms.interrupt?.map(SpecListener::toBPListener)
        )
    }
    return BThread(label, idioms, thread.once ?: false)
}

fun SpecEvent.toBPEvent() = BPEvent(type, detail)
fun SpecListener.toBPListener() = BPListener(
    type = type,
    validator = detailSchema?.let { JSONSchemaValidator(it) },
    detailMatch = detailMatch,
    topic = topic
)
```

### JSON Schema Validation

Kotlin uses `com.networknt:json-schema-validator` or `everit-json-schema`
instead of Zod:

```kotlin
// src/main/kotlin/com/plaited/spec/JSONSchemaValidator.kt

class JSONSchemaValidator(private val schema: JsonObject) {
    private val jsonSchema: JsonSchema = JsonSchemaFactory.getInstance().getSchema(schema)

    fun validate(instance: JsonElement): Boolean {
        return try {
            val report = jsonSchema.validate(instance)
            !report.isError
        } catch (e: Exception) {
            false
        }
    }
}

data class BPListener(
    val type: String,
    val validator: JSONSchemaValidator? = null,
    val detailMatch: String? = null,
    val topic: String? = null
) {
    fun matches(candidate: CandidateBid): Boolean {
        if (type != candidate.type) return false
        if (topic != null && candidate.topic != null && topic != candidate.topic) return false
        if (validator != null && candidate.detail != null) {
            val isValid = validator.validate(candidate.detail)
            return when (detailMatch) {
                "invalid" -> !isValid
                else -> isValid
            }
        }
        return true
    }
}
```

### Bid Types

```kotlin
data class RunningBid(
    val thread: BThread,
    val priority: Int,
    val label: String,
    val ingress: Boolean = false,
    val topic: String? = null
)

data class PendingBid(
    val thread: BThread,
    val priority: Int,
    val label: String,
    val ingress: Boolean = false,
    val topic: String? = null,
    val request: BPEvent? = null,
    val waitFor: List<BPListener>? = null,
    val block: List<BPListener>? = null,
    val interrupt: List<BPListener>? = null
)

data class CandidateBid(
    val type: String,
    val priority: Int,
    val detail: JsonElement? = null,
    val ingress: Boolean = false,
    val topic: String? = null
)

enum class FrontierStatus { READY, DEADLOCK, IDLE }

data class Frontier(
    val candidates: List<CandidateBid>,
    val enabled: List<CandidateBid>,
    val status: FrontierStatus
)
```

---

## 2. Behavioral Engine

### Algorithm

Identical super-step — all runtimes share the same algorithm.

### Engine Core

```kotlin
// src/main/kotlin/com/plaited/behavioral/BehavioralProgram.kt

class BehavioralProgram {
    private val pending = mutableSetOf<PendingBid>()
    private val running = mutableSetOf<RunningBid>()
    private val threads = mutableListOf<BThread>()
    private var stepId = 0

    private val _actionFlow = MutableSharedFlow<BPEvent>(extraBufferCapacity = 64)
    private val _snapshotFlow = MutableSharedFlow<SnapshotMessage>(extraBufferCapacity = 64)

    val onAction: SharedFlow<BPEvent> = _actionFlow.asSharedFlow()
    val onSnapshot: SharedFlow<SnapshotMessage> = _snapshotFlow.asSharedFlow()

    fun addSpec(spec: Spec) {
        val thread = spec.toBThread()
        threads.add(thread)
        running.add(RunningBid(
            thread = thread,
            priority = running.size + 1,
            label = thread.label
        ))
        step()
    }

    fun trigger(event: BPEvent) {
        val temp = BThread(
            label = event.type,
            syncPoints = listOf(Idioms(request = event)),
            once = true
        )
        threads.add(temp)
        running.add(RunningBid(
            thread = temp,
            priority = 0,
            label = event.type,
            ingress = true,
            topic = event.topic
        ))
        step()
    }

    private fun step() {
        if (running.isNotEmpty()) {
            advanceRunningToPending()
            selectNextEvent()
        }
    }

    private fun advanceRunningToPending() {
        val iter = running.iterator()
        for (bid in iter) {
            val idioms = bid.thread.advance()
            if (idioms != null) {
                pending.add(PendingBid(
                    thread = bid.thread,
                    priority = bid.priority,
                    label = bid.label,
                    ingress = bid.ingress,
                    topic = bid.topic,
                    request = idioms.request,
                    waitFor = idioms.waitFor,
                    block = idioms.block,
                    interrupt = idioms.interrupt
                ))
            }
            iter.remove()
        }
    }

    private fun selectNextEvent() {
        val step = stepId++
        publishPendingBidsSnapshot(step)
        val frontier = computeFrontier()

        when (frontier.status) {
            FrontierStatus.READY -> {
                val selected = frontier.enabled.minBy { it.priority }
                publishSelectionSnapshot(step, selected)
                nextStep(selected)
            }
            FrontierStatus.DEADLOCK -> {
                publishDeadlockSnapshot(step)
            }
            FrontierStatus.IDLE -> { /* wait for trigger */ }
        }
    }

    private fun nextStep(selected: CandidateBid) {
        resumePendingThreads(selected)
        _actionFlow.tryEmit(BPEvent(selected.type, selected.detail))
        step()
    }
}
```

### Coroutine Integration

Kotlin flows naturally for event streams. Handlers are collected as flows:

```kotlin
// Collecting engine events
program.onAction
    .filter { it.type == "deploy_complete" }
    .onEach { event -> /* handle result */ }
    .launchIn(scope)

program.onSnapshot
    .filter { it.kind == "selection" }
    .onEach { snapshot -> store.appendSnapshot(snapshot) }
    .launchIn(scope)
```

---

## 3. Persistence & Storage

### Strategy: SQLite-first via BProgramStore

Same schema as TypeScript and Swift. Uses SQLDelight or Room.

### SQLDelight Schema

```sql
-- src/main/sqldelight/com/plaited/db/Agent.sq

CREATE TABLE threads (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  label TEXT NOT NULL UNIQUE,
  position INTEGER NOT NULL DEFAULT 0,
  once INTEGER NOT NULL DEFAULT 0,
  sync_points TEXT NOT NULL,  -- JSON array of SpecIdioms
  status TEXT NOT NULL DEFAULT 'active',
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE snapshots (
  step INTEGER NOT NULL,
  kind TEXT NOT NULL,
  payload TEXT NOT NULL,       -- JSON
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (step, kind)
);

CREATE TABLE handlers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  once INTEGER NOT NULL DEFAULT 0,
  label TEXT
);

-- Queries
saveThread:
INSERT OR REPLACE INTO threads (label, position, once, sync_points, status, updated_at)
VALUES (?, ?, ?, ?, 'active', datetime('now'));

loadThreads:
SELECT * FROM threads WHERE status = 'active';

loadSnapshots:
SELECT * FROM snapshots WHERE kind = ? OR ? IS NULL ORDER BY step ASC LIMIT ?;
```

### BProgramStore Interface

```kotlin
// src/main/kotlin/com/plaited/storage/BProgramStore.kt

interface BProgramStore {
    suspend fun saveThread(thread: BThread)
    suspend fun loadThreads(): List<BThread>
    suspend fun appendSnapshot(snapshot: SnapshotMessage)
    suspend fun loadSnapshots(kind: String? = null, fromStep: Int? = null, limit: Int? = null): List<SnapshotMessage>
    suspend fun initialize()
    suspend fun close()
}
```

### SQLDelight Implementation

```kotlin
// src/main/kotlin/com/plaited/storage/SQLDelightStore.kt

class SQLDelightStore(driver: SqlDriver) : BProgramStore {
    private val queries = Database(driver).agentQueries

    override suspend fun saveThread(thread: BThread) {
        val json = Json.encodeToString(thread.syncPoints)
        queries.saveThread(
            label = thread.label,
            position = thread.position.toLong(),
            once = if (thread.once) 1L else 0L,
            sync_points = json
        )
    }

    override suspend fun loadThreads(): List<BThread> {
        return queries.loadThreads().executeAsList().map { row ->
            val syncPoints = Json.decodeFromString<List<Idioms>>(row.sync_points)
            BThread(
                label = row.label,
                syncPoints = syncPoints,
                once = row.once != 0L,
                position = row.position.toInt()
            )
        }
    }

    override suspend fun appendSnapshot(snapshot: SnapshotMessage) {
        queries.db.run {
            execute(
                "INSERT INTO snapshots (step, kind, payload, created_at) VALUES (?, ?, ?, datetime('now'))",
                snapshot.step.toLong(), snapshot.kind, Json.encodeToString(snapshot)
            )
        }
    }
}
```

---

## 4. Spec Contract

The Spec JSON is identical across all runtimes. Kotlin reads and writes
the same JSON as TypeScript and Swift.

```kotlin
// Spec JSON example — shared contract
// {
//   "label": "job-worker",
//   "thread": {
//     "once": true,
//     "syncPoints": [
//       { "request": { "type": "start", "detail": { "jobId": "a1" } } },
//       {
//         "waitFor": [{
//           "type": "task",
//           "detailSchema": {
//             "type": "object",
//             "properties": { "id": { "type": "string" } },
//             "required": ["id"],
//             "additionalProperties": false
//           }
//         }],
//         "block": [{ "type": "cancel" }]
//       }
//     ]
//   }
// }

// Read from SQLite → construct BThread → add to engine
val spec = Json.decodeFromString<Spec>(syncPointsJson)
val thread = spec.toBThread()
program.addSpec(spec)
```

---

## 5. App Functions Integration

This is where Kotlin differentiates from the other runtimes. The agent's
capabilities are exposed to Gemini and the Android AI subsystem via
[AppFunctions](https://developer.android.com/ai/appfunctions).

### Architecture

```
┌──────────────────────────────────────────────────┐
│  Android Agent (Kotlin)                            │
│                                                     │
│  ┌──────────────────┐    ┌─────────────────────┐  │
│  │ BehavioralProg    │    │ AppFunctions         │  │
│  │                   │    │                      │  │
│  │ - Spec threads   │    │ - Discoverable       │  │
│  │ - Engine loop    │    │   functions           │  │
│  │ - SQLite store   │    │ - Gemini integration  │  │
│  └────────┬─────────┘    │ - App actions        │  │
│           │              └──────────┬───────────┘  │
│           │                         │               │
│           └───── trigger(function) ─┘               │
│                                                     │
│  App Function → BPEvent → engine → result → Gemini  │
└──────────────────────────────────────────────────┘
```

### Function Declaration

Each Spec can be exposed as an AppFunction. The Spec's label and sync point
descriptions drive the function schema:

```kotlin
// src/main/kotlin/com/plaited/appfunctions/AgentAppFunction.kt

import android.app.appfunctions.AppFunction
import android.app.appfunctions.AppFunctionCallback
import android.app.appfunctions.AppFunctionManager

class ExecuteAgentAppFunction : AppFunction {
    override val name: String = "execute_agent_action"
    override val description: String = "Execute an Plaited agent capability"

    override val inputSchema: JsonObject = buildJsonObject {
        put("type", "object")
        put("properties", buildJsonObject {
            put("action", buildJsonObject {
                put("type", "string")
            })
            put("input", buildJsonObject {
                put("type", "object")
                put("additionalProperties", true)
            })
        })
        put("required", buildJsonArray { add("action") })
    }

    override suspend fun execute(request: AppFunction.ExecuteRequest): AppFunction.ExecuteResponse {
        val action = request.input["action"]?.jsonPrimitive?.content ?: return error("Missing action")
        val input = request.input["input"]?.jsonObject

        val event = BPEvent(type = action, detail = input)
        BehavioralProgram.instance.trigger(event)

        return AppFunction.ExecuteResponse.Builder()
            .setResult(buildJsonObject { put("status", "ok") })
            .build()
    }
}
```

### Dynamic Function Registration

Functions can be registered dynamically from stored specs:

```kotlin
// src/main/kotlin/com/plaited/appfunctions/FunctionRegistry.kt

class FunctionRegistry(private val context: Context) {
    private val appFunctionManager = context.getSystemService(AppFunctionManager::class.java)

    suspend fun registerFromSpec(spec: Spec) {
        val function = DynamicAppFunction(
            name = "agent_${spec.label}",
            description = "Execute agent capability: ${spec.label}",
            handler = { input ->
                val event = BPEvent(
                    type = spec.thread.syncPoints.firstOrNull()?.request?.type ?: spec.label,
                    detail = input
                )
                BehavioralProgram.instance.trigger(event)
                AppFunction.ExecuteResponse.Builder().setResult(JsonNull).build()
            }
        )
        appFunctionManager.register(function)
    }
}
```

### Gemini Integration

With AppFunctions registered, Gemini discovers and invokes them:

```kotlin
// Gemini discovers the AppFunction and calls it via the Android AI layer.
// User: "Hey Google, ask my agent to check the build status"
// Gemini → AppFunction → BPEvent → engine → result → user
```

---

## 6. Frontier Analysis

### Approach

Frontier analysis on Android reads Spec from the SQLite store, reconstructs
BThreads, and replays snapshots. Same approach as Swift — purely data-driven.

```kotlin
// src/main/kotlin/com/plaited/frontier/FrontierAnalysis.kt

fun replayToFrontier(
    specs: List<Spec>,
    priorSnapshots: List<SnapshotMessage>
): FrontierResult {
    val threads = specs.map { it.toBThread() }
    val pending = mutableSetOf<PendingBid>()
    val running = threads.mapIndexed { i, t ->
        RunningBid(t, i + 1, t.label)
    }.toMutableSet()

    // First advance
    advanceRunningToPending(running, pending)

    // Replay selections
    for (snapshot in priorSnapshots) {
        if (snapshot.kind != "selection") continue
        val selected = snapshot.selected
        // match and resume threads
        resumePendingThreads(selected, running, pending)
        advanceRunningToPending(running, pending)
    }

    return FrontierResult(computeFrontier(pending))
}
```

### Coroutine-Based Explorer (BFS/DFS)

```kotlin
suspend fun exploreFrontiers(
    specs: List<Spec>,
    priorSnapshots: List<SnapshotMessage> = emptyList(),
    strategy: String = "bfs",
    maxDepth: Int? = null
): ExploreResult = withContext(Dispatchers.Default) {
    val queue = ArrayDeque<List<SnapshotMessage>>()
    queue.add(priorSnapshots)
    val visited = mutableSetOf<String>()
    val findings = mutableListOf<DeadlockFinding>()

    while (queue.isNotEmpty()) {
        val current = if (strategy == "bfs") queue.removeFirst() else queue.removeLast()
        val key = Json.encodeToString(current)

        if (!visited.add(key)) continue
        val result = replayToFrontier(specs, current)

        if (result.frontier.status == FrontierStatus.DEADLOCK) {
            findings.add(DeadlockFinding(/* ... */))
        }

        val successors = getSuccessors(result, maxDepth)
        queue.addAll(successors)
    }

    ExploreResult(findings = findings)
}
```

---

## 7. Summary

| Component | Kotlin implementation | Why |
|---|---|---|
| Thread model | `BThread` class with `advance()` | Serializable, AOT-compatible, matches Swift |
| Engine | Synchronous super-step loop | Matches BP literature, Flow for event streams |
| Persistence | SQLDelight + `BProgramStore` interface | Same schema as TS/Swift, CRDT sync |
| Spec contract | `kotlinx.serialization`, `json-schema-validator` | Shared JSON with all runtimes |
| OS AI bridge | App Functions + `AppFunctionManager` | Gemini/Android AI integration |
| Frontier analysis | Reconstructs BThreads from stored Specs | No code execution, coroutine-based explorer |
| Concurrency | Flows + coroutines | Natural Kotlin patterns |

### Cross-Runtime Alignment

```
Storage:        Spec JSON ↔ SQLite on all runtimes
Serialization:  Spec JSON (identical schema)
Sync:           CRDT on same SQLite schema
Engine:         Identical super-step algorithm
Thread model:   TS uses generators (perf), Swift/Kotlin use BThread.advance() (AOT)
Frontier:       All runtimes reconstruct from stored Spec JSON
```