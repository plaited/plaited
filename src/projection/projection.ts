import { UI_PROJECTION_EVENTS } from './projection.constants.ts'
import {
  type TopicViewState,
  type UiProjectionControllerMessage,
  type UiProjectionEvent,
  UiProjectionEventSchema,
  type UiProjectionState,
  UiProjectionStateSchema,
} from './projection.schemas.ts'

const upsertControllerMessage = ({
  messages,
  message,
}: {
  messages: UiProjectionControllerMessage[]
  message: UiProjectionControllerMessage
}): UiProjectionControllerMessage[] => {
  if (message.type === 'attrs') {
    const next: UiProjectionControllerMessage[] = []
    let merged = message.detail.attr

    for (const item of messages) {
      if (item.type !== 'attrs' || item.detail.target !== message.detail.target) {
        next.push(item)
        continue
      }

      merged = {
        ...item.detail.attr,
        ...merged,
      }
    }

    if (Object.keys(merged).length === 0) return next
    next.push({
      ...message,
      detail: {
        ...message.detail,
        attr: merged,
      },
    })
    return next
  }

  const next = messages.filter((item) => {
    return item.type !== message.type || item.detail.target !== message.detail.target
  })
  next.push(message)
  return next
}

const getTopicViewState = ({ state, topic }: { state: UiProjectionState; topic: string }): TopicViewState => {
  return (
    state.topicViewState[topic] ?? {
      topic,
      version: 0,
      intended: {
        controllerMessages: [],
      },
    }
  )
}

const withRequestMetadata = ({
  current,
  version,
  inputs,
}: {
  current: TopicViewState
  version: number
  inputs?: UiProjectionEvent['detail']['inputs']
}): TopicViewState => {
  const { inputs: _inputs, ...currentWithoutInputs } = current
  return {
    ...currentWithoutInputs,
    version,
    ...(inputs && { inputs }),
  }
}

/**
 * Creates an empty UI projection journal state.
 *
 * @public
 */
export const createUiProjectionState = (): UiProjectionState => ({
  topicViewState: {},
})

/**
 * Replays a projection event into immutable UI projection state.
 *
 * @remarks
 * The reducer validates both state and event through the public schemas. Desired
 * render, attrs, and page-render requests are version-gated so stale requests do
 * not replace newer topic state, while delivery and rendered-page events update
 * the latest diagnostic or page snapshot for their topic.
 *
 * @public
 */
export const applyUiProjectionEvent = ({
  state,
  event,
}: {
  state: UiProjectionState
  event: UiProjectionEvent
}): UiProjectionState => {
  const parsedState = UiProjectionStateSchema.parse(state)
  const parsedEvent = UiProjectionEventSchema.parse(event)
  const current = getTopicViewState({
    state: parsedState,
    topic: parsedEvent.detail.topic,
  })

  if (parsedEvent.type === UI_PROJECTION_EVENTS.ui_controller_message_sent) {
    return {
      topicViewState: {
        ...parsedState.topicViewState,
        [parsedEvent.detail.topic]: {
          ...current,
          lastSent: {
            version: parsedEvent.detail.version,
            controllerMessage: parsedEvent.detail.controllerMessage,
          },
        },
      },
    }
  }

  if (parsedEvent.type === UI_PROJECTION_EVENTS.ui_controller_message_error) {
    return {
      topicViewState: {
        ...parsedState.topicViewState,
        [parsedEvent.detail.topic]: {
          ...current,
          lastError: {
            version: parsedEvent.detail.version,
            controllerMessage: parsedEvent.detail.controllerMessage,
            error: parsedEvent.detail.error,
          },
        },
      },
    }
  }

  if (parsedEvent.type === UI_PROJECTION_EVENTS.ui_page_rendered) {
    return {
      topicViewState: {
        ...parsedState.topicViewState,
        [parsedEvent.detail.topic]: {
          ...current,
          page: {
            version: parsedEvent.detail.version,
            html: parsedEvent.detail.html,
          },
        },
      },
    }
  }

  if (parsedEvent.type === UI_PROJECTION_EVENTS.ui_page_render_requested) {
    if (parsedEvent.detail.version < current.version) return parsedState
    return {
      topicViewState: {
        ...parsedState.topicViewState,
        [parsedEvent.detail.topic]: withRequestMetadata({
          current,
          version: parsedEvent.detail.version,
          inputs: parsedEvent.detail.inputs,
        }),
      },
    }
  }

  if (parsedEvent.detail.version < current.version) return parsedState

  return {
    topicViewState: {
      ...parsedState.topicViewState,
      [parsedEvent.detail.topic]: {
        ...withRequestMetadata({
          current,
          version: parsedEvent.detail.version,
          inputs: parsedEvent.detail.inputs,
        }),
        intended: {
          controllerMessages: upsertControllerMessage({
            messages: current.intended.controllerMessages,
            message: parsedEvent.detail.controllerMessage,
          }),
        },
      },
    },
  }
}

/**
 * Returns the controller messages that should be replayed for a reconnecting topic.
 *
 * @remarks
 * The returned messages are derived from the intended controller state, not from
 * the last sent or last error diagnostics, and are copied so callers cannot
 * mutate the stored projection state.
 *
 * @public
 */
export const getReconnectControllerMessages = ({
  state,
  topic,
}: {
  state: UiProjectionState
  topic: string
}): UiProjectionControllerMessage[] => {
  const parsedState = UiProjectionStateSchema.parse(state)
  return [...(parsedState.topicViewState[topic]?.intended.controllerMessages ?? [])]
}
