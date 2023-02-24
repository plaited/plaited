import { define, loop, messenger, sets, useStore } from '$plaited'

const { connect, send } = messenger()

// @ts-ignore: test
window.streamLog = []
define({ tag: 'key-pad' }, ({ feedback }) => {
  feedback({
    number(evt: MouseEvent) {
      const val = (evt.currentTarget as HTMLButtonElement)?.value
      send('value-display', {
        event: `addNumber`,
        payload: val,
      })
    },
    clear() {
      send('value-display', {
        event: 'clear',
      })
    },
  })
})

define(
  { tag: 'value-display', connect },
  ({ $, feedback, add, lastPayload }) => {
    const [getDisplay, setDisplay] = useStore<string[]>([])
    add({
      onClear: loop(sets({
        waitFor: { event: 'clear' },
        request: { event: 'clearDisplay' },
      })),
      onClick: loop(
        sets({
          waitFor: { event: `addNumber` },
          request: {
            event: 'updateNumber',
            payload: lastPayload(),
          },
        }),
      ),
      onLog: loop(
        sets({
          waitFor: { event: 'logMe' },
          request: { event: 'logSelf' },
        }),
      ),
    })

    const updateDisplay = (target: Element, arr: string[]) => {
      target.replaceChildren(
        `${arr[3] || 0}${arr[2] || 0}:${arr[1] || 0}${arr[0] || 0}`,
      )
    }

    feedback({
      updateNumber(payload: string) {
        if (getDisplay.length < 5) {
          setDisplay([...getDisplay(), payload])
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
