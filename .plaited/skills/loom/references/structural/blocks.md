# Blocks

> Emergent patterns from combining objects, channels, levers, and loops

## Definition

**Blocks are compositional patterns that emerge from combining structural elements.**

Each block type represents a different way objects connect through channels, shaped by levers, and animated through loops.

## Block Type Contract

```typescript
/** Block pattern types */
type BlockPattern = 'pool' | 'stream' | 'wall' | 'thread' | 'grid'

/** Block structural definition */
type Block = {
  pattern: BlockPattern
  objects: ObjectType[]
  channels: Channel[]
  loops: Loop[]
  levers: Lever[]
}
```

## Block Patterns

### Pool

Objects collected without strict order. Users can navigate freely.

**Characteristics:**
- Relational object grouping
- Selection or text channel
- Filtering/sorting levers

```typescript
// Pool: Comments with voting
// Objects: Comment[]
// Channel: text (comment body)
// Loop: click → upvote → rerender

bProgram({ $, trigger }) {
  // State object (not DOM)
  const comments: { id: string; votes: number; body: string }[] = []

  return {
    upvote({ commentId }: { commentId: string }) {
      // Update state object
      const comment = comments.find(c => c.id === commentId)
      if (comment) comment.votes++

      // Trigger rerender loop - this will update DOM
      trigger({ type: 'rerank' })
    },

    rerank() {
      // Sort state
      comments.sort((a, b) => b.votes - a.votes)

      // NOW update DOM via helpers
      $('comment-list')[0]?.render(
        <>{comments.map(c => <comment-item data-id={c.id}>{c.body}</comment-item>)}</>
      )
    }
  }
}
```

### Stream

Objects flow in temporal order. Users consume sequentially.

**Characteristics:**
- List object grouping (time-ordered)
- Text/audio/video channel
- Progressive reveal mechanic

```typescript
// Stream: Activity feed
// Objects: Activity[]
// Channel: text (activity description)
// Loop: new activity → prepend → scroll into view

bProgram({ $, trigger }) {
  return {
    onConnected() {
      websocket.onmessage = (msg) => {
        trigger({ type: 'newActivity', detail: JSON.parse(msg.data) })
      }
    },

    newActivity({ activity }: { activity: { id: string; text: string } }) {
      // Insert at top of stream - DOM update via helper
      $('feed')[0]?.insert('afterbegin',
        <activity-item data-id={activity.id}>{activity.text}</activity-item>
      )
    }
  }
}
```

### Wall

Objects displayed in spatial arrangement. Users scan and compare.

**Characteristics:**
- Relational object grouping
- Visual channel (thumbnails, cards)
- Instant feedback mechanic

```typescript
// Wall: Product grid
// Objects: Product[]
// Channel: visual (product cards)
// Loop: hover → preview → tooltip

bProgram({ $ }) {
  return {
    productHover({ productId }: { productId: string }) {
      // Show tooltip - DOM update via attr helper
      $(`preview-${productId}`)[0]?.attr('data-visible', 'true')
    },

    productLeave({ productId }: { productId: string }) {
      // Hide tooltip - DOM update via attr helper
      $(`preview-${productId}`)[0]?.attr('data-visible', 'false')
    }
  }
}
```

### Thread

Objects linked in sequence. Users progress through steps.

**Characteristics:**
- Steps object grouping
- Selection channel (step choices)
- Sequence game (enforce order via bThread)

```typescript
// Thread: Checkout wizard
// Objects: Step[]
// Channel: selection (step navigation)
// Loop: complete step → validate → next
// Game: cannot skip steps

bProgram({ $, trigger, bThreads, bThread, bSync }) {
  let currentStep = 0
  const totalSteps = 4
  const validated = new Set<number>()

  // Game lever: enforce sequential progression
  bThreads.set({
    enforceSequence: bThread([
      bSync({
        block: ({ type, detail }: { type: string; detail?: { step: number } }) =>
          type === 'goto' && detail && detail.step > currentStep + 1
      })
    ], true)
  })

  return {
    completeStep() {
      validated.add(currentStep)
      trigger({ type: 'goto', detail: { step: currentStep + 1 } })
    },

    goto({ step }: { step: number }) {
      currentStep = step
      // DOM update via attr helper
      $('wizard')[0]?.attr('data-step', String(step))
      // Show/hide step content
      $('step-content')[0]?.render(<StepContent step={step} />)
    }
  }
}
```

### Grid

Objects arranged in rows and columns. Structured data display.

**Characteristics:**
- List object grouping (tabular)
- Selection channel (row/cell selection)
- Sorting/filtering levers

```typescript
// Grid: Data table
// Objects: Row[]
// Channel: selection (row selection)
// Loop: click header → sort → rerender

bProgram({ $, trigger }) {
  // State objects
  let rows: { id: string; name: string; value: number }[] = []
  let sortColumn: 'name' | 'value' = 'name'
  let sortDir: 'asc' | 'desc' = 'asc'

  return {
    sortBy({ column }: { column: 'name' | 'value' }) {
      // Update sort state
      if (sortColumn === column) {
        sortDir = sortDir === 'asc' ? 'desc' : 'asc'
      } else {
        sortColumn = column
        sortDir = 'asc'
      }

      // Sort state array
      rows.sort((a, b) => {
        const cmp = a[column] > b[column] ? 1 : -1
        return sortDir === 'asc' ? cmp : -cmp
      })

      // Trigger DOM rerender
      trigger({ type: 'renderTable' })
    },

    renderTable() {
      // DOM update via render helper
      $('table-body')[0]?.render(
        <>{rows.map(row => (
          <tr data-id={row.id}>
            <td>{row.name}</td>
            <td>{row.value}</td>
          </tr>
        ))}</>
      )

      // Update sort indicator via attr helper
      $('sort-indicator')[0]?.attr('data-column', sortColumn)
      $('sort-indicator')[0]?.attr('data-direction', sortDir)
    }
  }
}
```

## Block Composition

Blocks can nest within blocks:

```
Page (Wall of sections)
└── Section (Pool of items)
    └── Item (Thread of details)
```

```typescript
// Nested composition in template
<page-layout>
  <section-pool>
    <item-thread />
    <item-thread />
  </section-pool>
  <section-pool>
    <item-thread />
  </section-pool>
</page-layout>
```

## Pattern Detection

When extracting structural metadata, identify block patterns:

```typescript
type StructuralMetadata = {
  block: {
    pattern: BlockPattern
    composition?: string  // How nested blocks relate
  }
  // ... other fields
}

// Detection heuristics:
// - Temporal ordering + prepend/append → stream
// - Voting/ranking + reorder → pool
// - Grid layout + sort headers → grid
// - Step navigation + validation → thread
// - Card/thumbnail layout + hover → wall
```

## Key Questions

When designing a pattern, ask:
1. How are objects spatially/temporally arranged? (pattern)
2. What blocks compose this block? (composition)
3. What game constraints shape navigation? (bThreads)

## Related

- [objects.md](objects.md) - What blocks contain
- [channels.md](channels.md) - How objects communicate
- [levers.md](levers.md) - How blocks shape energy
- [loops.md](loops.md) - How blocks respond to action
