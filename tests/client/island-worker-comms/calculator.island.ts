import { isle, PlaitProps, RulesFunc, useStore } from '$plaited'
import { connect, send } from './comms.ts'
import { ops } from '../constants.ts'
export const CalculatorIsland = isle(
  {
    tag: 'calculator-island',
    connect,
  },
  (base) =>
    class extends base {
      plait({ $, addThreads, feedback, loop, sync }: PlaitProps) {
        const previous = $<HTMLHeadElement>('previous')
        const current = $<HTMLHeadElement>('current')
        const [getPrev, setPrev] = useStore<string>('')
        const [getCur, setCur] = useStore<string>('')
        const [getOp, setOp] = useStore<keyof typeof ops | ''>('')
        const onOperation = Object.keys(ops).reduce(
          (acc: Record<string, RulesFunc>, operation) => {
            Object.assign(acc, {
              [`calculate-on-${operation}`]: loop([
                sync({ waitFor: [{ type: operation }] }),
                sync({ waitFor: [{ type: operation }] }),
                sync({
                  request: {
                    type: 'calculate',
                    detail: { operation: operation },
                  },
                }),
              ]),
              [`block-on-${operation}`]: loop([
                sync({ waitFor: [{ type: operation }, { type: 'shiftCur' }] }),
                sync({
                  block: [
                    {
                      cb: ({ type }) =>
                        type !== 'toggleOperation' ? false : !getPrev(),
                    },
                    {
                      cb: ({ type }) =>
                        type !== 'calculate' ? false : !(getCur() && getPrev()),
                    },
                  ],
                }),
              ]),
              [`shift-on-${operation}`]: loop([
                sync({
                  waitFor: {
                    cb: ({ type }) => type !== operation ? false : !!getCur(),
                  },
                }),
                sync({
                  request: {
                    type: 'shiftCur',
                    detail: { operation: operation },
                  },
                }),
                sync({
                  request: {
                    type: 'toggleOperation',
                    detail: { operation: operation },
                  },
                }),
              ]),
              [`toggle-on-${operation}`]: loop([
                sync({ waitFor: { type: operation } }),
                sync({
                  request: {
                    type: 'toggleOperation',
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
          onAnyOperation: loop([
            sync({
              waitFor: {
                cb: ({ type }) => {
                  const ops = ['add', 'subtract', 'multiply', 'divide']
                  if (!ops.includes(type)) return false
                  return !!(getCur() && getPrev())
                },
              },
            }),
            sync({
              request: { type: 'calculate' },
            }),
          ]),
          ...onOperation,
          onPositive: loop([
            sync({
              waitFor: {
                cb: ({ type }) => {
                  if (type !== 'positive-negative') return false
                  return getCur().startsWith('-')
                },
              },
            }),
            sync({
              request: {
                type: 'positive',
              },
            }),
          ]),
          onNegative: loop([
            sync({
              waitFor: {
                cb: ({ type }) => {
                  if (type !== 'positive-negative') return false
                  return !getCur().startsWith('-')
                },
              },
            }),
            sync({
              request: {
                type: 'negative',
              },
            }),
          ]),
          onPeriod: loop([
            sync({
              block: {
                cb: ({ type }) => {
                  if (type !== 'period') return false
                  const cur = getCur()
                  return (cur.endsWith('.') || cur.includes('.'))
                },
              },
            }),
          ]),
          onEqual: loop([
            sync({
              block: {
                cb: ({ type }) => {
                  if (type !== 'equal') return false
                  return !(getCur() && getPrev())
                },
              },
            }),
          ]),
          onSquareRoot: loop([
            sync({
              block: {
                cb: ({ type }) => {
                  if (type !== 'squareRoot') return false
                  return !(getCur())
                },
              },
            }),
          ]),
          onPercent: loop([
            sync({
              block: {
                cb: ({ type }) => {
                  if (type !== 'percent') return false
                  return !(getCur() && getPrev())
                },
              },
            }),
          ]),
          afterEqualUpdate: loop([
            sync({
              waitFor: [
                { type: 'updateOnEqual' },
              ],
            }),
            sync({ request: { type: 'resetPrevious' } }),
          ]),
        })
        feedback({
          resetPrevious() {
            setPrev('')
          },
          updateOnPercent(
            detail: { prev: number; cur: number; operation: keyof typeof ops },
          ) {
            const cur = `${detail.cur}`
            const prev = `${detail.prev}`
            setCur(cur)
            setPrev(prev)
            current?.replaceChildren(cur)
          },
          percent() {
            send('worker', {
              type: 'percent',
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
            current?.replaceChildren(val)
          },
          squareRoot() {
            send('worker', {
              type: 'squareRoot',
              detail: { cur: parseFloat(getCur()) },
            })
          },
          updateOnEqual(detail: { value: number }) {
            const val = `${detail.value}`
            previous?.replaceChildren(
              `${getPrev()} ${ops[getOp() as keyof typeof ops]}  ${getCur()} =`,
            )
            setCur(val)
            current?.replaceChildren(val)
          },
          equal() {
            send('worker', {
              type: 'equal',
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
            previous?.replaceChildren(
              `${val} ${ops[getOp() as keyof typeof ops]}`,
            )
            current?.replaceChildren(val)
          },
          shiftCur() {
            setPrev(getCur())
            setCur('')
          },
          toggleOperation({ operation }: { operation: keyof typeof ops }) {
            setOp(operation)
            previous?.replaceChildren(`${getPrev()} ${ops[operation]}`)
          },
          calculate({ operation }: { operation: keyof typeof ops }) {
            send('worker', {
              type: 'calculate',
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
            current?.replaceChildren('0')
            previous?.replaceChildren('')
          },
          positive() {
            setCur((cur) => cur.replace('-', ''))
            current?.replaceChildren(getCur())
          },
          negative() {
            setCur((cur) => `-${cur}`)
            current?.replaceChildren(getCur())
          },
          period() {
            setCur((cur) => `${cur}.`)
            current?.replaceChildren(getCur())
          },
          number(event: MouseEvent) {
            const value = (event.currentTarget as HTMLButtonElement).value
            setCur((cur) => `${cur}${value}`)
            current?.replaceChildren(getCur())
          },
        })
      }
    },
)
