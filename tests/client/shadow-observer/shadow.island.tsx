import { css, isle, PlaitProps, useSugar } from '$plaited'
import { opacityHex } from '$utils'
import { SVG } from './noun-braids-2633610.tsx'

export const [classes, stylesheet] = css`
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
        const slotTarget = useSugar(context)
        feedback({
          addSubIsland() {
            const zone = $('zone')
            const Sub = isle({
              tag: 'sub-island',
            }, (base) => class extends base {})
            zone?.render(
              <Sub.template {...stylesheet}>
                <h3 class={classes['sub-island']}>sub island</h3>
              </Sub.template>,
              'beforeend',
            )
          },
          addButton() {
            slotTarget.render(
              <button slot='button'>add svg</button>,
              'beforeend',
            )
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
              'beforeend',
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
              'beforeend',
            )
          },
        })
      }
    },
)
