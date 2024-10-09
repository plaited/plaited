import { defineWorker } from '../define-worker.ts'

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

defineWorker<{
  calculate: (args: { a: number; b: number; operation: 'add' | 'subtract' | 'multiply' | 'divide' }) => void
}>({
  publicEvents: ['calculate'],
  connectedCallback({ send }) {
    return {
      calculate({ a, b, operation }) {
        send({
          type: 'update',
          detail: calculator[operation](a, b),
        })
      },
    }
  },
})
