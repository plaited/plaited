import {
  define,
  loop,
  messenger,
  request,
  strand,
  useStore,
  waitFor,
} from '$plaited'

const { connect, send } = messenger()

// @ts-ignore: test
window.streamLog = []
define({ tag: 'key-pad' }, ({ feedback }) => {
  feedback({
    number(evt: MouseEvent) {
      const val = (evt.currentTarget as HTMLButtonElement)?.value
      send('value-display', {
        type: `addNumber-${val}`,
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

define({ tag: 'value-display', connect }, ({ $, feedback, add }) => {
  const [getDisplay, setDisplay] = useStore<string[]>([])
  add({
    onClear: loop(strand(
      waitFor({ type: 'clear' }),
      request({ type: 'clearDisplay' }),
    )),
    ...[...Array(10).keys()].reduce((acc, cur) => {
      Object.assign(acc, {
        [`onClick:${cur}`]: loop(strand(
          waitFor({ type: `addNumber-${cur}` }),
          request<{ type: 'updateNumber'; data: number }>({
            type: 'updateNumber',
            data: cur,
          }),
        )),
      })
      return acc
    }, {}),
    onLog: loop(strand(
      waitFor({ type: 'logMe' }),
      request({ type: 'logSelf' }),
    )),
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
})
