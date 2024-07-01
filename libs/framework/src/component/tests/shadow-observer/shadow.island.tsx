import { css } from '../../../index.js'

import { Component } from '../../component.js'
import { opacityHex } from '@plaited/utils'
import { SVG } from './noun-braids-2633610.js'

export const stylesheet = css`
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
    background: #000000 ${opacityHex().get(0.75)};
    color: #ffffff ${opacityHex().get(0.8)};
  }
  .row {
    display: flex;
    gap: 10px;
    padding: 12px;
  }
  ::slotted(button),
  .button {
    height: 18px;
    width: auto;
  }
`

const SubIsland = Component({
  tag: 'sub-island',
  template: (
    <h3
      className={'sub-island'}
      {...stylesheet}
    >
      sub island
    </h3>
  ),
})

export const ShadowIsland = Component({
  tag: 'shadow-island',
  template: (
    <div
      {...stylesheet}
      className={'mount'}
      bp-target='wrapper'
    >
      <div
        className={'zone'}
        bp-target='zone'
      ></div>
      <div
        className={'row'}
        bp-target='button-row'
      >
        <button
          bp-trigger={{ click: 'start' }}
          className={'button'}
        >
          start
        </button>
        <button
          bp-trigger={{ click: 'addButton' }}
          className={'button'}
        >
          addButton
        </button>
      </div>
    </div>
  ),
  bp({ addThreads, sync, thread, host, $, loop }) {
    addThreads({
      onRemoveSvg: thread(sync({ waitFor: 'removeSvg' }), sync({ request: { type: 'addSubIsland' } })),
      onStart: thread(sync({ waitFor: 'start' }), sync({ request: { type: 'addSlot' } })),
      onAddSvg: loop(sync({ waitFor: 'add-svg' }), sync({ request: { type: 'modifyAttributes' } })),
    })
    return {
      addSubIsland() {
        const [zone] = $('zone')
        /** render dynamic island to zone */
        zone?.insert('beforeend', <SubIsland {...stylesheet} />)
      },
      addButton() {
        host.insertAdjacentHTML('beforeend', `<button slot='button'>add svg</button>`)
      },
      modifyAttributes() {
        const [slot] = $('add-svg-slot')
        slot?.attr('bp-trigger', null)
      },
      addSlot() {
        const [row] = $('button-row')
        row?.insert(
          'beforeend',
          <slot
            name='button'
            bp-target='add-svg-slot'
            bp-trigger={{ click: 'add-svg' }}
          ></slot>,
        )
      },
      removeSvg() {
        const [svg] = $('svg')
        svg?.remove()
      },
      ['add-svg']() {
        const [zone] = $('zone')
        zone?.insert('beforeend', <SVG />)
      },
    }
  },
})
