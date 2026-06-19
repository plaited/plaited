# Swift Behavioral Programming — Design Spec (Mobile Agent Runtime)

## Overview

This document defines the Swift behavioral engine architecture for the iOS agent.
It is a **semantic twin** of the TypeScript server runtime and the Kotlin Android
runtime — same algorithm, same data model, same Spec JSON contract, same SQLite
schema. All three share a common serialization format enabling agent mobility
and CRDT sync across devices.

Swift targets iOS and macOS. The engine integrates with **App Intents** to expose
agent capabilities to Siri and Apple Intelligence.

**Related documents:**
- `docs/typescript-behavioral-design.md` — TS server runtime
- `docs/kotlin-behavioral-design.md` — Android runtime
- `docs/dart-behavioral-design.md` — original Dart design (informational)

---

## Table of Contents

1. [Thread Representation](#1-thread-representation)
2. [Behavioral Engine](#2-behavioral-engine)
3. [Persistence & Storage](#3-persistence--storage)
4. [Spec Contract](#4-spec-contract)
5. [App Intents Integration](#5-app-intents-integration)
6. [Frontier Analysis](#6-frontier-analysis)
7. [Summary](#7-summary)

---

## 1. Thread Representation

### Decision

Use a **struct-based model** with a `BThread` class and `advance()` method.
Swift does not have generators (`sequence`/`AsyncSequence` are pull-based collections,
not resumable functions). A struct/class with an explicit position cursor is the
natural Swift approach.

### Rationale

| Concern | Generator-based (not possible in Swift) | Object-based (class + advance()) |
|---|---|---|
| AOT / native compilation | N/A — no Swift generators | ✅ Native Swift class |
| Serialize thread state | ❌ | ✅ `position` is an int |
| Restore mid-execution | ❌ Must replay all events | ✅ Set `position` and go |
| Spec JSON → runtime | ❌ | ✅ `Spec.fromJSON()` → `BThread` |
| Store in SQLite | ❌ | ✅ One row per thread |
| CRDT sync with TS | ❌ No shared representation | ✅ Identical Spec JSON |

### Class Design

```swift
// Sources/Plaited/Behavioral/BThread.swift

/// A single behavioral synchronization point.
struct Idioms: Codable {
    let request: BPEvent?
    let waitFor: [BPListener]?
    let block: [BPListener]?
    let interrupt: [BPListener]?
}

/// A behavioral thread: declarative sync points + position cursor.
final class BThread {
    let label: String
    let syncPoints: [Idioms]
    let once: Bool
    var position: Int

    init(label: String, syncPoints: [Idioms], once: Bool = false, position: Int = 0) {
        self.label = label
        self.syncPoints = syncPoints
        self.once = once
        self.position = position
    }

    /// Advance to the next sync point. Returns nil when the thread completes.
    /// Loops when `once` is false.
    func advance() -> Idioms? {
        guard !syncPoints.isEmpty else { return nil }
        if position >= syncPoints.count {
            guard !once else { return nil }
            position = 0
        }
        let idioms = syncPoints[position]
        position += 1
        return idioms
    }

    func reset() { position = 0 }
}
```

### Codable Conformance for Spec Exchange

BThread is not directly Codable — **Spec is the serialization boundary**.
Spec JSON is the shared contract between runtimes:

```swift
// Sources/Plaited/Spec/Spec.swift

struct Spec: Codable {
    let label: String
    let thread: ThreadSpec

    struct ThreadSpec: Codable {
        let once: Bool?
        let syncPoints: [SpecIdioms]
    }
}

struct SpecIdioms: Codable {
    let request: SpecEvent?
    let waitFor: [SpecListener]?
    let block: [SpecListener]?
    let interrupt: [SpecListener]?
}

struct SpecEvent: Codable {
    let type: String
    let detail: [String: AnyCodable]?    // JSON value
}

struct SpecListener: Codable {
    let type: String
    let detailSchema: [String: AnyCodable]?   // JSON Schema
    let detailMatch: String?                   // "valid" | "invalid"
    let topic: String?
}
```

Conversion from Spec to BThread:

```swift
extension BThread {
    convenience init(spec: Spec) {
        let idioms = spec.thread.syncPoints.map { syncPoint in
            Idioms(
                request: syncPoint.request.map { BPEvent(type: $0.type, detail: $0.detail) },
                waitFor: convertListeners(syncPoint.waitFor),
                block: convertListeners(syncPoint.block),
                interrupt: convertListeners(syncPoint.interrupt)
            )
        }
        self.init(label: spec.label, syncPoints: idioms, once: spec.thread.once ?? false)
    }
}

/// JSON Schema in SpecListener is converted to a runtime validator.
/// On iOS, this uses a lightweight JSON Schema validator rather than Zod.
private func convertListeners(_ listeners: [SpecListener]?) -> [BPListener]? {
    listeners?.map { spec in
        BPListener(
            type: spec.type,
            validator: spec.detailSchema.map { JSONSchemaValidator(schema: $0) },
            detailMatch: spec.detailMatch,
            topic: spec.topic
        )
    }
}
```

### Bid Types

```swift
/// A thread currently advancing through sync points.
struct RunningBid {
    let thread: BThread
    let priority: Int
    let label: String
    let ingress: Bool
    let topic: String?
}

/// A thread that has yielded and is waiting for event selection.
struct PendingBid {
    let thread: BThread
    let priority: Int
    let label: String
    let ingress: Bool
    let topic: String?
    // Idioms from current sync point:
    let request: BPEvent?
    let waitFor: [BPListener]?
    let block: [BPListener]?
    let interrupt: [BPListener]?
}

struct CandidateBid: Hashable {
    let type: String
    let priority: Int
    let detail: [String: AnyCodable]?
    let ingress: Bool
    let topic: String?
}

enum FrontierStatus: String {
    case ready, deadlock, idle
}

struct Frontier {
    let candidates: [CandidateBid]
    let enabled: [CandidateBid]
    let status: FrontierStatus
}
```

---

## 2. Behavioral Engine

### Algorithm

Identical super-step from the BP literature:

```
super-step:
  1. advanceRunningToPending()   // call advance() on every RunningBid
  2. computeFrontier()           // collect request/block candidates
  3. if status == ready:
       selected = selectEvent()  // priority sort, pick lowest
       publishSnapshot(selection)
       resumePendingThreads(selected)
       publishAction(selected)   // fire-and-forget to handlers
       goto 1
  4. if status == deadlock:
       publishSnapshot(deadlock)
       halt
  5. if status == idle:
       halt (await external trigger)
```

### Engine Core

```swift
// Sources/Plaited/Behavioral/BehavioralProgram.swift

@dynamicMemberLookup
final class BehavioralProgram: @unchecked Sendable {
    private var pending: Set<PendingBid> = []
    private var running: Set<RunningBid> = []
    private var threads: [BThread] = []
    private var stepId: Int = 0

    // Published streams for handlers and snapshots
    private let actionSubject = PassthroughSubject<BPEvent, Never>()
    private let snapshotSubject = PassthroughSubject<SnapshotMessage, Never>()

    /// Add a thread to the program (from Spec or direct).
    func addSpec(_ spec: Spec) {
        let thread = BThread(spec: spec)
        threads.append(thread)
        running.insert(RunningBid(
            thread: thread,
            priority: running.count + 1,
            label: thread.label,
            ingress: false,
            topic: nil
        ))
        step()
    }

    /// Inject an external event.
    func trigger(_ event: BPEvent) {
        let temp = BThread(
            label: event.type,
            syncPoints: [Idioms(request: event)],
            once: true
        )
        threads.append(temp)
        running.insert(RunningBid(
            thread: temp,
            priority: 0,
            label: event.type,
            ingress: true,
            topic: event.topic
        ))
        step()
    }

    /// Subscribe to selected events (handler interface).
    var onAction: AnyPublisher<BPEvent, Never> {
        actionSubject.eraseToAnyPublisher()
    }

    /// Subscribe to snapshots (persistence/debug interface).
    var onSnapshot: AnyPublisher<SnapshotMessage, Never> {
        snapshotSubject.eraseToAnyPublisher()
    }

    // MARK: - Internal

    private func step() {
        guard !running.isEmpty else { return }
        advanceRunningToPending()
        selectNextEvent()
    }

    private func advanceRunningToPending() {
        for bid in running {
            if let idioms = bid.thread.advance() {
                pending.insert(PendingBid(
                    thread: bid.thread,
                    priority: bid.priority,
                    label: bid.label,
                    ingress: bid.ingress,
                    topic: bid.topic,
                    request: idioms.request,
                    waitFor: idioms.waitFor,
                    block: idioms.block,
                    interrupt: idioms.interrupt
                ))
            }
            running.remove(bid)
        }
    }

    private func selectNextEvent() {
        let step = stepId
        stepId += 1

        publishPendingBidsSnapshot(step: step)
        let frontier = computeFrontier()

        switch frontier.status {
        case .ready:
            let selected = frontier.enabled
                .sorted { $0.priority < $1.priority }
                .first!
            publishSelectionSnapshot(step: step, selected: selected)
            nextStep(selected)
        case .deadlock:
            publishDeadlockSnapshot(step: step)
        case .idle:
            break
        }
    }

    private func nextStep(_ selected: CandidateBid) {
        resumePendingThreads(for: selected)
        actionSubject.send(BPEvent(type: selected.type, detail: selected.detail))
        step()
    }
}
```

### Thread Safety

Swift runs on `actor` boundaries. The behavioral engine is **single-threaded**
— all operations happen synchronously on one dispatch queue or `@MainActor`.
The `trigger()` method drives the next super-step immediately.

For concurrency with App Intents, wrap engine access in an actor:

```swift
actor BehavioralActor {
    private let program = BehavioralProgram()

    func addSpec(_ spec: Spec) { program.addSpec(spec) }
    func trigger(_ event: BPEvent) { program.trigger(event) }

    nonisolated var onAction: AnyPublisher<BPEvent, Never> {
        program.onAction
    }
}
```

---

## 3. Persistence & Storage

### Strategy: SQLite-first via BProgramStore

The same SQLite schema as TypeScript and Kotlin. Uses GRDB or swift-sqlite.

### Schema

```sql
-- Identical on all runtimes
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
```

### BProgramStore Protocol

```swift
// Sources/Plaited/Storage/BProgramStore.swift

protocol BProgramStore {
    func saveThread(_ thread: BThread) async throws
    func loadThreads() async throws -> [BThread]
    func appendSnapshot(_ snapshot: SnapshotMessage) async throws
    func loadSnapshots(kind: String?, fromStep: Int?, limit: Int?) async throws -> [SnapshotMessage]
    func initialize() async throws
    func close() async throws
}
```

### GRDB Implementation

```swift
// Sources/Plaited/Storage/GRDBStore.swift

import GRDB

final class GRDBStore: BProgramStore {
    private let dbQueue: DatabaseQueue

    init(path: String) throws {
        self.dbQueue = try DatabaseQueue(path: path)
    }

    func initialize() async throws {
        try dbQueue.write { db in
            try db.execute(sql: """
                CREATE TABLE IF NOT EXISTS threads (...)
            """)
            try db.execute(sql: """
                CREATE TABLE IF NOT EXISTS snapshots (...)
            """)
        }
    }

    func saveThread(_ thread: BThread) async throws {
        let json = try JSONEncoder().encode(thread.syncPoints)
        try dbQueue.write { db in
            try db.execute(sql: """
                INSERT OR REPLACE INTO threads (label, position, once, sync_points, status, updated_at)
                VALUES (?, ?, ?, ?, 'active', datetime('now'))
            """, arguments: [thread.label, thread.position, thread.once, String(data: json, encoding: .utf8)!])
        }
    }

    func loadThreads() async throws -> [BThread] {
        try dbQueue.read { db in
            let rows = try Row.fetchAll(db, sql: "SELECT * FROM threads WHERE status = 'active'")
            return try rows.map { row in
                let json = row["sync_points"] as! String
                let data = json.data(using: .utf8)!
                let syncPoints = try JSONDecoder().decode([Idioms].self, from: data)
                return BThread(
                    label: row["label"],
                    syncPoints: syncPoints,
                    once: row["once"] > 0,
                    position: row["position"]
                )
            }
        }
    }
}
```

---

## 4. Spec Contract

The Spec JSON is the shared serialization boundary across all runtimes.
Swift both consumes (from CRDT sync) and produces (for frontier analysis export).

```swift
// Spec JSON example — identical across TS, Swift, Kotlin
{
  "label": "job-worker",
  "thread": {
    "once": true,
    "syncPoints": [
      {
        "request": {
          "type": "start",
          "detail": { "jobId": "a1" }
        }
      },
      {
        "waitFor": [
          {
            "type": "task",
            "detailSchema": {
              "type": "object",
              "properties": { "id": { "type": "string" } },
              "required": ["id"],
              "additionalProperties": false
            }
          }
        ],
        "block": [{ "type": "cancel" }]
      }
    ]
  }
}
```

This is the **same JSON** that `SpecSchema` validates in TypeScript,
the same JSON stored in SQLite on all platforms, and the same JSON
that flows through CRDT sync.

### JSON Schema → Runtime Validator Bridge

Spec listeners carry `detailSchema` as a **JSON Schema object** (for storage).
At runtime, it's converted to a validator. Swift uses a lightweight
JSON Schema validation library rather than Zod:

```swift
// Sources/Plaited/Spec/JSONSchemaValidator.swift

struct BPListener {
    let type: String
    let validator: JSONSchemaValidator?   // from JSON Schema
    let detailMatch: String?
    let topic: String?

    func matches(candidate: CandidateBid) -> Bool {
        guard type == candidate.type else { return false }
        if let topic, let candidateTopic = candidate.topic, topic != candidateTopic {
            return false
        }
        if let validator, let detail = candidate.detail {
            let isValid = validator.validate(detail)
            switch detailMatch {
            case "invalid": return !isValid
            default: return isValid
            }
        }
        return true
    }
}
```

---

## 5. App Intents Integration

This is where Swift differentiates from the other runtimes. The agent's
capabilities (specs) are exposed to Siri and Apple Intelligence via App Intents.

### Architecture

```
┌──────────────────────────────────────────────────┐
│  iOS Agent (Swift)                                 │
│                                                     │
│  ┌──────────────────┐    ┌─────────────────────┐  │
│  │ BehavioralProg    │    │ App Intents         │  │
│  │                   │    │                     │  │
│  │ - Spec threads   │    │ - Discoverable      │  │
│  │ - Engine loop    │    │   capabilities      │  │
│  │ - SQLite store   │    │ - Siri integration  │  │
│  └────────┬─────────┘    │ - Shortcuts         │  │
│           │              └──────────┬──────────┘  │
│           │                         │              │
│           └───── trigger(AppIntent) ─┘              │
│                                                     │
│  App Intent → BPEvent → engine → result → Siri     │
└──────────────────────────────────────────────────┘
```

### Intent Definition

Each spec can be exposed as an App Intent. The Spec's label and sync point
descriptions drive the intent schema:

```swift
// Sources/Plaited/Intents/AgentIntent.swift

import AppIntents

/// Intent generated from a Spec's first sync point.
struct ExecuteAgentAction: AppIntent {
    static let title: LocalizedStringResource = "Run Agent Action"
    static let description = "Executes a capability from the Plaited agent"

    @Parameter(title: "Action")
    var action: String

    @Parameter(title: "Input")
    var input: [String: Any]?

    @MainActor
    func perform() async throws -> some IntentResult {
        let event = BPEvent(type: action, detail: input)
        let program = await BehavioralActor.shared
        program.trigger(event)
        return .result()
    }
}
```

### Dynamic Intent Discovery

Apple Intelligence supports dynamic intent discovery via `AppIntents` entities.
The agent's stored specs become discoverable actions:

```swift
// Sources/Plaited/Intents/SpecEntity.swift

struct SpecEntity: AppEntity {
    let id: String
    let label: String
    let description: String

    static var typeDisplayRepresentation: TypeDisplayRepresentation = "Agent Spec"

    var displayRepresentation: DisplayRepresentation {
        DisplayRepresentation(title: "\(label)")
    }
}

struct SpecEntityQuery: EntityQuery {
    @MainActor
    func entities(for ids: [SpecEntity.ID]) async throws -> [SpecEntity] {
        let store = GRDBStore.default
        let specs = try await store.loadSpecs()
        return specs.filter { ids.contains($0.label) }.map {
            SpecEntity(id: $0.label, label: $0.label, description: "")
        }
    }

    @MainActor
    func allEntities() async throws -> [SpecEntity] {
        let store = GRDBStore.default
        let specs = try await store.loadSpecs()
        return specs.map { SpecEntity(id: $0.label, label: $0.label, description: "") }
    }
}
```

### Integration with Apple Intelligence

```swift
/// Bridge: App Intent invocation → behavioral event
@MainActor
final class IntentBridge {
    private let program: BehavioralProgram
    private let store: BProgramStore

    init(program: BehavioralProgram, store: BProgramStore) {
        self.program = program
        self.store = store

        // Subscribe to engine results and update Siri
        program.onAction.sink { [weak self] event in
            // Persist result, notify Siri if needed
        }
    }

    func handleIntent(_ intent: ExecuteAgentAction) async throws -> some IntentResult {
        program.trigger(BPEvent(type: intent.action, detail: intent.input))
        return .result()
    }
}
```

---

## 6. Frontier Analysis

### Approach

Frontier analysis on iOS reads Spec from the SQLite store, reconstructs BThreads,
and replays snapshots. No code execution — purely data-driven.

```swift
// Sources/Plaited/Frontier/FrontierAnalysis.swift

func replayToFrontier(
    specs: [Spec],
    priorSnapshots: [SnapshotMessage]
) -> FrontierResult {
    let threads = specs.map { BThread(spec: $0) }
    var pending: [PendingBid] = []
    var running: [RunningBid] = threads.enumerated().map { (i, t) in
        RunningBid(thread: t, priority: i + 1, label: t.label, ingress: false, topic: nil)
    }

    // advance to first sync point
    for bid in running {
        if let idioms = bid.thread.advance() {
            pending.append(PendingBid(/* ... */))
        }
    }

    // replay each selected snapshot
    for snapshot in priorSnapshots where snapshot.kind == "selection" {
        // match and resume threads
        // advanceRunningToPending
    }

    // compute frontier
    return FrontierResult(frontier: computeFrontier(pending))
}
```

Deadlock detection is the primary use case on mobile — the agent checks
its stored threads for deadlocks without running any code.

---

## 7. Summary

| Component | Swift implementation | Why |
|---|---|---|
| Thread model | `BThread` class with `advance()` | No generators in Swift; native AOT |
| Engine | Synchronous super-step loop | Matches BP literature, no async overhead |
| Persistence | GRDB + `BProgramStore` protocol | Same schema as TS/Kotlin, CRDT sync |
| Spec contract | `Codable` structs, JSON Schema → runtime validator | Shared JSON with all runtimes |
| OS AI bridge | App Intents + `AppEntity` + `EntityQuery` | Siri/Apple Intelligence integration |
| Frontier analysis | Reconstructs BThreads from stored Specs | No code execution, pure data replay |
| Thread safety | Actor isolation (`BehavioralActor`) | Swift concurrency model |