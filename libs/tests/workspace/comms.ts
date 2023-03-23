import { messenger, useWebWorker } from '$plaited'
export const { connect, send } = messenger()
useWebWorker({ id: 'worker', url: '/calculator.worker.js', connect, send })
