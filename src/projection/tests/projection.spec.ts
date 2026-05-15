import { describe, expect, test } from 'bun:test'

import { AGENT_TO_CONTROLLER_EVENTS } from '../../shared/shared.constants.ts'
import {
  type UiControllerMessageErrorEvent,
  UiControllerMessageErrorEventSchema,
  type UiControllerMessageSentEvent,
  UiControllerMessageSentEventSchema,
  type UiPageRenderedEvent,
  UiPageRenderedEventSchema,
  type UiPageRenderRequestedEvent,
  UiPageRenderRequestedEventSchema,
  type UiProjectionEvent,
} from '../projection.schemas.ts'
import { applyUiProjectionEvent, createUiProjectionState, getReconnectControllerMessages } from '../projection.ts'

describe('UI projection journal', () => {
  test('render request updates intended topic view state', () => {
    const state = createUiProjectionState()
    const controllerMessage = {
      type: AGENT_TO_CONTROLLER_EVENTS.render,
      detail: {
        target: 'main',
        html: '<section>Hello</section>',
        stylesheets: ['section{display:block;}'],
        registry: [],
      },
    }

    const next = applyUiProjectionEvent({
      state,
      event: {
        type: 'ui.render_requested',
        detail: {
          topic: 'workspace',
          version: 1,
          inputs: {
            refs: ['template:workspace'],
            hashes: ['sha256:render-input'],
          },
          controllerMessage,
        },
      },
    })

    expect(next.topicViewState.workspace).toEqual({
      topic: 'workspace',
      version: 1,
      intended: {
        controllerMessages: [controllerMessage],
      },
      inputs: {
        refs: ['template:workspace'],
        hashes: ['sha256:render-input'],
      },
    })
    expect(state.topicViewState.workspace).toBeUndefined()
  })

  test('attrs request updates intended topic view state', () => {
    const state = createUiProjectionState()
    const controllerMessage = {
      type: AGENT_TO_CONTROLLER_EVENTS.attrs,
      detail: {
        target: 'main',
        attr: {
          hidden: true,
          'aria-busy': 'true',
        },
      },
    }

    const next = applyUiProjectionEvent({
      state,
      event: {
        type: 'ui.attrs_requested',
        detail: {
          topic: 'workspace',
          version: 1,
          controllerMessage,
        },
      },
    })

    expect(next.topicViewState.workspace).toEqual({
      topic: 'workspace',
      version: 1,
      intended: {
        controllerMessages: [controllerMessage],
      },
    })
  })

  test('attrs requests merge current intended attrs for reconnect', () => {
    const events: UiProjectionEvent[] = [
      {
        type: 'ui.attrs_requested',
        detail: {
          topic: 'workspace',
          version: 1,
          controllerMessage: {
            type: AGENT_TO_CONTROLLER_EVENTS.attrs,
            detail: {
              target: 'main',
              attr: {
                hidden: true,
                'data-stale': 'yes',
              },
            },
          },
        },
      },
      {
        type: 'ui.attrs_requested',
        detail: {
          topic: 'workspace',
          version: 2,
          controllerMessage: {
            type: AGENT_TO_CONTROLLER_EVENTS.attrs,
            detail: {
              target: 'main',
              attr: {
                'aria-busy': 'true',
                'data-stale': null,
              },
            },
          },
        },
      },
    ]
    const state = events.reduce(
      (current, event) => applyUiProjectionEvent({ state: current, event }),
      createUiProjectionState(),
    )

    expect(getReconnectControllerMessages({ state, topic: 'workspace' })).toEqual([
      {
        type: AGENT_TO_CONTROLLER_EVENTS.attrs,
        detail: {
          target: 'main',
          attr: {
            hidden: true,
            'aria-busy': 'true',
          },
        },
      },
    ])
  })

  test('sent controller message is journalable with exact controller payload', () => {
    const controllerMessage = {
      type: AGENT_TO_CONTROLLER_EVENTS.render,
      detail: {
        target: 'main',
        html: '<button p-trigger="click:save">Save</button>',
        stylesheets: [],
        registry: ['save-button' as const],
      },
    }
    const event: UiControllerMessageSentEvent = {
      type: 'ui.controller_message_sent',
      detail: {
        topic: 'workspace',
        version: 2,
        inputs: {
          refs: ['template:workspace'],
        },
        controllerMessage,
      },
    }

    expect(UiControllerMessageSentEventSchema.parse(event)).toEqual(event)
  })

  test('controller message error keeps failed controller payload', () => {
    const controllerMessage = {
      type: AGENT_TO_CONTROLLER_EVENTS.attrs,
      detail: {
        target: 'main',
        attr: {
          inert: true,
        },
      },
    }
    const event: UiControllerMessageErrorEvent = {
      type: 'ui.controller_message_error',
      detail: {
        topic: 'workspace',
        version: 3,
        controllerMessage,
        error: 'WebSocket closed before send',
      },
    }

    expect(UiControllerMessageErrorEventSchema.parse(event)).toEqual(event)
  })

  test('stale delivery events do not regress current intended topic version', () => {
    const renderMessage = {
      type: AGENT_TO_CONTROLLER_EVENTS.render,
      detail: {
        target: 'main',
        html: '<section>Latest</section>',
        stylesheets: [],
        registry: [],
      },
    }
    const state = applyUiProjectionEvent({
      state: applyUiProjectionEvent({
        state: createUiProjectionState(),
        event: {
          type: 'ui.render_requested',
          detail: {
            topic: 'workspace',
            version: 2,
            inputs: {
              hashes: ['sha256:v2'],
            },
            controllerMessage: renderMessage,
          },
        },
      }),
      event: {
        type: 'ui.controller_message_sent',
        detail: {
          topic: 'workspace',
          version: 1,
          inputs: {
            hashes: ['sha256:v1'],
          },
          controllerMessage: renderMessage,
        },
      },
    })

    expect(state.topicViewState.workspace?.version).toBe(2)
    expect(state.topicViewState.workspace?.inputs).toEqual({
      hashes: ['sha256:v2'],
    })
    expect(state.topicViewState.workspace?.lastSent).toEqual({
      version: 1,
      controllerMessage: renderMessage,
    })
  })

  test('page render event carries full HTML', () => {
    const event: UiPageRenderedEvent = {
      type: 'ui.page_rendered',
      detail: {
        topic: 'workspace',
        version: 3,
        inputs: {
          hashes: ['sha256:page-input'],
        },
        html: '<!doctype html><html><body><main>Workspace</main></body></html>',
      },
    }

    expect(UiPageRenderedEventSchema.parse(event)).toEqual(event)
  })

  test('page render request is journalable with projection inputs', () => {
    const event: UiPageRenderRequestedEvent = {
      type: 'ui.page_render_requested',
      detail: {
        topic: 'workspace',
        version: 2,
        inputs: {
          refs: ['route:/workspace'],
          hashes: ['sha256:route-input'],
        },
      },
    }

    expect(UiPageRenderRequestedEventSchema.parse(event)).toEqual(event)
  })

  test('reconnect logic uses materialized topic view state instead of full UI history', () => {
    const firstRender = {
      type: AGENT_TO_CONTROLLER_EVENTS.render,
      detail: {
        target: 'main',
        html: '<section>First</section>',
        stylesheets: [],
        registry: [],
      },
    }
    const latestRender = {
      type: AGENT_TO_CONTROLLER_EVENTS.render,
      detail: {
        target: 'main',
        html: '<section>Latest</section>',
        stylesheets: [],
        registry: [],
      },
    }
    const events: UiProjectionEvent[] = [
      {
        type: 'ui.render_requested',
        detail: {
          topic: 'workspace',
          version: 1,
          controllerMessage: firstRender,
        },
      },
      {
        type: 'ui.render_requested',
        detail: {
          topic: 'workspace',
          version: 2,
          controllerMessage: latestRender,
        },
      },
    ]
    const state = events.reduce(
      (current, event) => applyUiProjectionEvent({ state: current, event }),
      createUiProjectionState(),
    )

    expect(getReconnectControllerMessages({ state, topic: 'workspace' })).toEqual([latestRender])
    expect(getReconnectControllerMessages({ state, topic: 'missing' })).toEqual([])
  })
})
