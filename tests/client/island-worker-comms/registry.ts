import { useWebWorker } from '$plaited'
import { connect, send } from './comms.ts'
import { CalculatorIsland } from './calculator.island.ts'

useWebWorker({
  id: 'worker',
  url: '/island-worker-comms/calculator.worker.js',
  connect,
  send,
})

CalculatorIsland()
