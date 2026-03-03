import * as z from 'zod'

/**
 * Schema for contextual data attached to each WebSocket connection.
 *
 * @remarks
 * Set during `server.upgrade()` and available as `ws.data` in all
 * WebSocket lifecycle handlers. The `sessionId` comes from the `sid`
 * cookie validated before upgrade. The `source` comes from the
 * `Sec-WebSocket-Protocol` header (client identity: `'document'` or tag name).
 *
 * @public
 */
export const WebSocketDataSchema = z.object({
  sessionId: z.string(),
  source: z.string(),
})

/** @public */
export type WebSocketData = z.infer<typeof WebSocketDataSchema>
