import { bElement } from 'plaited'
import { story } from 'plaited/testing'

const Header = bElement({
  tag: 'plaited-header',
  shadowDom: (
    <div p-target='container'>
      <slot name='header-1'></slot>
      <slot name='header-2'></slot>
      <slot name='header-3'></slot>
    </div>
  ),
})

export const allSlotsPopulated = story({
  description: `This story validates that plaited-header correctly renders all three named slots
  (header-1, header-2, header-3) with slotted content.`,
  template: () => (
    <Header>
      <button
        type='button'
        slot='header-1'
      >
        Button 1
      </button>
      <button
        type='button'
        slot='header-2'
      >
        Button 2
      </button>
      <button
        type='button'
        slot='header-3'
      >
        Button 3
      </button>
    </Header>
  ),
  play: async ({ assert, findByText }) => {
    const button1 = await findByText('Button 1')
    assert({
      given: 'content in header-1 slot',
      should: 'be rendered',
      actual: button1 instanceof HTMLButtonElement,
      expected: true,
    })

    const button2 = await findByText('Button 2')
    assert({
      given: 'content in header-2 slot',
      should: 'be rendered',
      actual: button2 instanceof HTMLButtonElement,
      expected: true,
    })

    const button3 = await findByText('Button 3')
    assert({
      given: 'content in header-3 slot',
      should: 'be rendered',
      actual: button3 instanceof HTMLButtonElement,
      expected: true,
    })
  },
})

export const partialSlotsPopulated = story({
  description: `This story validates that plaited-header correctly handles scenarios where only
  some slots have content.`,
  template: () => (
    <Header>
      <span slot='header-1'>First Item</span>
      <span slot='header-3'>Third Item</span>
    </Header>
  ),
  play: async ({ assert, findByText }) => {
    const item1 = await findByText('First Item')
    assert({
      given: 'content in header-1 slot',
      should: 'be rendered',
      actual: item1 instanceof HTMLSpanElement,
      expected: true,
    })

    const item3 = await findByText('Third Item')
    assert({
      given: 'content in header-3 slot',
      should: 'be rendered',
      actual: item3 instanceof HTMLSpanElement,
      expected: true,
    })
  },
})

export const shadowDomStructure = story({
  description: `This story validates that plaited-header has the correct shadow DOM structure
  with container div and three named slots.`,
  template: () => <Header />,
  play: async ({ assert }) => {
    const header = document.querySelector(Header.tag)
    const shadowRoot = header?.shadowRoot

    assert({
      given: 'plaited-header shadow root',
      should: 'exist',
      actual: shadowRoot !== null,
      expected: true,
    })

    const container = shadowRoot?.querySelector('[p-target="container"]')
    assert({
      given: 'shadow DOM container div',
      should: 'exist',
      actual: container instanceof HTMLDivElement,
      expected: true,
    })

    const slots = shadowRoot?.querySelectorAll('slot')
    assert({
      given: 'shadow DOM slots',
      should: 'have exactly 3 slots',
      actual: slots?.length,
      expected: 3,
    })

    const slotNames = Array.from(slots ?? []).map((slot) => slot.getAttribute('name'))
    assert({
      given: 'slot names',
      should: 'be header-1, header-2, and header-3',
      actual: slotNames.sort().join(','),
      expected: 'header-1,header-2,header-3',
    })
  },
})
