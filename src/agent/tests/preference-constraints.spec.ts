import { describe, expect, test } from 'bun:test'
import { behavioral } from '../../main/behavioral.ts'
import { bSync, bThread } from '../../main/behavioral.utils.ts'
import type { UserPreferenceProfile } from '../agent.types.ts'
import {
  createPreferenceConstraint,
  createRequireCardLayout,
  createRequireListGrouping,
  createRequireWizardPattern,
  extractStructuralMetadata,
  inferPreferenceProfile,
  matchesPreferences,
} from '../preference-constraints.ts'

// ============================================================================
// Structural Metadata Extraction Tests
// ============================================================================

describe('extractStructuralMetadata', () => {
  test('extracts object definitions from bElement', () => {
    const code = `
      export const Button = bElement({
        tag: 'my-button',
        template: () => <button>Click</button>
      })
    `
    const result = extractStructuralMetadata(code)
    expect(result.objects.length).toBe(1)
    expect(result.objects[0]?.name).toBe('Button')
  })

  test('extracts object definitions from FT', () => {
    const code = `
      const Card: FT<Props> = ({ title }) => (
        <div>{title}</div>
      )
    `
    const result = extractStructuralMetadata(code)
    expect(result.objects.length).toBe(1)
    expect(result.objects[0]?.name).toBe('Card')
  })

  test('extracts multiple objects', () => {
    const code = `
      const Header = bElement({})
      const Footer = bElement({})
      const Card = FT({})
    `
    const result = extractStructuralMetadata(code)
    expect(result.objects.length).toBe(3)
  })

  test('detects list grouping pattern', () => {
    const code = `
      const List = () => (
        <ul>
          {items.map(item => <li key={item.id}>{item.name}</li>)}
        </ul>
      )
    `
    const result = extractStructuralMetadata(code)
    expect(result.objects.some((o) => o.grouping === 'list')).toBe(true)
  })

  test('detects steps grouping pattern', () => {
    const code = `
      const Wizard = () => (
        <div>
          <Step number={1} />
          <Step number={2} />
        </div>
      )
    `
    const result = extractStructuralMetadata(code)
    // "step" keyword triggers steps detection
    expect(result.objects.some((o) => o.grouping === 'steps') || result.block === 'wizard').toBe(true)
  })

  test('extracts p-trigger loops', () => {
    const code = `
      const Button = bElement({
        template: () => <button p-trigger="click">Click</button>,
        triggers: {
          click: ({ trigger }) => trigger({ type: 'clicked' })
        }
      })
    `
    const result = extractStructuralMetadata(code)
    expect(result.loops?.length).toBe(1)
    expect(result.loops?.[0]?.trigger).toBe('click')
    expect(result.loops?.[0]?.handler).toBe('click')
  })

  test('detects selection channel', () => {
    const code = `
      const Select = () => (
        <select>
          <option>A</option>
          <option>B</option>
        </select>
      )
    `
    const result = extractStructuralMetadata(code)
    expect(result.channel).toBe('selection')
  })

  test('detects input channel', () => {
    const code = `
      const Form = () => (
        <form>
          <input type="text" />
          <textarea />
        </form>
      )
    `
    const result = extractStructuralMetadata(code)
    expect(result.channel).toBe('input')
  })

  test('detects levers', () => {
    const code = `
      const Controls = () => (
        <div>
          <button>Submit</button>
          <a href="#">Link</a>
          <input type="text" />
        </div>
      )
    `
    const result = extractStructuralMetadata(code)
    expect(result.levers).toContain('button')
    expect(result.levers).toContain('link')
    expect(result.levers).toContain('input')
  })

  test('detects card block type', () => {
    const code = `
      const CardLayout = () => (
        <div class="cards">
          <Card title="A" />
          <Card title="B" />
        </div>
      )
    `
    const result = extractStructuralMetadata(code)
    expect(result.block).toBe('card')
  })

  test('detects dialog block type', () => {
    const code = `
      const Modal = () => (
        <dialog open>
          <p>Content</p>
        </dialog>
      )
    `
    const result = extractStructuralMetadata(code)
    expect(result.block).toBe('dialog')
  })

  test('detects wizard block type', () => {
    const code = `
      const Stepper = () => (
        <div class="wizard">
          <Step />
        </div>
      )
    `
    const result = extractStructuralMetadata(code)
    expect(result.block).toBe('wizard')
  })

  test('detects gallery block type', () => {
    const code = `
      const ImageGallery = () => (
        <div class="gallery">
          <img src="a.jpg" />
          <img src="b.jpg" />
        </div>
      )
    `
    const result = extractStructuralMetadata(code)
    expect(result.block).toBe('gallery')
  })

  test('detects feed block type', () => {
    const code = `
      const Timeline = () => (
        <div class="feed">
          <Post />
        </div>
      )
    `
    const result = extractStructuralMetadata(code)
    expect(result.block).toBe('feed')
  })
})

// ============================================================================
// Preference Constraint Tests
// ============================================================================

