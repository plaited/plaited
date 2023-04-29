import { bProgram, useMain } from '../../index.js'

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
  calculate(
    {
      prev,
      cur,
      operation,
    }: {
      prev: number;
      cur: number;
      operation: 'add' | 'subtract' | 'multiply' | 'divide';
    }
  ) {
    send('main', {
      type: 'calculation',
      detail: calculator[operation](prev, cur),
    })
    self.close()
  },
})
