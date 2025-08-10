import { bElement, type FT } from 'plaited'
import type { StoryObj } from 'plaited/testing'
import { css } from 'plaited'

const styles = css.create({
  button: {
    border: '1px solid black',
    padding: '4px 8px',
    cursor: 'pointer',
    backgroundColor: 'white',
    color: 'black',
    borderRadius: '4px',
    height: '18px',
    width: 'auto',
  },
  zone: {
    border: '1px black dashed',
    margin: '24px',
    padding: '12px',
    height: '300px',
    display: 'flex',
    flexDirection: 'column',
    gap: '25px',
    position: 'relative',
  },
  svg: {
    width: '125px',
    height: '125px',
  },
  'sub-island': {
    height: '100%',
    width: '100%',
    position: 'absolute',
    top: '0',
    left: '0',
    margin: '0',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: '#000000 0.75',
    color: '#ffffff 0.8',
  },
  row: {
    display: 'flex',
    gap: '10px',
    padding: '12px',
  },
  slot: {
    height: {
      '::slotted(button)': '18px',
    },
    width: {
      '::slotted(button)': 'auto',
    },
  },
})

const SubIsland = bElement({
  tag: 'sub-island',
  shadowDom: <h3>sub island</h3>,
})

const SVG: FT = (props) => (
  <svg
    width='125'
    height='125'
    version='1.1'
    viewBox='0 0 700 700'
    class={'svg'}
    p-trigger={{ click: 'removeSvg' }}
    p-target='svg'
    {...props}
  >
    <circle
      cx='50'
      cy='50'
      r='40'
      stroke='black'
      stroke-width='3'
      fill='red'
    />
  </svg>
)

const ShadowIsland = bElement({
  tag: 'shadow-island',
  shadowDom: (
    <div p-target='wrapper'>
      <div
        {...styles.zone}
        p-target='zone'
      ></div>
      <div
        {...styles.row}
        p-target='button-row'
      >
        <button
          p-trigger={{ click: 'start' }}
          {...styles.button}
        >
          start
        </button>
        <button
          p-trigger={{ click: 'addButton' }}
          {...styles.button}
        >
          addButton
        </button>
      </div>
    </div>
  ),
  bProgram({ bThreads, $, bThread, bSync, root }) {
    bThreads.set({
      onRemoveSvg: bThread([bSync({ waitFor: 'removeSvg' }), bSync({ request: { type: 'addSubIsland' } })]),
      onStart: bThread([bSync({ waitFor: 'start' }), bSync({ request: { type: 'addSlot' } })]),
      onAddSvg: bThread([bSync({ waitFor: 'add-svg' }), bSync({ request: { type: 'modifyAttributes' } })], true),
    })
    return {
      addSubIsland() {
        const [zone] = $('zone')
        /** render dynamic island to zone */
        zone?.insert('beforeend', <SubIsland {...styles['sub-island']} />)
      },
      addButton() {
        root.host.insertAdjacentHTML('beforeend', `<button slot='button'>add svg</button>`)
      },
      modifyAttributes() {
        const [slot] = $('add-svg-slot')
        slot?.attr('p-trigger', null)
      },
      addSlot() {
        const [row] = $('button-row')
        row?.insert(
          'beforeend',
          <slot
            name='button'
            p-target='add-svg-slot'
            p-trigger={{ click: 'add-svg' }}
            {...styles.slot}
          ></slot>,
        )
      },
      removeSvg() {
        const [svg] = $('svg')
        svg?.remove()
      },
      ['add-svg']() {
        const [zone] = $('zone')
        zone?.insert('beforeend', <SVG {...styles.svg} />)
      },
    }
  },
})

export const shadowObserver: StoryObj = {
  description: `This story is used to validate that the shadow dom mutation observer
  of Behavioral elements created by bElement function properly binds events declared with the
  p-trigger attribute on elements in it's shadow dom.`,
  template: ShadowIsland,
  play: async ({ assert, findByAttribute, findByText, fireEvent }) => {
    let button = await findByAttribute('p-trigger', 'click:start')
    button && (await fireEvent(button, 'click'))
    let row = await findByAttribute('p-target', 'button-row')
    assert({
      given: 'clicking start',
      should: 'have add button in row',
      actual: row?.childElementCount,
      expected: 3,
    })

    button && (await fireEvent(button, 'click'))
    row = await findByAttribute('p-target', 'button-row')
    assert({
      given: 'clicking start again',
      should: 'not add another button to row',
      actual: row?.children.length,
      expected: 3,
    })

    button = await findByAttribute('p-trigger', 'click:addButton')
    button && (await fireEvent(button, 'click'))
    button = await findByText<HTMLButtonElement>('add svg')

    assert({
      given: 'request to append `add svg` button',
      should: 'new button should be in dom',
      actual: button?.innerText,
      expected: 'add svg',
    })

    button && (await fireEvent(button, 'click'))
    let zone = await findByAttribute('p-target', 'zone')
    assert({
      given: 'clicking add svg',
      should: 'adds a svg to zone',
      actual: zone?.children.length,
      expected: 1,
    })
    const svg = await findByAttribute('p-target', 'svg')
    assert({
      given: 'add-svg event',
      should: 'zone child is an svg',
      actual: svg?.tagName,
      expected: 'svg',
    })

    button = await findByText('add svg')
    button && (await fireEvent(button, 'click'))
    zone = await findByAttribute('p-target', 'zone')
    assert({
      given: 'clicking add svg again',
      should: 'not add another svg to zone',
      actual: zone?.children.length,
      expected: 1,
    })

    svg && (await fireEvent(svg, 'click'))
    button && (await fireEvent(button, 'click'))
    const h3 = await findByText('sub island')
    assert({
      given: 'removeSvg event triggered',
      should: 'still have children in zone appended in subsequent bThread step',
      actual: zone?.children.length,
      expected: 1,
    })
    assert({
      given: 'append of sub-island with declarative shadowdom ',
      should: `sub-island upgraded and thus it's content are queryable`,
      actual: h3?.tagName,
      expected: 'H3',
    })
  },
}
