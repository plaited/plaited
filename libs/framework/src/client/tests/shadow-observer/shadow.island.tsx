import { defineTemplate, css } from 'plaited'

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

const SubIsland = defineTemplate({
  tag: 'sub-island',
  shadowDom: (
    <h3
      className={'sub-island'}
      {...stylesheet}
    >
      sub island
    </h3>
  ),
})

export const ShadowIsland = defineTemplate({
  tag: 'shadow-island',
  shadowDom: (
    <div
      {...stylesheet}
      className={'mount'}
      p-target='wrapper'
    >
      <div
        className={'zone'}
        p-target='zone'
      ></div>
      <div
        className={'row'}
        p-target='button-row'
      >
        <button
          p-trigger={{ click: 'start' }}
          className={'button'}
        >
          start
        </button>
        <button
          p-trigger={{ click: 'addButton' }}
          className={'button'}
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
        zone?.insert('beforeend', <SubIsland {...stylesheet} />)
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
