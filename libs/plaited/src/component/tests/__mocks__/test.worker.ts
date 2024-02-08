import { bProgram } from '../../../index.js'
import { usePostMessage } from '../../utils.js'

const { trigger, feedback } = bProgram()

const send = usePostMessage({
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
