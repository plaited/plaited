import { define, Logger, RulesFunc, useStore } from '$plaited'
import { connect, send } from './comms.ts'
import { ops } from './constants.ts'
import { styles } from './calculator.styles.ts'

const logger: Logger = (msg) => {
  console.table(msg)
}

define({
  styles,
  tag: 'calculator-island',
  connect,
  logger,
}, ({ $, feedback, addThreads, loop, sync }) => {
  const [previous] = $<HTMLHeadElement>('previous')
  const [current] = $<HTMLHeadElement>('current')
  const [getPrev, setPrev] = useStore<string>('')
  const [getCur, setCur] = useStore<string>('')
  const [getOp, setOp] = useStore<keyof typeof ops | ''>('')
  const onOperation = Object.keys(ops).reduce(
    (acc: Record<string, RulesFunc>, operation) => {
      Object.assign(acc, {
        [`calculate-on-${operation}`]: loop([
          sync({ waitFor: [{ event: operation }] }),
          sync({
            request: { event: 'calculate', detail: { operation: operation } },
          }),
        ]),
        [`block-on-${operation}`]: loop([
          sync({ waitFor: [{ event: operation }, { event: 'shiftCur' }] }),
          sync({
            block: [
              {
                cb: ({ event }) =>
                  event !== 'toggleOperation' ? false : !getPrev(),
              },
              {
                cb: ({ event }) =>
                  event !== 'calculate' ? false : !(getCur() && getPrev()),
              },
            ],
          }),
        ]),
        [`shift-on-${operation}`]: loop([
          sync({
            waitFor: {
              cb: ({ event }) => event !== operation ? false : !!getCur(),
            },
          }),
          sync({
            request: { event: 'shiftCur', detail: { operation: operation } },
          }),
          sync({
            request: {
              event: 'toggleOperation',
              detail: { operation: operation },
            },
          }),
        ]),
        [`toggle-on-${operation}`]: loop([
          sync({ waitFor: { event: operation } }),
          sync({
            request: {
              event: 'toggleOperation',
              detail: { operation: operation },
            },
          }),
        ]),
      })

      return acc
    },
    {},
  )
  addThreads({
    ...onOperation,
    onPositive: loop([
      sync({
        waitFor: {
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
    afterEqualUpdate: loop([
      sync({
        waitFor: [
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
      previous.replaceChildren(
        `${getPrev()} ${ops[getOp() as keyof typeof ops]}  ${getCur()} =`,
      )
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
      previous.replaceChildren(`${val} ${ops[getOp() as keyof typeof ops]}`)
      current.replaceChildren(val)
      console.log({ cur: parseFloat(getCur()), prev: parseFloat(getPrev()) })
    },
    shiftCur() {
      setPrev(getCur())
      setCur('')
    },
    toggleOperation({ operation }: { operation: keyof typeof ops }) {
      setOp(operation)
      previous.replaceChildren(`${getPrev()} ${ops[operation]}`)
    },
    calculate({ operation }: { operation: keyof typeof ops }) {
      send('worker', {
        event: 'calculate',
        detail: {
          cur: parseFloat(getCur()),
          prev: parseFloat(getPrev()),
          operation: getOp(),
        },
      })
      setOp(operation)
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
