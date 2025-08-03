# Performance Improvement Suggestions for Plaited Framework

## Executive Summary

This document outlines performance optimization opportunities identified in the Plaited framework's core modules (`src/main` and `src/behavioral`). The suggestions focus on micro-optimizations that preserve Plaited's architectural benefits while improving runtime performance.

## Key Principles

- Preserve Shadow DOM isolation benefits
- Maintain behavioral programming paradigm
- Avoid unnecessary memoization that increases memory usage
- Focus on algorithmic improvements and reducing allocations

## 1. Array Operation Optimizations

### Current Issues
- Dynamic array allocation in hot paths
- Unnecessary array methods creating intermediate arrays
- Missing pre-allocation opportunities

### Suggested Improvements

#### Pre-allocate Arrays with Known Length

**File**: `src/behavioral/behavioral.ts:1220-1227`
```typescript
// Current
const filteredBids: CandidateBid[] = []
const length = candidates.length
for (let i = 0; i < length; i++) {
  const candidate = candidates[i]
  if (!blocked.some(isListeningFor(candidate))) {
    filteredBids.push(candidate)
  }
}

// Optimized
const filteredBids: CandidateBid[] = new Array(candidates.length)
let writeIndex = 0
const length = candidates.length
for (let i = 0; i < length; i++) {
  const candidate = candidates[i]
  if (!blocked.some(isListeningFor(candidate))) {
    filteredBids[writeIndex++] = candidate
  }
}
filteredBids.length = writeIndex // Trim to actual size
```

**File**: `src/main/assign-helpers.ts:179-194`
```typescript
// Current
const toRet: (string | DocumentFragment)[] = []

// Optimized
const toRet: (string | DocumentFragment)[] = new Array(fragments.length)
```

**Expected Impact**: Medium - Reduces array reallocation overhead in hot paths

**Implementation Difficulty**: Easy

## 2. Signal System Improvements

### Microtask-Based Signal Batching

**File**: `src/behavioral/use-signal.ts`

Implement batching to prevent cascading synchronous updates:

```typescript
// Add to module scope
let updateQueue: Set<() => void> | null = null
let isFlushPending = false

const flushUpdates = () => {
  if (!updateQueue) return

  const queue = updateQueue
  updateQueue = null
  isFlushPending = false

  for (const update of queue) {
    update()
  }
}

const scheduleUpdate = (update: () => void) => {
  if (!updateQueue) {
    updateQueue = new Set()
  }

  updateQueue.add(update)

  if (!isFlushPending) {
    isFlushPending = true
    queueMicrotask(flushUpdates)
  }
}

// Modified set function
const set = (value: T) => {
  store = value

  // If we're already flushing, schedule for next microtask
  if (updateQueue && isFlushPending) {
    for (const cb of listeners) {
      scheduleUpdate(() => cb(value))
    }
  } else {
    // Direct notification for first update in batch
    for (const cb of listeners) cb(value)
  }
}
```

**Benefits**:
- Prevents cascading renders when multiple signals update
- Avoids stack overflow from recursive updates
- Maintains synchronous feel while batching under the hood

**Expected Impact**: High - Significant improvement for components with multiple signal dependencies

**Implementation Difficulty**: Medium

## 3. Function Allocation Reductions

### Cache Frequently Used Functions

**File**: `src/behavioral/behavioral.ts:1006-1014`

```typescript
// Current - creates new function on each call
const

= ({ type, detail }: CandidateBid) => {
  return (listener: BPListener): boolean =>
    isTypeOf<string>(listener, 'string') ?
      listener === type
    : listener({ detail, type })
}

// Optimized - cache by type for string listeners
const listenerCache = new Map<string, (listener: BPListener) => boolean>()

const isListeningFor = ({ type, detail }: CandidateBid) => {
  // For string listeners, cache the check function
  let cachedFn = listenerCache.get(type)
  if (!cachedFn) {
    cachedFn = (listener: BPListener): boolean => {
      if (isTypeOf<string>(listener, 'string')) {
        return listener === type
      }
      return listener({ detail, type })
    }
    listenerCache.set(type, cachedFn)
  }
  return cachedFn
}
```

