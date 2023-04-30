export type Publisher<T> = () => {
  (value: T): void;
  subscribe(listener: (msg: T) => void): () => boolean;
};
export const publisher = <T>() => {
  const listeners = new Set<(value: T) => void>()
  function createPublisher(value: T) {
    for (const cb of listeners) {
      cb(value)
    }
  }
  createPublisher.subscribe = (listener: (msg: T) => void) => {
    listeners.add(listener)
    return () => listeners.delete(listener)
  }
  return createPublisher
}
