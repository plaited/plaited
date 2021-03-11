import {compose} from '@plaited/utils'
// interface OnInterface {
//   (name: string, cb: (detail: unknown) => void): void
// }
// interface EmitInterface {
//   (name: string, detail: unknown): void
// }
// interface EventEmitterInterface {
//   (): Readonly<{
//     on: OnInterface
//     emit: EmitInterface
//   }>
// }
/** @description returns on and emit handlers for custom event
 * using a new EventTarget
 */
export const eventEmitter = () => {
  const emitter = new EventTarget()
  const eventHandler = e => e.detail
  const on = (name, cb) => {
    emitter.addEventListener(name, compose(cb, eventHandler))
  }
  const emit = (name, detail) => {
    const event = new CustomEvent(name, {detail})
    emitter.dispatchEvent(event)
  }
  return Object.freeze({on, emit})
}
