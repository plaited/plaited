import { bProgram, useMain } from 'plaited'

const { trigger, feedback } = bProgram()

const [ send ] = useMain(self, trigger)

const calculator = {
  add(prev: number, cur: number) {
    return prev + cur
  },
  subtract(prev: number, cur: number) {
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
      operation: 'add' | 'subtract' | 'multiply' | 'divide'
    }
  ) {
    send('calculator-island', {
      type: 'updateOnPercent',
      detail: { prev, cur: (cur / 100) * prev, operation },
    })
  },
  squareRoot(detail: { cur: number }) {
    send('calculator-island', {
      type: 'updateOnSquareRoot',
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
      operation: 'add' | 'subtract' | 'multiply' | 'divide'
    }
  ) {
    send('calculator-island', {
      type: 'updateOnCalculate',
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
      operation: 'add' | 'subtract' | 'multiply' | 'divide'
    }
  ) {
    send('calculator-island', {
      type: 'updateOnEqual',
      detail: {
        value: calculator[operation](prev, cur),
        operation,
      },
    })
  },
})
