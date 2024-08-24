import type { Disconnect } from '../shared/types.js'
import type { PlaitedElement } from './types.js'
import type { Trigger } from '../behavioral/types.js'
import { Publisher } from './use-publisher.js'
import { SendToSocket, useSocket } from './use-socket.js'
import { PostToWorker, useWorker } from './use-worker.js'
import { WORKER, SOCKET, P_WORKER } from './constants.js'

export type Connect = ReturnType<typeof useConnect>

export const useConnect = ({
  host,
  disconnectSet,
  trigger,
  setUpdateWorker,
}: {
  host: PlaitedElement
  disconnectSet: Set<Disconnect>
  trigger: Trigger
  setUpdateWorker: (updateWorker: (newValue: string | null) => void) => void
}) => {
  function connect(target: typeof WORKER): PostToWorker
  function connect(target: typeof SOCKET): SendToSocket
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function connect(target: Publisher<any>, type: string): Disconnect
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function connect(target: typeof WORKER | typeof SOCKET | Publisher<any>, type?: string) {
    if (target === WORKER) {
      const path = host.getAttribute(P_WORKER)
      const [send, updateWorker] = useWorker(host)
      setUpdateWorker(updateWorker)
      updateWorker(path)
      disconnectSet.add(send.disconnect)
      return send
    }
    if (target === SOCKET) {
      const send = useSocket(host)
      disconnectSet.add(send.disconnect)
      return send
    }
    if (!type) return console.error('BPEvent type is required when connecting to a publisher')
    const disconnect = target.sub(type, trigger)
    disconnectSet.add(disconnect)
    return disconnect
  }
  return connect
}
