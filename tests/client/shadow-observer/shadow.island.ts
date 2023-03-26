import { html, isle, PlaitProps, render } from '$plaited'
import { svg } from './noun-braids-2633610.ts'
import { classes, styles } from './shadow.styles.ts'

export const ShadowIsland = isle(
  { tag: 'shadow-island' },
  (base) =>
    class extends base {
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
            const sub = isle({
              tag: 'sub-island',
            }, (base) => class extends base {})
            const subTemplate = sub.template({
              styles,
              shadow: html`<h3 class="${
                classes['sub-island']
              }">sub island</h3>`,
            })
            render(zone, subTemplate, 'beforeend')
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
              html`<slot name="button"  data-target="add-svg-slot" data-trigger="click->add-svg"></slot>`,
            )
          },
          removeSvg() {
            const [svg] = $('svg')
            svg.remove()
          },
          ['add-svg']() {
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
