import { css } from '@plaited/jsx'
import { isle, PlaitProps, useSugar, PlaitedElement, register } from '../../index.js'
import { opacityHex } from '@plaited/utils'
import { SVG } from './noun-braids-2633610.js'

const AddSVG:PlaitedElement = register('AddSVG', ({ children }) => (
  <button slot='button'
    data-target='add-svg'
    data-trigger={{ click: 'add-svg' }}
  >{children}</button>
))

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

export const ShadowIsland = isle(
  { tag: 'shadow-island' },
  base =>
    class extends base {
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
            /** create a dynamic island */
            const Sub = isle({
              tag: 'sub-island',
            })
            /** define the new dynamic island */
            Sub()
            /** render dynamic island to zone */
            zone?.render(
              <Sub.template {...stylesheet}>
                <h3 className={classes['sub-island']}>sub island</h3>
              </Sub.template>,
              'beforeend'
            )
          },
          addButton() {
            const lightDom = useSugar(host)
            lightDom.render(<script
              type='application/json'
              trusted
            >
              {JSON.stringify({
                $target:'add-svg-slot',
                $position: 'beforebegin',
                $data: {
                  $tag: 'AddSVG',
                  $attrs: {
                    children: 'add svg',
                  },
                },
              })}
            </script>)
          },
          modifyAttributes() {
            const btn = $('add-svg')
            btn?.removeAttribute('data-trigger')
          },
          addSlot() {
            const row = $('button-row')
            row?.render(
              <slot data-target='add-svg-slot'></slot>,
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
)

export const ShadowTemplate = () => (
  <ShadowIsland.template {...stylesheet}>
    <div className={classes.mount}
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
    </div>
  </ShadowIsland.template>
)
