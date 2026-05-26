import { behavioral, sync, thread } from '../behavioral.ts'
import { AGENT_TO_CONTROLLER_EVENTS, CONTROLLER_TO_AGENT_EVENTS } from '../shared/shared.constants.ts'
import type { AttrsMessage, DisconnectMessage, ImportModuleMessage, RenderMessage } from '../shared/shared.schemas.ts'
import {
  AttrsMessageSchema,
  ClientMessageSchema,
  ControllerErrorMessageSchema,
  DisconnectMessageSchema,
  FormSubmitMessageSchema,
  ImportModuleMessageSchema,
  RenderMessageSchema,
  UiEventMessageSchema,
} from '../shared/shared.schemas.ts'
import { isTypeOf } from '../utils.ts'
import { AGENT_EVENTS } from './agent.constants.ts'
import { WORKER_COMMAND_TYPES, WORKER_MESSAGE_TYPES } from './worker.constants.ts'
import type { ExecCommand, ReadCommand, WriteCommand } from './worker.schemas.ts'
import {
  ExecCommandSchema,
  ExecMessageSchema,
  ReadCommandSchema,
  ReadMessageSchema,
  RuntimeErrorMessageSchema,
  WriteCommandSchema,
  WriteMessageSchema,
} from './worker.schemas.ts'

const { addHandler, trigger, addThread } = behavioral()

// Default worker threads
addThread(
  'prevent worker start before close after intial worker start',
  thread([
    sync({
      waitFor: { type: AGENT_EVENTS.worker_start },
    }),
    sync({
      waitFor: { type: AGENT_EVENTS.worker_close },
      block: { type: AGENT_EVENTS.start },
    }),
  ]),
)

addThread(
  'prevent sending worker messages before worker open and after close',
  thread([
    sync({
      waitFor: { type: AGENT_EVENTS.worker_open },
      block: [
        { type: WORKER_COMMAND_TYPES.exec },
        { type: WORKER_COMMAND_TYPES.read },
        { type: WORKER_COMMAND_TYPES.write },
      ],
    }),
    sync({
      waitFor: { type: AGENT_EVENTS.worker_close },
    }),
  ]),
)

addThread(
  'prevent improperly formatted events',
  thread([
    sync({
      block: [
        { type: WORKER_COMMAND_TYPES.exec, detailMatch: 'invalid', detailSchema: ExecCommandSchema.shape.detail },
        { type: WORKER_COMMAND_TYPES.read, detailMatch: 'invalid', detailSchema: ReadCommandSchema.shape.detail },
        { type: WORKER_COMMAND_TYPES.write, detailMatch: 'invalid', detailSchema: WriteCommandSchema.shape.detail },
        {
          type: WORKER_MESSAGE_TYPES.exec_result,
          detailMatch: 'invalid',
          detailSchema: ExecMessageSchema.shape.detail,
        },
        {
          type: WORKER_MESSAGE_TYPES.read_result,
          detailMatch: 'invalid',
          detailSchema: ReadMessageSchema.shape.detail,
        },
        {
          type: WORKER_MESSAGE_TYPES.runtime_error,
          detailMatch: 'invalid',
          detailSchema: RuntimeErrorMessageSchema.shape.detail,
        },
        {
          type: WORKER_MESSAGE_TYPES.write_result,
          detailMatch: 'invalid',
          detailSchema: WriteMessageSchema.shape.detail,
        },
        {
          type: AGENT_TO_CONTROLLER_EVENTS.attrs,
          detailMatch: 'invalid',
          detailSchema: AttrsMessageSchema.shape.detail,
        },
        {
          type: AGENT_TO_CONTROLLER_EVENTS.disconnect,
          detailMatch: 'invalid',
          detailSchema: DisconnectMessageSchema.shape.detail,
        },
        {
          type: AGENT_TO_CONTROLLER_EVENTS.import,
          detailMatch: 'invalid',
          detailSchema: ImportModuleMessageSchema.shape.detail,
        },
        {
          type: AGENT_TO_CONTROLLER_EVENTS.render,
          detailMatch: 'invalid',
          detailSchema: RenderMessageSchema.shape.detail,
        },
        {
          type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
          detailMatch: 'invalid',
          detailSchema: UiEventMessageSchema.shape.detail,
        },
        {
          type: CONTROLLER_TO_AGENT_EVENTS.form_submit,
          detailMatch: 'invalid',
          detailSchema: FormSubmitMessageSchema.shape.detail,
        },
        {
          type: CONTROLLER_TO_AGENT_EVENTS.error,
          detailMatch: 'invalid',
          detailSchema: ControllerErrorMessageSchema.shape.detail,
        },
      ],
    }),
  ]),
)

