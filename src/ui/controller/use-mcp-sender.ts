import type { App } from '@modelcontextprotocol/ext-apps'

import type { Trigger } from '../../behavioral.ts'
import { type ClientMessage, ClientMessageSchema } from './controller.schemas.ts'

export type UseMcpSenderOptions = {
  app: Pick<App, 'callServerTool'>
  toolName: string
  onError?: (error: unknown, message: ClientMessage) => void
}

export const useMcpSender = ({ app, toolName, onError }: UseMcpSenderOptions): Trigger => {
  return (message) => {
    const outbound = ClientMessageSchema.parse(message)

    try {
      const response = app.callServerTool({ name: toolName, arguments: outbound })
      void Promise.resolve(response).catch((error) => {
        onError?.(error, outbound)
      })
    } catch (error) {
      onError?.(error, outbound)
    }
  }
}
