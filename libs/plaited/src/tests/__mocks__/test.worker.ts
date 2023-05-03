import { bProgram } from '@plaited/behavioral'
import { useMain } from '../../index.js'

const { trigger, feedback } = bProgram()

const [ send ] = useMain(self, trigger)

const calculator = {
  add(a: number, b: number) {
    return a + b
  },
  subtract(a: number, b: number) {
    return a - b
  },
  multiply(a: number, b: number) {
    return a * b
  },
  divide(a: number, b: number) {
    return a / b
  },
}

feedback({
  calculate(
    {
      a,
      b,
      operation,
    }: {
      a: number;
      b: number;
      operation: 'add' | 'subtract' | 'multiply' | 'divide';
    }
  ) {
    send('main', {
      type: 'update',
      detail: calculator[operation](a, b),
    })
  },
})