let worker: Worker

const onWorkerOpen = () => trigger({ type: AGENT_EVENTS.worker_open })
const onWorkerClose = () => trigger({ type: AGENT_EVENTS.worker_close })

addHandler(AGENT_EVENTS.worker_start, () => {
  worker?.addEventListener('open', onWorkerOpen)
  worker?.addEventListener('close', onWorkerClose)
  worker = new Worker(new URL('worker.ts', import.meta.url).href)
  worker.addEventListener('open', onWorkerOpen)
  worker.addEventListener('close', onWorkerClose)
})

addHandler(AGENT_EVENTS.worker_terminate, () => {
  worker?.terminate()
})

// Outgoing Worker Message
addHandler<ExecCommand>(WORKER_COMMAND_TYPES.exec, (detail) => worker.postMessage(detail))
addHandler<ReadCommand>(WORKER_COMMAND_TYPES.read, (detail) => worker.postMessage(detail))
addHandler<WriteCommand>(WORKER_COMMAND_TYPES.write, (detail) => worker.postMessage(detail))

type WebSocketData = {
  topic: string
}

const server = Bun.serve<WebSocketData>({
  fetch(req, server) {
    const topic = req.headers.get('Sec-WebSocket-Protocol')
    if (!isTypeOf<string>(topic, 'string')) {
      // TODO Implement reportSnapshot and error possibly runtime_error
      return new Response('WebSocket upgrade rejected: no topic (Sec-WebSocket-Protocol)', { status: 400 })
    }
    const upgraded = server.upgrade(req, {
      data: {
        topic,
      },
    })
    if (upgraded) return
    return new Response('Upgrade failed', { status: 500 })
  },
  websocket: {
    open(ws) {
      ws.subscribe(ws.data.topic)
    },
    message(_, message) {
      if (isTypeOf<string>(message, 'string')) {
        try {
          const event = ClientMessageSchema.parse(JSON.parse(message))
          trigger(event)
        } catch (_err) {
          // TODO Implement reportSnapshot and error possibly runtime_error
        }
      }
    },
    close(_ws) {},
  },
})

// Incoming UI Message
addHandler(CONTROLLER_TO_AGENT_EVENTS.controller_connected, () => {})
addHandler(CONTROLLER_TO_AGENT_EVENTS.error, () => {})
addHandler(CONTROLLER_TO_AGENT_EVENTS.form_submit, () => {})
addHandler(CONTROLLER_TO_AGENT_EVENTS.import_invoked, () => {})
addHandler(CONTROLLER_TO_AGENT_EVENTS.ui_event, () => {})

// Outgoing UI Messages
addHandler<AttrsMessage['detail']>(AGENT_TO_CONTROLLER_EVENTS.attrs, (detail) => {
  server.publish(detail.topic, JSON.stringify(detail))
})
addHandler<DisconnectMessage['detail']>(AGENT_TO_CONTROLLER_EVENTS.disconnect, (detail) => {
  server.publish(detail.topic, JSON.stringify(detail))
})
addHandler<ImportModuleMessage['detail']>(AGENT_TO_CONTROLLER_EVENTS.import, (detail) => {
  server.publish(detail.topic, JSON.stringify(detail))
})
addHandler<RenderMessage['detail']>(AGENT_TO_CONTROLLER_EVENTS.render, (detail) => {
  server.publish(detail.topic, JSON.stringify(detail))
})
