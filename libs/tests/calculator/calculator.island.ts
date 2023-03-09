import { bThread, define, loop, sync, useStore } from '$plaited'
import { connect, send } from './comms.ts'
import { ops } from './constants.ts'

define({
  tag: 'calculator-island',
  connect,
  logger: (msg: Record<string, unknown>) => console.log(msg),
}, ({ $, feedback, add }) => {
  const [previous] = $<HTMLHeadElement>('previous')
  const [current] = $<HTMLHeadElement>('current')

  const [getPrev, setPrev] = useStore<string>('')
  const [getCur, setCur] = useStore<string>('')
  const [getOp, setOp] = useStore<keyof typeof ops>('rest')
  add({
    setPeriod: loop(bThread(
      sync<MouseEvent>({
        block: {
          cb: ({ event }) => {
            if (event !== 'period') return false
            const cur = getCur()
            if (cur.endsWith('.') || cur.includes('.')) return true
            return false
          },
        },
      }),
    )),
    onUpdate: loop(bThread(
      sync({
        waitFor: [
          { event: 'updateOnCalculate' },
          { event: 'updateOnEqual' },
        ],
      }),
      sync({ request: { event: 'resetCurrent' } }),
    )),
  })
  feedback({
    resetCurrent() {
      setCur('')
    },
    percent() {
      if (getCur() && getPrev()) {
        send('worker', {
          event: 'percent',
          detail: { cur: getCur(), prev: getPrev(), operation: getOp() },
        })
      }
    },
    updateOnSquareRoot(detail: { value: number }) {
      setCur(`${detail.value}`)
    },
    squareRoot() {
      if (getCur()) {
        send('worker', {
          event: 'squareRoot',
          detail: { cur: getCur() },
        })
      }
    },
    updateOnEqual(detail: { value: number }) {
      const val = `${detail.value}`
      previous.replaceChildren(`${getPrev()} ${ops[getOp()]}  ${getCur()} =`)
      current.replaceChildren(val)
    },
    equal() {
      if (getCur() && getPrev()) {
        send('worker', {
          event: 'equal',
          detail: { cur: getCur(), prev: getPrev(), operation: getOp() },
        })
      }
    },
    updateOnCalculate(detail: { value: number }) {
      const val = `${detail.value}`
      setPrev(val)
      previous.replaceChildren(`${val} ${ops[getOp()]}`)
      current.replaceChildren(val)
    },
    calculate(evt: MouseEvent) {
      const value = (evt.currentTarget as HTMLButtonElement)
        .value as keyof typeof ops
      if (getCur() && getPrev()) {
        send('worker', {
          event: 'calculate',
          detail: {
            cur: parseFloat(getCur()),
            prev: parseFloat(getPrev()),
            operation: getOp(),
          },
        })
        return setOp(value)
      }
      if (getCur()) {
        setPrev(getCur())
        setCur('')
      }
      setOp(value)
      previous.replaceChildren(`${getPrev()} ${ops[value]}`)
    },
    clear() {
      setCur('')
      setPrev('')
      current.replaceChildren('0')
      previous.replaceChildren('')
    },
    positive() {
      setCur((cur) => cur.replace('-', ''))
      current.replaceChildren(getCur())
    },
    negative() {
      setCur((cur) => `-${cur}`)
      current.replaceChildren(getCur())
    },
    period() {
      setCur((cur) => `${cur}.`)
      current.replaceChildren(getCur())
    },
    number(evt: MouseEvent) {
      const value = (evt.currentTarget as HTMLButtonElement).value
      setCur((cur) => `${cur}${value}`)
      current.replaceChildren(getCur())
    },
  })
})
