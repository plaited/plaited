import { bThread, define, loop, sync, useStore } from '$plaited'
import { connect } from '../comms.ts'

define(
  { tag: 'value-display', connect },
  ({ $, feedback, add }) => {
    const [getDisplay, setDisplay] = useStore<string[]>([])
    add({
      onClear: loop(bThread(
        sync({
          waitFor: { event: 'clear' },
        }),
        sync({
          request: { event: 'clearDisplay' },
        }),
      )),
      onLog: loop(bThread(
        sync({
          waitFor: { event: 'test' },
        }),
        sync({
          request: { event: 'logSelf' },
        }),
      )),
    })

    const updateDisplay = (target: Element, arr: string[]) => {
      target.replaceChildren(
        `${arr[3] || 0}${arr[2] || 0}:${arr[1] || 0}${arr[0] || 0}`,
      )
    }

    feedback({
      addNumber({ value }: { value: string }) {
        if (getDisplay.length < 5) {
          setDisplay([...getDisplay(), value])
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
        console.log('self')
      },
    })
  },
)
