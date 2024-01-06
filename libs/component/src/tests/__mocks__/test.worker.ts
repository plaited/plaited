import { bProgram } from '@plaited/behavioral'
import { handlePostMessage } from '../../utils.js'

const { trigger, feedback } = bProgram()

const { send } = handlePostMessage({
  trigger,
  observedTriggers: ['calculate'],
})

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
  calculate({ a, b, operation }: { a: number; b: number; operation: 'add' | 'subtract' | 'multiply' | 'divide' }) {
    send({
      type: 'update',
      detail: calculator[operation](a, b),
    })
  },
})