**Expected Impact**: Low-Medium - Reduces function allocations in event selection

**Implementation Difficulty**: Easy

## 4. String Operation Optimizations

### Optimize Selector Construction

**File**: `src/main/b-element.ts:505`

```typescript
// Current
`[${P_TARGET}${match}"${target}"]`

// Consider caching common selectors
const selectorCache = new Map<string, string>()
const getSelector = (target: string, match = '=') => {
  const key = `${target}:${match}`
  let selector = selectorCache.get(key)
  if (!selector) {
    selector = `[${P_TARGET}${match}"${target}"]`
    selectorCache.set(key, selector)
  }
  return selector
}
```

### String Concatenation for Small Operations

**File**: `src/main/css.ts`

For small string operations, prefer concatenation over array join:

```typescript
// Current
.map<string>(([prop, val]) => `${prop}:${val};`)
.join(' ')

// For small sets (< 10 items), concatenation can be faster
let result = ''
for (const [prop, val] of Object.entries(style)) {
  result += `${prop}:${val}; `
}
```

**Expected Impact**: Low - Minor improvement in style processing

**Implementation Difficulty**: Easy

## 5. Map/Set Access Pattern Improvements

### Avoid Double Lookups

**File**: Throughout codebase

```typescript
// Current pattern
if (map.has(key)) {
  const value = map.get(key)
  // use value
}

// Optimized pattern
const value = map.get(key)
if (value !== undefined) {
  // use value
}
```

**Expected Impact**: Low - Reduces redundant map lookups

**Implementation Difficulty**: Easy

## 6. Algorithm Micro-Optimizations

### Short-Circuit Priority 0 Events

**File**: `src/behavioral/behavioral.ts:1229-1231`

```typescript
// Current
const selectedEvent = filteredBids.sort(
  ({ priority: priorityA }, { priority: priorityB }) => priorityA - priorityB
)[0]

// Optimized - short-circuit for priority 0
let selectedEvent: CandidateBid | undefined
for (const bid of filteredBids) {
  if (bid.priority === 0) {
    selectedEvent = bid
    break
  }
}
if (!selectedEvent && filteredBids.length) {
  selectedEvent = filteredBids.sort(
    ({ priority: priorityA }, { priority: priorityB }) => priorityA - priorityB
  )[0]
}
```

**Expected Impact**: Medium - Avoids sorting when high-priority events exist

**Implementation Difficulty**: Easy

### Early Returns in Hot Paths

Add early returns to avoid unnecessary work:

```typescript
// In selectNextEvent
if (pending.size === 0) return // No threads to process

// In formatFragments
if (fragments.length === 0) return [] // Empty input
```

## Benchmarking Recommendations

1. **Signal Batching Performance**
   - Measure render count reduction with multiple signal updates
   - Test cascading update scenarios

2. **Event Selection Performance**
   - Profile with varying thread counts (10, 100, 1000)
   - Measure time spent in sorting vs. filtering

3. **Memory Allocation Tracking**
   - Use Chrome DevTools Allocation Timeline
   - Focus on array and function allocations

4. **Real-World Scenarios**
   - Test with typical component interaction patterns
   - Measure perceived performance in complex UIs

## Implementation Priority

1. **High Priority**
   - Signal batching system (high impact, prevents real issues)
   - Array pre-allocation in hot paths

2. **Medium Priority**
   - Priority 0 short-circuit optimization
   - Function allocation reductions

3. **Low Priority**
   - String optimizations
   - Map access patterns

## Conclusion

These optimizations maintain Plaited's architectural benefits while improving performance in measurable ways. The focus on reducing allocations and improving algorithms in hot paths should provide noticeable improvements without increasing memory usage or complexity.