describe('createPreferenceConstraint', () => {
  /**
   * Create a test behavioral program with snapshot-based event tracking.
   */
  const createTestBP = () => {
    const selectedEvents: Array<{ type: string; detail?: unknown }> = []
    const blockedEvents: Array<{ type: string; blockedBy?: string }> = []
    const { trigger, bThreads, useSnapshot } = behavioral()

    // Use snapshot to track all event selections
    useSnapshot((snapshot) => {
      for (const bid of snapshot) {
        if (bid.selected) {
          selectedEvents.push({ type: bid.type, detail: bid.detail })
        } else if (bid.blockedBy) {
          blockedEvents.push({ type: bid.type, blockedBy: bid.blockedBy })
        }
      }
    })

    return { trigger, bThreads, selectedEvents, blockedEvents }
  }

  test('creates a valid bThread', () => {
    const profile: UserPreferenceProfile = { preferredBlocks: ['card'] }
    const constraint = createPreferenceConstraint(bSync, bThread, profile)
    expect(typeof constraint).toBe('function')
  })

  test('blocks non-preferred block types', () => {
    const { trigger, bThreads, selectedEvents, blockedEvents: _blockedEvents } = createTestBP()

    const profile: UserPreferenceProfile = { preferredBlocks: ['card'] }
    bThreads.set({
      enforcePreferences: createPreferenceConstraint(bSync, bThread, profile),
    })

    // Emit a wizard template (not card)
    trigger({
      type: 'toolResult',
      detail: {
        name: 'writeTemplate',
        result: {
          data: {
            content: `
              const Wizard = () => <div class="wizard"><Step /></div>
            `,
          },
        },
      },
    })

    // Should be blocked since wizard is not in preferredBlocks
    const toolResults = selectedEvents.filter((e) => e.type === 'toolResult')
    expect(toolResults.length).toBe(0)
  })

  test('allows preferred block types', () => {
    const { trigger, bThreads, selectedEvents } = createTestBP()

    const profile: UserPreferenceProfile = { preferredBlocks: ['card'] }
    bThreads.set({
      enforcePreferences: createPreferenceConstraint(bSync, bThread, profile),
    })

    // Emit a card template
    trigger({
      type: 'toolResult',
      detail: {
        name: 'writeTemplate',
        result: {
          data: {
            content: `
              const Cards = () => <div class="cards"><Card /></div>
            `,
          },
        },
      },
    })

    expect(selectedEvents.some((e) => e.type === 'toolResult')).toBe(true)
  })

  test('allows non-writeTemplate tool results', () => {
    const { trigger, bThreads, selectedEvents } = createTestBP()

    const profile: UserPreferenceProfile = { preferredBlocks: ['card'] }
    bThreads.set({
      enforcePreferences: createPreferenceConstraint(bSync, bThread, profile),
    })

    // Emit a different tool result
    trigger({
      type: 'toolResult',
      detail: {
        name: 'writeStyles',
        result: { data: { content: 'styles' } },
      },
    })

    expect(selectedEvents.some((e) => e.type === 'toolResult')).toBe(true)
  })
})

// ============================================================================
// Specific Preference Constraints Tests
// ============================================================================

describe('createRequireCardLayout', () => {
  test('creates a constraint requiring card block', () => {
    const constraint = createRequireCardLayout(bSync, bThread)
    expect(typeof constraint).toBe('function')
  })
})

describe('createRequireListGrouping', () => {
  test('creates a constraint requiring list grouping', () => {
    const constraint = createRequireListGrouping(bSync, bThread)
    expect(typeof constraint).toBe('function')
  })
})

describe('createRequireWizardPattern', () => {
  test('creates a constraint requiring wizard pattern', () => {
    const constraint = createRequireWizardPattern(bSync, bThread)
    expect(typeof constraint).toBe('function')
  })
})

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('matchesPreferences', () => {
  test('matches when block type is preferred', () => {
    const structural = extractStructuralMetadata('<div class="cards"><Card /></div>')
    const profile: UserPreferenceProfile = { preferredBlocks: ['card'] }

    expect(matchesPreferences(structural, profile)).toBe(true)
  })

  test('does not match when block type is not preferred', () => {
    const structural = extractStructuralMetadata('<div class="wizard"><Step /></div>')
    const profile: UserPreferenceProfile = { preferredBlocks: ['card'] }

    expect(matchesPreferences(structural, profile)).toBe(false)
  })

  test('matches when no block preference specified', () => {
    const structural = extractStructuralMetadata('<div>Content</div>')
    const profile: UserPreferenceProfile = {}

    expect(matchesPreferences(structural, profile)).toBe(true)
  })

  test('matches when no block detected in code', () => {
    const structural = extractStructuralMetadata('<div>Plain content</div>')
    const profile: UserPreferenceProfile = { preferredBlocks: ['card'] }

    // No block detected, so no violation
    expect(matchesPreferences(structural, profile)).toBe(true)
  })
})

describe('inferPreferenceProfile', () => {
  test('infers block preferences from examples', () => {
    const examples = [
      '<div class="cards"><Card /></div>',
      '<div class="card-layout"><Card /></div>',
      '<div class="cards"><Card /><Card /></div>',
    ]

    const profile = inferPreferenceProfile(examples)
    expect(profile.preferredBlocks).toContain('card')
  })

  test('infers grouping preferences from examples', () => {
    const examples = ['{items.map(i => <Item key={i.id} />)}', '{data.map(d => <Row data={d} />)}']

    const profile = inferPreferenceProfile(examples)
    expect(profile.preferredGroupings).toContain('list')
  })

  test('returns empty profile for empty examples', () => {
    const profile = inferPreferenceProfile([])

    expect(profile.preferredBlocks).toBeUndefined()
    expect(profile.preferredGroupings).toBeUndefined()
  })

  test('limits to top patterns', () => {
    const examples = [
      '<div class="cards"><Card /></div>',
      '<div class="cards"><Card /></div>',
      '<div class="cards"><Card /></div>',
      '<dialog><Content /></dialog>',
      '<div class="wizard"><Step /></div>',
      '<div class="gallery"><Image /></div>',
      '<div class="feed"><Post /></div>',
    ]

    const profile = inferPreferenceProfile(examples)

    // Should have at most 3 preferred blocks
    expect(profile.preferredBlocks?.length).toBeLessThanOrEqual(3)
  })
})
