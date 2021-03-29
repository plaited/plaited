const BROADCAST_CHANNEL = 'mediator'
/**
 * @param {string} recipient @param {function} trigger @param {string} [bcc=mediator]
 * @return {Array<function>}
 */

/**
 * @description  To be used in worker threads allows for broadcast to connected actors
 * @param {string} address @param {Object} message @param {string} [bcc=BROADCAST_CHANNEL]
 */
export const broadcast = (address, message, bcc = BROADCAST_CHANNEL) => {
  // eslint-disable-next-line compat/compat
  const mediator = new BroadcastChannel(bcc)
  mediator.postMessage([address, message])
}

/**
 * @description connect actors to BroadcastChannel
 * @param {string} recipient @param {function} trigger @param {string} [bcc=BROADCAST_CHANNEL]
 * @return {function} closes broadcast channel
 */
export const connect = (, trigger, bcc = BROADCAST_CHANNEL) => {
  const callback = evt => {
    const [address, message] = evt.data
    address === recipient && trigger(message)
  }
  // eslint-disable-next-line compat/compat
  const channel = new BroadcastChannel(bcc)
  channel.addEventListener('message', callback)
  return () => {
    channel.removeEventListener('message', callback)
    channel.close()
  }
}

/**
 * @description dispatch an request to a dedicated web worker actor
 * @param {string} worker
 */
export const dispatch = worker =>
/** @param {{address: string, request:string|{ request: string data:*}}} request */
  request => worker.postMessage(request)
