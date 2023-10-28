import { css } from '@plaited/jsx'
import { component, PlaitProps } from '../../index.js'
import { opacityHex } from '@plaited/utils'
import { SVG } from './noun-braids-2633610.js'

export const [ classes, stylesheet ] = css`
.zone {
  border: 1px black dashed;
  margin: 24px;
  padding: 12px;
  height: 300px;
  display: flex;
  flex-direction: column;
  gap: 25px;
  position: relative;
}
.svg {
  width: 125px;
  height: 125px;
}
.sub-island {
  height: 100%;
  width: 100%;
  position: absolute;
  top: 0;
  left: 0;
  margin: 0;
  display: flex;
  justify-content: center;
  align-items: center;
  background: #000000${opacityHex().get(0.75)};
  color: #ffffff${opacityHex().get(0.80)}
}
.row {
  display: flex;
  gap: 10px;
  padding: 12px;
}
::slotted(button), .button {
  height: 18px;
  width: auto;
}
`

export class ShadowIsland extends component({
  tag: 'shadow-island',
  template: <div className={classes.mount}
    {...stylesheet}
    data-target='wrapper'
  >
    <div className={classes.zone}
      data-target='zone'
    >
    </div>
    <div className={classes.row}
      data-target='button-row'
    >
      <button data-trigger={{ click: 'start' }}
        className={classes.button}
      >
    start
      </button>
      <button data-trigger={{ click: 'addButton' }}
        className={classes.button}
      >
    addButton
      </button>
    </div>
  </div>,
}){
     
  plait(
    { feedback, addThreads, sync, thread, host, $, loop }: PlaitProps
  ) {
    addThreads({
      onRemoveSvg: thread(
        sync({ waitFor: { type: 'removeSvg' } }),
        sync({ request: { type: 'addSubIsland' } })
      ),
      onStart: thread(
        sync({ waitFor: { type: 'start' } }),
        sync({ request: { type: 'addSlot' } })
      ),
      onAddSvg: loop([
        sync({ waitFor: { type: 'add-svg' } }),
        sync({ request: { type: 'modifyAttributes' } }),
      ]),
    })
    feedback({
      addSubIsland() {
        const zone = $('zone')
        /** render dynamic island to zone */
        zone?.render(
          <sub-island {...stylesheet}>
            <h3 className={classes['sub-island']}>sub island</h3>
          </sub-island>,
          'beforeend'
        )
      },
      addButton() {
        host.insertAdjacentHTML('beforeend',  `<button slot='button'>add svg</button>`)
      },
      modifyAttributes() {
        const slot = $('add-svg-slot')
        slot?.removeAttribute('data-trigger')
      },
      addSlot() {
        const row = $('button-row')
        row?.render(
          <slot
            name='button'
            data-target='add-svg-slot'
            data-trigger={{ click: 'add-svg' }}
          >
          </slot>,
          'beforeend'
        )
      },
      removeSvg() {
        const svg = $('svg')
        svg?.remove()
      },
      ['add-svg']() {
        const zone = $('zone')
        zone?.render(
          <SVG />,
          'beforeend'
        )
      },
    })
  }
}
