import { define, useStore } from '$plaited'
import { connect, send } from './comms.ts'
import { ops } from './constants.ts'
import { styles } from './calculator.styles.ts'

define({
  styles,
  tag: 'calculator-island',
  connect,
  logger: (msg: Record<string, unknown>) => console.log(msg),
}, ({ $, feedback, addThreads, loop, sync }) => {
  const [previous] = $<HTMLHeadElement>('previous')
  const [current] = $<HTMLHeadElement>('current')

  const [getPrev, setPrev] = useStore<string>('')
  const [getCur, setCur] = useStore<string>('')
  const [getOp, setOp] = useStore<keyof typeof ops>('rest')
  addThreads({
    onPositive: loop([
      sync({
        waitFor: {
          event: 'negative',
          cb: ({ event }) => {
            if (event !== 'positive-negative') return false
            return getCur().startsWith('-')
          },
        },
      }),
      sync({
        request: {
          event: 'positive',
        },
      }),
    ]),
    onNegative: loop([
      sync({
        waitFor: {
          event: 'negative',
          cb: ({ event }) => {
            if (event !== 'positive-negative') return false
            return !getCur().startsWith('-')
          },
        },
      }),
      sync({
        request: {
          event: 'negative',
        },
      }),
    ]),
    onPeriod: loop([
      sync({
        block: {
          cb: ({ event }) => {
            if (event !== 'period') return false
            const cur = getCur()
            return (cur.endsWith('.') || cur.includes('.'))
          },
        },
      }),
    ]),
    onEqual: loop([
      sync({
        block: {
          cb: ({ event }) => {
            if (event !== 'equal') return false
            return !(getCur() && getPrev())
          },
        },
      }),
    ]),
    onSquareRoot: loop([
      sync({
        block: {
          cb: ({ event }) => {
            if (event !== 'squareRoot') return false
            return !(getCur())
          },
        },
      }),
    ]),
    onPercent: loop([
      sync({
        block: {
          cb: ({ event }) => {
            if (event !== 'percent') return false
            return !(getCur() && getPrev())
          },
        },
      }),
    ]),
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
      send('worker', {
        event: 'percent',
        detail: {
          cur: parseFloat(getCur()),
          prev: parseFloat(getPrev()),
          operation: getOp(),
        },
      })
    },
    updateOnSquareRoot(detail: { value: number }) {
      const val = `${detail.value}`
      setCur(val)
      current.replaceChildren(val)
    },
    squareRoot() {
      send('worker', {
        event: 'squareRoot',
        detail: { cur: parseFloat(getCur()) },
      })
    },
    updateOnEqual(detail: { value: number }) {
      const val = `${detail.value}`
      previous.replaceChildren(`${getPrev()} ${ops[getOp()]}  ${getCur()} =`)
      setPrev(val)
      current.replaceChildren(val)
    },
    equal() {
      send('worker', {
        event: 'equal',
        detail: {
          cur: parseFloat(getCur()),
          prev: parseFloat(getPrev()),
          operation: getOp(),
        },
      })
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
