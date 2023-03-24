import { html, insertIsland, IslandTemplate, isle, PlaitProps } from '$plaited'
import { connect } from './comms.ts'
import { svg } from './noun-braids-2633610.ts'
import { classes, styles } from './shadow.styles.ts'

export const ShadowIsland = isle(
  { tag: 'shadow-island', connect },
  class extends HTMLElement {
    plait(
      { feedback, addThreads, sync, thread, context, $, loop }: PlaitProps,
    ) {
      addThreads({
        onRemoveSvg: thread(
          sync({ waitFor: { type: 'removeSvg' } }),
          sync({ request: { type: 'addSubIsland' } }),
        ),
        onStart: thread(
          sync({ waitFor: { type: 'start' } }),
          sync({ request: { type: 'addSlot' } }),
        ),
        onAddSvg: loop([
          sync({ waitFor: { type: 'add-svg' } }),
          sync({ request: { type: 'modifyAttributes' } }),
        ]),
      })
      feedback({
        addSubIsland() {
          const [zone] = $('zone')
          const subTemplate = IslandTemplate({
            styles,
            tag: 'sub-island',
            template: html`<h3 class="${
              classes['sub-island']
            }">sub island</h3>`,
          })
          insertIsland({ el: zone, template: subTemplate })
        },
        addButton() {
          context.insertAdjacentHTML(
            'beforeend',
            html`<button slot="button">add svg</button>`,
          )
        },
        modifyAttributes() {
          const [slot] = $('add-svg-slot')
          slot.removeAttribute('data-trigger')
        },
        addSlot() {
          const [row] = $('button-row')
          row.insertAdjacentHTML(
            'beforeend',
            html`<slot name="button" data-trigger="click->add-svg" data-target="add-svg-slot"></slot>`,
          )
        },
        removeSvg() {
          const [svg] = $('svg')
          svg.remove()
        },
        ['add-svg']() {
          console.log('add svg')
          const [zone] = $('zone')
          zone.insertAdjacentHTML(
            'beforeend',
            svg,
          )
        },
      })
    }
  },
)
