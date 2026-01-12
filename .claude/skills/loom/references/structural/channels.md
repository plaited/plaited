# Channels

> Type contracts for information flow between objects

## Definition

**Channels define WHAT type of information flows, not HOW it's provided.**

Think of channels like TypeScript interfaces - any implementation that satisfies the type contract can fulfill the channel. Whether fulfilled by local code, an MCP tool, a skill script, or an external agent is an implementation detail.

## Channel Type Signatures

| Channel | Type Contract | Bandwidth | Cognitive Load |
|---------|--------------|-----------|----------------|
| Text | `string` | Low | Sequential reading |
| Binary | `boolean` | Low | Instant decision |
| Selection | `{ options, selected }` | Medium | Constrained choice |
| Audio | `MediaStream \| AudioBuffer \| ArrayBuffer` | High | Temporal stream |
| Video | `MediaStream \| ImageData \| ArrayBuffer` | High | Spatiotemporal stream |

## Type Contracts in TypeScript

```typescript
/** Text channel - sequential string data */
type TextChannel = string

/** Binary channel - boolean decision */
type BinaryChannel = boolean

/** Selection option with metadata */
type SelectionOption<T extends string = string> = {
  value: T
  label?: string
  disabled?: boolean
}

/** Selection channel - constrained choice from options */
type SelectionChannel<T extends string = string> = {
  options: SelectionOption<T>[]
  selected: T | T[] | null  // single, multi, or none
}

/** Audio channel - temporal audio stream */
type AudioChannel = MediaStream | AudioBuffer | ArrayBuffer

/** Video channel - spatiotemporal visual stream */
type VideoChannel = MediaStream | ImageData | ArrayBuffer

/** Channel type identifier for structural metadata */
type Channel = 'text' | 'binary' | 'selection' | 'audio' | 'video'
```

## Provider Agnostic

A channel can be fulfilled by ANY provider that satisfies its type:

```typescript
// Text channel - all satisfy: string
const fromInput: string = inputElement.value
const fromTool: string = await tools.getText({ source: 'clipboard' })
const fromScript: string = await runScript('extract-text.ts')
const fromCode: string = computeText(data)
```

```typescript
// Binary channel - all satisfy: boolean
const fromCheckbox: boolean = checkbox.checked
const fromTool: boolean = await tools.hasPermission({ scope: 'write' })
const fromCode: boolean = validateInput(value)
```

```typescript
// Selection channel - all satisfy: { options, selected }
const fromSelect: SelectionChannel<'a' | 'b' | 'c'> = {
  options: [
    { value: 'a', label: 'Option A' },
    { value: 'b', label: 'Option B' },
    { value: 'c', label: 'Option C', disabled: true }
  ],
  selected: 'a'
}

const fromTool: SelectionChannel = await tools.getChoices({ category: 'sizes' })
const fromCode: SelectionChannel = deriveOptions(state)
```

## Schema Representation

For tool discovery and registration, channels map to JSON Schema:

```typescript
// Text channel
const textSchema = { type: 'string' }

// Binary channel
const binarySchema = { type: 'boolean' }

// Selection channel
const selectionSchema = {
  type: 'object',
  properties: {
    options: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          value: { type: 'string' },
          label: { type: 'string' },
          disabled: { type: 'boolean' }
        },
        required: ['value']
      }
    },
    selected: {
      oneOf: [
        { type: 'string' },
        { type: 'array', items: { type: 'string' } },
        { type: 'null' }
      ]
    }
  },
  required: ['options', 'selected']
}

// Audio channel
const audioSchema = {
  type: 'string',
  format: 'binary',
  contentMediaType: 'audio/*'
}

// Video channel
const videoSchema = {
  type: 'string',
  format: 'binary',
  contentMediaType: 'video/*'
}
```

## Channel Selection

Choose channel based on the information contract needed:

| User Need | Channel | Type Contract |
|-----------|---------|---------------|
| Quick yes/no | Binary | `boolean` |
| Choose from options | Selection | `{ options, selected }` |
| Detailed input | Text | `string` |
| Audio stream | Audio | `MediaStream \| AudioBuffer` |
| Visual stream | Video | `MediaStream \| ImageData` |

## Channel Transitions

Users may need to switch channels. The transition is a type transformation:

```typescript
// Selection → Text (when "Other" is selected)
// Widens from constrained enum to full string
const handleOther = (selection: SelectionChannel): string | SelectionChannel => {
  if (selection.selected === 'other') {
    return ''  // Transition to text channel
  }
  return selection
}
```

```typescript
// In bElement: channel transition
bProgram({ $ }) {
  return {
    selectChange(e: Event) {
      const value = (e.target as HTMLSelectElement).value
      if (value === 'other') {
        // Transition: selection → text
        $('other-input')[0]?.attr('hidden', false)
      }
    }
  }
}
```

## In Plaited Training

When extracting structural metadata, identify channel by type signature:

```typescript
type StructuralMetadata = {
  channel: Channel  // 'text' | 'binary' | 'selection' | 'audio' | 'video'
  // ... other fields
}

// Detection heuristics:
// - <input type="checkbox">, <toggle-input> → binary
// - <select>, <input type="radio">, tabs → selection
// - <input type="text">, <textarea> → text
// - getUserMedia({ audio }), Web Audio API → audio
// - getUserMedia({ video }), <canvas>, <video> → video
```

## Key Questions

When designing a pattern, ask:
1. What type signature does this information need?
2. For selection: what are the options? single or multi-select?
3. What bandwidth is appropriate? (Low for decisions, high for streams)
4. Can any provider satisfy this type? (Keep it provider-agnostic)

## Related

- [objects.md](objects.md) - What flows through channels
- [levers.md](levers.md) - How channels affect user energy
- [loops.md](loops.md) - Channel actions and responses
