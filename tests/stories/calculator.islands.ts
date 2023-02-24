import { define, loop, messenger, sets, useStore } from '$plaited'

const { connect, send } = messenger()

// @ts-ignore: test
window.streamLog = []
define({ tag: 'key-pad' }, ({ feedback }) => {
  feedback({
    number(evt: MouseEvent) {
      const val = (evt.currentTarget as HTMLButtonElement)?.value
      send('value-display', {
        type: `addNumber`,
        data: val,
      })
    },
    clear() {
      send('value-display', {
        type: 'clear',
      })
    },
  })
})

define(
  { tag: 'value-display', connect },
  ({ $, feedback, add, lastSelected }) => {
    const [getDisplay, setDisplay] = useStore<string[]>([])
    add({
      onClear: loop(sets({
        waitFor: { type: 'clear' },
        request: { type: 'clearDisplay' },
      })),
      onClick: loop(
        sets({
          waitFor: { type: `addNumber` },
          request: {
            type: 'updateNumber',
            data: lastSelected(),
          },
        }),
      ),
      onLog: loop(
        sets({
          waitFor: { type: 'logMe' },
          request: { type: 'logSelf' },
        }),
      ),
    })

    const updateDisplay = (target: Element, arr: string[]) => {
      target.replaceChildren(
        `${arr[3] || 0}${arr[2] || 0}:${arr[1] || 0}${arr[0] || 0}`,
      )
    }

    feedback({
      updateNumber(data: string) {
        if (getDisplay.length < 5) {
          setDisplay([...getDisplay(), data])
        }
        const [display] = $('display')
        updateDisplay(display, getDisplay())
      },
      clearDisplay() {
        const [display] = $('display')
        display.replaceChildren('00:00')
        setDisplay([])
      },
      logSelf() {
        console.log('hit')
      },
    })
  },
)
