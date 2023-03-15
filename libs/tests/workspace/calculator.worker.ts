import { bProgram, useMain } from '$plaited'

const { trigger, feedback } = bProgram()

const { send } = useMain({ context: self, trigger })

const calculator = {
  add(prev: number, cur: number) {
    return prev + cur
  },
  minus(prev: number, cur: number) {
    return prev - cur
  },
  multiply(prev: number, cur: number) {
    return prev * cur
  },
  divide(prev: number, cur: number) {
    return prev / cur
  },
}

feedback({
  percent(
    {
      prev,
      cur,
      operation,
    }: {
      prev: number
      cur: number
      operation: 'add' | 'minus' | 'multiply' | 'divide'
    },
  ) {
    send('calculator-island', {
      event: 'updateOnCalculate',
      detail: {
        value: calculator[operation](prev, (cur / 100) * prev),
        operation,
      },
    })
  },
  squareRoot(detail: { cur: number }) {
    send('calculator-island', {
      event: 'updateOnSquareRoot',
      detail: { value: Math.sqrt(detail.cur) },
    })
  },
  calculate(
    {
      prev,
      cur,
      operation,
    }: {
      prev: number
      cur: number
      operation: 'add' | 'minus' | 'multiply' | 'divide'
    },
  ) {
    send('calculator-island', {
      event: 'updateOnCalculate',
      detail: {
        value: calculator[operation](prev, cur),
        operation,
      },
    })
  },
  equal(
    {
      prev,
      cur,
      operation,
    }: {
      prev: number
      cur: number
      operation: 'add' | 'minus' | 'multiply' | 'divide'
    },
  ) {
    send('calculator-island', {
      event: 'updateOnEqual',
      detail: {
        value: calculator[operation](prev, cur),
        operation,
      },
    })
  },
})
