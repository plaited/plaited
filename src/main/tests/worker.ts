import { bWorker } from 'plaited'

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

await bWorker<{
  calculate: {
    a: number
    b: number
    operation: 'add' | 'subtract' | 'multiply' | 'divide'
  }
}>({
  publicEvents: ['calculate'],
  bProgram({ send }) {
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
