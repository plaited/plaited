import { bElement, type FT } from 'plaited/ui'

import { styles } from './shadow-observer.css.ts'

export const DynamicIsland = bElement({
  tag: 'dynamic-island',
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
    aria-label='Test SVG'
    {...props}
  >
    <title>Test SVG</title>
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

export const MutationHost = bElement({
  tag: 'mutation-host',
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
        zone?.insert('beforeend', <DynamicIsland {...styles['sub-island']} />)
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
      'add-svg'() {
        const [zone] = $('zone')
        zone?.insert('beforeend', <SVG {...styles.svg} />)
      },
    }
  },
})
