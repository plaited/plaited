import { defineWorker } from '../../client/define-worker.js'

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

defineWorker(
  ({ send }) => {
    return {
      calculate({ a, b, operation }: { a: number; b: number; operation: 'add' | 'subtract' | 'multiply' | 'divide' }) {
        send({
          type: 'update',
          detail: calculator[operation](a, b),
        })
      },
    }
  },
  { publicEvents: ['calculate'] },
)
