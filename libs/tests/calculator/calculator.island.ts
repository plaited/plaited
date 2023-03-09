import { define, loop, sync, useStore } from '$plaited'
import { connect, send } from './comms.ts'
import { ops } from './constants.ts'

define({
  tag: 'calculator-island',
  connect,
  logger: (msg: Record<string, unknown>) => console.log(msg),
}, ({ $, feedback, addRules }) => {
  const [previous] = $<HTMLHeadElement>('previous')
  const [current] = $<HTMLHeadElement>('current')

  const [getPrev, setPrev] = useStore<string>('')
  const [getCur, setCur] = useStore<string>('')
  const [getOp, setOp] = useStore<keyof typeof ops>('rest')
  addRules({
    onUpdate: loop([
      sync({
        waitFor: [
          { event: 'updateOnCalculate' },
          { event: 'updateOnEqual' },
        ],
      }),
      sync({ request: { event: 'resetCurrent' } }),
    ]),
  })
  feedback({
    resetCurrent() {
      setCur('')
    },
    percent() {
      if (getCur() && getPrev()) {
        send('worker', {
          event: 'percent',
          detail: {
            cur: parseFloat(getCur()),
            prev: parseFloat(getPrev()),
            operation: getOp(),
          },
        })
      }
    },
    updateOnSquareRoot(detail: { value: number }) {
      const val = `${detail.value}`
      setCur(val)
      current.replaceChildren(val)
    },
    squareRoot() {
      if (getCur()) {
        send('worker', {
          event: 'squareRoot',
          detail: { cur: parseFloat(getCur()) },
        })
      }
    },
    updateOnEqual(detail: { value: number }) {
      const val = `${detail.value}`
      previous.replaceChildren(`${getPrev()} ${ops[getOp()]}  ${getCur()} =`)
      setPrev(val)
      current.replaceChildren(val)
    },
    equal() {
      if (getCur() && getPrev()) {
        send('worker', {
          event: 'equal',
          detail: {
            cur: parseFloat(getCur()),
            prev: parseFloat(getPrev()),
            operation: getOp(),
          },
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
    ['positive-negative']() {
      if (getCur().startsWith('-')) {
        setCur((cur) => cur.replace('-', ''))
        current.replaceChildren(getCur())
        return
      }
      setCur((cur) => `-${cur}`)
      current.replaceChildren(getCur())
    },
    period() {
      const cur = getCur()
      if (cur.endsWith('.') || cur.includes('.')) return
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
