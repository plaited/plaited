import { Component, PlaitProps, RulesFunc, useStore, css, useMessenger } from 'plaited'

export const symbols = {
  add: '+',
  divide: '÷',
  equal: '=',
  subtract: '–',
  multiply: '×',
  percent: '%',
  rest: '',
  squareRoot: '√',
}

export const ops = {
  add: symbols.add,
  divide: symbols.divide,
  subtract: symbols.subtract,
  multiply: symbols.multiply,
}

const [connect, send] = useMessenger()

const worker = new Worker(new URL('./worker.ts', import.meta.url), {
  type: 'module',
})

connect.worker('worker', worker)

const [classes, stylesheet] = css`
  :host {
    --button-size: 50px;
  }
  .calculator {
    display: grid;
    gap: 10px;
    grid-template-areas:
      'display display display display'
      '. . . .'
      '. . . .'
      '. . . .'
      '. . . .'
      '. . . .';
    grid-template-columns: repeat(4, var(--button-size));
    grid-template-rows: calc(2 * var(--button-size)) repeat(5, var(--button-size));
  }
  .display {
    grid-area: display;
    text-align: end;
  }
  .header {
    margin: 0;
    height: 50%;
  }
  .number {
    width: var(--button-size);
    height: var(--button-size);
  }
  .side {
    width: var(--button-size);
    height: var(--button-size);
  }
  .top {
    width: var(--button-size);
    height: var(--button-size);
  }
  .clear {
    width: var(--button-size);
    height: var(--button-size);
  }
`

const template = (
  <div
    className={classes.calculator}
    {...stylesheet}
  >
    {/* <!-- display --> */}
    <div className={classes.display}>
      <h1
        data-target='previous'
        className={classes.header}
      ></h1>
      <h1
        data-target='current'
        className={classes.header}
      >
        0
      </h1>
    </div>
    {/* <!-- Row one --> */}
    <button
      className={classes.top}
      data-trigger={{ click: 'positive-negative' }}
    >
      {symbols.add}/{symbols.subtract}
    </button>
    <button
      className={classes.top}
      data-trigger={{ click: 'squareRoot' }}
      value='squareRoot'
    >
      {symbols.squareRoot}
    </button>
    <button
      className={classes.top}
      data-trigger={{ click: 'percent' }}
      value='percent'
    >
      {symbols.percent}
    </button>
    <button
      className={classes.side}
      data-trigger={{ click: 'divide' }}
      value='divide'
    >
      {symbols.divide}
    </button>
    {/* <!-- Row two --> */}
    <button
      className={classes.number}
      data-trigger={{ click: 'number' }}
      value='7'
    >
      7
    </button>
    <button
      className={classes.number}
      data-trigger={{ click: 'number' }}
      value='8'
    >
      8
    </button>
    <button
      className={classes.number}
      data-trigger={{ click: 'number' }}
      value='9'
    >
      9
    </button>
    <button
      className={classes.side}
      data-trigger={{ click: 'multiply' }}
      value='multiply'
    >
      {symbols.multiply}
    </button>
    {/* <!-- Row three --> */}
    <button
      className={classes.number}
      data-trigger={{ click: 'number' }}
      value='4'
    >
      4
    </button>
    <button
      className={classes.number}
      data-trigger={{ click: 'number' }}
      value='5'
    >
      5
    </button>
    <button
      className={classes.number}
      data-trigger={{ click: 'number' }}
      value='6'
    >
      6
    </button>
    <button
      className={classes.side}
      data-trigger={{ click: 'subtract' }}
      value='subtract'
    >
      {symbols.subtract}
    </button>

    {/* <!-- Row four --> */}
    <button
      className={classes.number}
      data-trigger={{ click: 'number' }}
      value='1'
    >
      1
    </button>
    <button
      className={classes.number}
      data-trigger={{ click: 'number' }}
      value='2'
    >
      2
    </button>
    <button
      className={classes.number}
      data-trigger={{ click: 'number' }}
      value='3'
    >
      3
    </button>
    <button
      className={classes.side}
      data-trigger={{ click: 'add' }}
      value='add'
    >
      {symbols.add}
    </button>

    {/* <!-- Row five --> */}
    <button
      className={classes.clear}
      data-trigger={{ click: 'clear' }}
    >
      AC
    </button>
    <button
      className={classes.number}
      data-trigger={{ click: 'number' }}
      value='0'
    >
      0
    </button>
    <button
      className={classes.number}
      data-trigger={{ click: 'period' }}
    >
      .
    </button>
    <button
      className={classes.side}
      data-trigger={{ click: 'equal' }}
      value='equal'
    >
      {symbols.equal}
    </button>
  </div>
)

export class Calculator extends Component({
  tag: 'calculator-island',
  connect,
  template,
}) {
  plait({ $, addThreads, feedback, loop, sync }: PlaitProps) {
    const previous = $<HTMLHeadElement>('previous')
    const current = $<HTMLHeadElement>('current')
    const [getPrev, setPrev] = useStore<string>('')
    const [getCur, setCur] = useStore<string>('')
    const [getOp, setOp] = useStore<keyof typeof ops | ''>('')
    const onOperation = Object.keys(ops).reduce((acc: Record<string, RulesFunc>, operation) => {
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
                cb: ({ type }) => (type !== 'toggleOperation' ? false : !getPrev()),
              },
              {
                cb: ({ type }) => (type !== 'calculate' ? false : !(getCur() && getPrev())),
              },
            ],
          }),
        ]),
        [`shift-on-${operation}`]: loop([
          sync({
            waitFor: {
              cb: ({ type }) => (type !== operation ? false : !!getCur()),
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
    }, {})
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
              return cur.endsWith('.') || cur.includes('.')
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
              return !getCur()
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
          waitFor: [{ type: 'updateOnEqual' }],
        }),
        sync({ request: { type: 'resetPrevious' } }),
      ]),
    })
    feedback({
      resetPrevious() {
        setPrev('')
      },
      updateOnPercent(detail: { prev: number; cur: number; operation: keyof typeof ops }) {
        const cur = `${detail.cur}`
        const prev = `${detail.prev}`
        setCur(cur)
        setPrev(prev)
        current.replaceChildren(cur)
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
        current.replaceChildren(val)
      },
      squareRoot() {
        send('worker', {
          type: 'squareRoot',
          detail: { cur: parseFloat(getCur()) },
        })
      },
      updateOnEqual(detail: { value: number }) {
        const val = `${detail.value}`
        previous.replaceChildren(`${getPrev()} ${ops[getOp() as keyof typeof ops]}  ${getCur()} =`)
        setCur(val)
        current.replaceChildren(val)
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
        previous.replaceChildren(`${val} ${ops[getOp() as keyof typeof ops]}`)
        current.replaceChildren(val)
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
  }
}
