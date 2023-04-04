import { isle, PlaitProps, render } from '$plaited'
import { SVG } from './noun-braids-2633610.tsx'
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
            const Sub = isle({
              tag: 'sub-island',
            }, (base) => class extends base {})
            render(
              zone,
              <Sub.template styles={styles}>
                <h3 class={classes['sub-island']}>sub island</h3>
              </Sub.template>,
              'beforeend',
            )
          },
          addButton() {
            render(context, <button slot='button'>add svg</button>, 'beforeend')
          },
          modifyAttributes() {
            const [slot] = $('add-svg-slot')
            slot.removeAttribute('data-trigger')
          },
          addSlot() {
            const [row] = $('button-row')
            row.render(
              <slot
                name='button'
                data-target='add-svg-slot'
                data-trigger='click->add-svg'
              >
              </slot>,
              'beforeend',
            )
          },
          removeSvg() {
            const [svg] = $('svg')
            svg.remove()
          },
          ['add-svg']() {
            const [zone] = $('zone')
            zone.render(
              <SVG />,
              'beforeend',
            )
          },
        })
      }
    },
)
