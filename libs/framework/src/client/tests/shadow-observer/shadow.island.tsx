import { defineTemplate, css } from 'plaited'
import { SVG } from './noun-braids-2633610.js'

export const styles = css.create({
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

const SubIsland = defineTemplate({
  tag: 'sub-island',
  shadowDom: <h3>sub island</h3>,
})

export const ShadowIsland = defineTemplate({
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
  connectedCallback({ bThreads, host, $, sync, point }) {
    bThreads.set({
      onRemoveSvg: sync([point({ waitFor: 'removeSvg' }), point({ request: { type: 'addSubIsland' } })]),
      onStart: sync([point({ waitFor: 'start' }), point({ request: { type: 'addSlot' } })]),
      onAddSvg: sync([point({ waitFor: 'add-svg' }), point({ request: { type: 'modifyAttributes' } })], true),
    })
    return {
      addSubIsland() {
        const [zone] = $('zone')
        /** render dynamic island to zone */
        zone?.insert('beforeend', <SubIsland {...styles['sub-island']} />)
      },
      addButton() {
        host.insertAdjacentHTML('beforeend', `<button slot='button'>add svg</button>`)
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
