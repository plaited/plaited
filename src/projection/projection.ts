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

    const attr = Object.fromEntries(Object.entries(merged).filter(([, value]) => value !== null))
    if (Object.keys(attr).length === 0) return next
    next.push({
      ...message,
      detail: {
        ...message.detail,
        attr,
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

/** @public */
export const createUiProjectionState = (): UiProjectionState => ({
  topicViewState: {},
})

/** @public */
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

  if (parsedEvent.type === 'ui.controller_message_sent') {
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

  if (parsedEvent.type === 'ui.controller_message_error') {
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

  if (parsedEvent.type === 'ui.page_rendered') {
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

  if (parsedEvent.type === 'ui.page_render_requested') {
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

/** @public */
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
