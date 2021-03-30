import {ueid} from '@plaited/utils'
export const messenger = (bcc = ueid()) => {
  /**
 * @description broadcast a message to connected island
 * @param {string} address @param {Object} message
 */
  const send = (address, message) => {
  // eslint-disable-next-line compat/compat
    const channel = new BroadcastChannel(bcc)
    channel.postMessage([address, message])
    channel.close()
  }

  /**
 * @description connect island to BroadcastChannel
 * @param {string} recipient @param {function} trigger
 * @return {function} closes broadcast channel
 */
  const connect = (recipient, trigger) => {
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
  return Object.freeze({connect, send})
}

