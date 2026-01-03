import type { PlaitedTrigger } from '../main.ts'
import { setInspectorCallback } from '../ui/inspector.ts'
import type { Send } from './testing.types.ts'
import { useWebSocket } from './use-web-socket.ts'

export const useMessenger = (trigger: PlaitedTrigger): Send => {
  const send = useWebSocket(trigger)
  setInspectorCallback(send)
  return send
}
