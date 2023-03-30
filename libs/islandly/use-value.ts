import { Primitive } from './types.ts'

export const publisher = <T extends Primitive>() => {
  const listeners: Array<(value: T) => void> = []
  function createPublisher(value: T) {
    for (const i in listeners) {
      listeners[i](value)
    }
  }
  createPublisher.subscribe = (listener: (msg: T) => void) => {
    listeners.push((value: T) => {
      listener(value)
    })
  }
  return createPublisher
}

export class Messenger<T extends Primitive> {
  #publisher: {
    (value: T): void
    subscribe(listener: (msg: T) => void): void
  }
  constructor(
    pub: {
      (value: T): void
      subscribe(listener: (msg: T) => void): void
    },
  ) {
    this.#publisher = pub
  }
  subscribe(listener: (value: T) => void) {
    this.#publisher.subscribe(listener)
  }
}

interface UseValueGetter<T extends Primitive> {
  (): T
  publisher: Messenger<T>
}

interface UseValueSetter<T extends Primitive> {
  (value: T): void
}

export const useValue = <T extends Primitive>(initialValue: T) => {
  let value = initialValue
  const _publisher = publisher<T>()
  const get = () => value
  const set = (newValue: T) => {
    value = newValue
    _publisher.subscribe(() => newValue)
  }
  get.publisher = new Messenger<T>(_publisher)

  return Object.freeze<[UseValueGetter<T>, UseValueSetter<T>]>([
    get,
    set,
  ])
}
