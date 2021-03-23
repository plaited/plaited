const BROADCAST_CHANNEL = 'mediator'
/**
 * @param {string} recipient @param {function} trigger @param {string} [bcc=mediator]
 * @return {Array<function>}
 */

/**
 * @description broadcast a message to connected actors
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
export const connect = (recipient, trigger, bcc = BROADCAST_CHANNEL) => {
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
