import type { Trigger, BPEvent } from '@plaited/behavioral'
import { usePublisher } from './use-publisher.js'
import type { PostMessenger } from '@plaited/types'
import { PlaitedElement } from '@plaited/types'
/**
 * Enables communication between agents on the main thread and a dedicated postMessage client
 */
type PostMessageClient = Worker | HTMLIFrameElement | ServiceWorkerContainer

const isWorker = (client: PostMessageClient): client is Worker => client instanceof Worker
const isServiceWorkerContainer = (client: PostMessageClient): client is ServiceWorkerContainer =>
  client instanceof ServiceWorkerContainer

export const usePostMessageClient = (postMessageClient: PostMessageClient): PostMessenger => {
  const pub = usePublisher()
  const handleMessage = ({ data }: { data: BPEvent }) => pub(data)
  const connect = (trigger: Trigger, observedTriggers: string[] | PlaitedElement) => {
    return pub.connect(trigger, observedTriggers)
  }
  const workerClient = (
    /** the url of our worker relative to the public directory*/
    client: Worker,
  ) => {
    const send = (args: BPEvent) => {
      client.postMessage(args)
    }
    client.addEventListener('message', handleMessage, false)
    send.disconnect = () => client.removeEventListener('message', handleMessage)
    send.connect = connect
    send.type = 'post-messenger' as const
    return send
  }
  const serviceWorkerClient = (
    /** the url of our worker relative to the public directory*/
    client: ServiceWorkerContainer,
  ) => {
    const send = (args: BPEvent) => {
      client?.controller?.postMessage(args)
    }

    client.addEventListener('message', handleMessage, false)
    send.disconnect = () => client.removeEventListener('message', handleMessage)
    send.connect = connect
    send.type = 'post-messenger' as const
    return send
  }
  const iframeClient = (client: HTMLIFrameElement) => {
    const send = (args: BPEvent) => {
      client.contentWindow?.postMessage(args)
    }
    client.contentWindow?.addEventListener('message', handleMessage, false)
    send.disconnect = () => client.contentWindow?.removeEventListener('message', handleMessage)
    send.connect = connect
    send.type = 'post-messenger' as const
    return send
  }
  const send =
    isWorker(postMessageClient) ? workerClient(postMessageClient)
    : isServiceWorkerContainer(postMessageClient) ? serviceWorkerClient(postMessageClient)
    : iframeClient(postMessageClient)
  return send
}
