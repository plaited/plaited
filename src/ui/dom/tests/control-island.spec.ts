import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { TEMPLATE_OBJECT_IDENTIFIER } from '../../render/template.constants.ts'
import { CONTROLLER_TEMPLATE_IDENTIFIER, controlIsland } from '../control-island.ts'

// ─── Setup ────────────────────────────────────────────────────────────────────
// happy-dom provides customElements.define() for registration tests.
// No WebSocket mock needed — tests below never append elements to the DOM,
// so connectedCallback (which calls controller()) never fires.

beforeAll(async () => {
  const { GlobalRegistrator } = await import('@happy-dom/global-registrator')
  await GlobalRegistrator.register()
})

afterAll(async () => {
  const { GlobalRegistrator } = await import('@happy-dom/global-registrator')
  await GlobalRegistrator.unregister()
})

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('controlIsland: module return value', () => {
  test('returns a ControllerTemplate with .tag property', () => {
    const Island = controlIsland({ tag: 'test-module-tag' })
    expect(Island.tag).toBe('test-module-tag')
  })

  test('returns ControllerTemplate with $ identifier', () => {
    const Island = controlIsland({ tag: 'test-module-id' })
    expect(Island.$).toBe(CONTROLLER_TEMPLATE_IDENTIFIER)
  })

  test('returns ControllerTemplate with observedAttributes', () => {
    const Island = controlIsland({
      tag: 'test-module-attrs',
      observedAttributes: ['value', 'label'],
    })
    expect(Island.observedAttributes).toEqual(['value', 'label'])
  })

  test('defaults observedAttributes to empty array', () => {
    const Island = controlIsland({ tag: 'test-module-default' })
    expect(Island.observedAttributes).toEqual([])
  })

  test('returned function produces a TemplateObject', () => {
    const Island = controlIsland({ tag: 'test-module-tpl' })
    const tpl = Island({ children: [] })
    expect(tpl.$).toBe(TEMPLATE_OBJECT_IDENTIFIER)
    expect(tpl.html).toBeArray()
    expect(tpl.stylesheets).toBeArray()
    expect(tpl.registry).toContain('test-module-tpl')
  })
})

describe('controlIsland: custom element registration', () => {
  test('registers custom element via customElements.define()', () => {
    controlIsland({ tag: 'test-registered' })
    expect(customElements.get('test-registered')).toBeDefined()
  })

  test('does not re-register existing tag', () => {
    controlIsland({ tag: 'test-no-double-reg' })
    expect(() => controlIsland({ tag: 'test-no-double-reg' })).not.toThrow()
  })
})

describe('controlIsland: template output', () => {
  test('template produces TemplateObject with correct structure', () => {
    const Island = controlIsland({ tag: 'test-tpl-output' })
    const tpl = Island({ children: [] })
    expect(tpl.$).toBe(TEMPLATE_OBJECT_IDENTIFIER)
    expect(tpl.html).toBeArray()
    expect(tpl.html.length).toBeGreaterThan(0)
  })

  test('template includes tag in registry', () => {
    const Island = controlIsland({ tag: 'test-tpl-registry' })
    const tpl = Island({ children: [] })
    expect(tpl.registry).toContain('test-tpl-registry')
  })
})
