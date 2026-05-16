import { describe, expect, test } from 'bun:test'
import { behavioral, SNAPSHOT_MESSAGE_KINDS } from '../../behavioral.ts'
import { CONTROLLER_TO_AGENT_EVENTS } from '../../shared.ts'
import { createContextMemory } from '../context-memory.ts'
import {
  activateUiCapabilityBindings,
  bindControllerEventContextMemory,
  UiCapabilityBindingSchema,
  validateUiCapabilityEventDetail,
} from '../ui-bindings.ts'

describe('UI capability bindings', () => {
  test('records inbound semantic UI events under explicit topic scopes', () => {
    const runtime = behavioral()
    const memory = createContextMemory({ ttlMs: 10_000 })

    bindControllerEventContextMemory({ runtime, memory })

    runtime.trigger({
      type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
      detail: {
        type: 'generic.kanban.card_moved',
        detail: {
          topic: 'board:a',
          cardId: 'card-1',
          toColumnId: 'done',
        },
      },
    })
    runtime.trigger({
      type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
      detail: {
        type: 'generic.kanban.card_moved',
        detail: {
          topic: 'board:b',
          cardId: 'card-2',
          toColumnId: 'doing',
        },
      },
    })

    expect(
      memory.get({
        listener: { type: 'generic.kanban.card_moved' },
        scope: 'topic:board:a',
      }),
    ).toEqual({
      topic: 'board:a',
      cardId: 'card-1',
      toColumnId: 'done',
    })
    expect(
      memory.get({
        listener: { type: 'generic.kanban.card_moved' },
        scope: 'topic:board:b',
      }),
    ).toEqual({
      topic: 'board:b',
      cardId: 'card-2',
      toColumnId: 'doing',
    })
  })

  test('records inbound form submissions and controller errors under explicit topic scopes', () => {
    const runtime = behavioral()
    const memory = createContextMemory({ ttlMs: 10_000 })

    bindControllerEventContextMemory({ runtime, memory })

    runtime.trigger({
      type: CONTROLLER_TO_AGENT_EVENTS.form_submit,
      detail: {
        topic: 'board:a',
        id: 'card-form',
        action: '/cards',
        method: 'post',
        data: {
          cardId: 'card-1',
        },
      },
    })
    runtime.trigger({
      type: CONTROLLER_TO_AGENT_EVENTS.error,
      detail: {
        topic: 'board:a',
        message: 'Unsupported controller event type "unknown"',
        kind: 'server_message_error',
      },
    })

    expect(
      memory.get({
        listener: { type: CONTROLLER_TO_AGENT_EVENTS.form_submit },
        scope: 'topic:board:a',
      }),
    ).toEqual({
      topic: 'board:a',
      id: 'card-form',
      action: '/cards',
      method: 'post',
      data: {
        cardId: 'card-1',
      },
    })
    expect(
      memory.get({
        listener: { type: CONTROLLER_TO_AGENT_EVENTS.error },
        scope: 'topic:board:a',
      }),
    ).toEqual({
      topic: 'board:a',
      message: 'Unsupported controller event type "unknown"',
      kind: 'server_message_error',
    })
  })

  test('validates semantic event details against capability event schemas', () => {
    const capability = UiCapabilityBindingSchema.parse({
      capabilityId: 'kanban-board',
      events: {
        'generic.kanban.card_moved': {
          detailSchema: {
            type: 'object',
            properties: {
              topic: { type: 'string' },
              cardId: { type: 'string' },
              toColumnId: { type: 'string' },
            },
            required: ['topic', 'cardId', 'toColumnId'],
            additionalProperties: false,
          },
        },
      },
    })

    expect(
      validateUiCapabilityEventDetail({
        capability,
        type: 'generic.kanban.card_moved',
        detail: {
          topic: 'board:a',
          cardId: 'card-1',
          toColumnId: 'done',
        },
      }),
    ).toEqual({
      topic: 'board:a',
      cardId: 'card-1',
      toColumnId: 'done',
    })
    expect(() =>
      validateUiCapabilityEventDetail({
        capability,
        type: 'generic.kanban.card_moved',
        detail: {
          topic: 'board:a',
          cardId: 'card-1',
        },
      }),
    ).toThrow()
  })

  test('maps semantic UI events to generic action requests without event-specific handler registration', () => {
    const runtime = behavioral()
    const registeredHandlers: string[] = []
    const genericRequests: unknown[] = []
    const addHandler: typeof runtime.addHandler = (type, handler, once) => {
      registeredHandlers.push(type)
      return runtime.addHandler(type, handler, once)
    }
    const instrumentedRuntime = {
      ...runtime,
      addHandler,
    }
    instrumentedRuntime.addHandler('ui_state.patch_requested', (detail) => {
      genericRequests.push(detail)
    })
    const capability = UiCapabilityBindingSchema.parse({
      capabilityId: 'kanban-board',
      events: {
        'generic.kanban.card_moved': {
          detailSchema: {
            type: 'object',
            properties: {
              topic: { type: 'string' },
              cardId: { type: 'string' },
              toColumnId: { type: 'string' },
            },
            required: ['topic', 'cardId', 'toColumnId'],
            additionalProperties: false,
          },
        },
      },
      actions: [
        {
          when: 'generic.kanban.card_moved',
          request: 'ui_state.patch_requested',
          mapping: {
            topic: ['detail', 'topic'],
            entity: 'card',
            id: ['detail', 'cardId'],
            patch: {
              columnId: ['detail', 'toColumnId'],
            },
          },
        },
      ],
    })

    activateUiCapabilityBindings({
      runtime: instrumentedRuntime,
      capability,
      availableHandlerSurfaces: new Set(['ui_state.patch_requested']),
    })
    runtime.trigger({
      type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
      detail: {
        type: 'generic.kanban.card_moved',
        detail: {
          topic: 'board:a',
          cardId: 'card-1',
          toColumnId: 'done',
        },
      },
    })

    expect(registeredHandlers).toContain(CONTROLLER_TO_AGENT_EVENTS.ui_event)
    expect(registeredHandlers).not.toContain('generic.kanban.card_moved')
    expect(genericRequests).toEqual([
      {
        topic: 'board:a',
        entity: 'card',
        id: 'card-1',
        patch: {
          columnId: 'done',
        },
      },
    ])
  })

  test('rejects activation when required generic handler surfaces are missing', () => {
    const runtime = behavioral()
    const registeredHandlers: string[] = []
    const addHandler: typeof runtime.addHandler = (type, handler, once) => {
      registeredHandlers.push(type)
      return runtime.addHandler(type, handler, once)
    }
    const instrumentedRuntime = {
      ...runtime,
      addHandler,
    }
    const capability = UiCapabilityBindingSchema.parse({
      capabilityId: 'kanban-board',
      requiredHandlerSurfaces: ['context.record_requested'],
      events: {
        'generic.kanban.card_moved': {
          detailSchema: {
            type: 'object',
            properties: {
              topic: { type: 'string' },
            },
            required: ['topic'],
            additionalProperties: false,
          },
        },
      },
      actions: [
        {
          when: 'generic.kanban.card_moved',
          request: 'ui_state.patch_requested',
          mapping: {
            topic: ['detail', 'topic'],
          },
        },
      ],
    })

    expect(() =>
      activateUiCapabilityBindings({
        runtime: instrumentedRuntime,
        capability,
        availableHandlerSurfaces: new Set(['ui_state.patch_requested']),
      }),
    ).toThrow('context.record_requested')
    expect(registeredHandlers).toEqual([])
  })

  test('reports mapping path failures without emitting generic requests', async () => {
    const runtime = behavioral()
    const genericRequests: unknown[] = []
    const snapshots: unknown[] = []
    runtime.addHandler('ui_state.patch_requested', (detail) => {
      genericRequests.push(detail)
    })
    runtime.useSnapshot((snapshot) => {
      snapshots.push(snapshot)
    })
    const capability = UiCapabilityBindingSchema.parse({
      capabilityId: 'kanban-board',
      events: {
        'generic.kanban.card_moved': {
          detailSchema: {
            type: 'object',
            properties: {
              topic: { type: 'string' },
              cardId: { type: 'string' },
            },
            required: ['topic', 'cardId'],
            additionalProperties: false,
          },
        },
      },
      actions: [
        {
          when: 'generic.kanban.card_moved',
          request: 'ui_state.patch_requested',
          mapping: {
            topic: ['detail', 'topic'],
            missing: ['detail', 'toColumnId'],
          },
        },
      ],
    })

    activateUiCapabilityBindings({
      runtime,
      capability,
      availableHandlerSurfaces: new Set(['ui_state.patch_requested']),
    })
    runtime.trigger({
      type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
      detail: {
        type: 'generic.kanban.card_moved',
        detail: {
          topic: 'board:a',
          cardId: 'card-1',
        },
      },
    })
    await Bun.sleep(0)

    expect(genericRequests).toEqual([])
    expect(snapshots).toContainEqual(
      expect.objectContaining({
        kind: SNAPSHOT_MESSAGE_KINDS.feedback_error,
        type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
        error: expect.stringContaining('detail.toColumnId'),
      }),
    )
  })

  test('ignores controller ui events outside the activated capability', async () => {
    const runtime = behavioral()
    const snapshots: unknown[] = []
    runtime.useSnapshot((snapshot) => {
      snapshots.push(snapshot)
    })
    const capability = UiCapabilityBindingSchema.parse({
      capabilityId: 'kanban-board',
      events: {
        'generic.kanban.card_moved': {
          detailSchema: {
            type: 'object',
            properties: {
              topic: { type: 'string' },
            },
            required: ['topic'],
            additionalProperties: false,
          },
        },
      },
    })

    activateUiCapabilityBindings({
      runtime,
      capability,
      availableHandlerSurfaces: new Set(),
    })
    runtime.trigger({
      type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
      detail: {
        type: 'controller.connected',
        detail: {
          topic: 'board:a',
        },
      },
    })
    await Bun.sleep(0)

    expect(snapshots).not.toContainEqual(
      expect.objectContaining({
        kind: SNAPSHOT_MESSAGE_KINDS.feedback_error,
        type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
      }),
    )
  })

  test('re-emits declared semantic events so generated specs can request generic actions', async () => {
    const runtime = behavioral()
    const genericRequests: unknown[] = []
    runtime.addHandler('ui_state.patch_requested', (detail) => {
      genericRequests.push(detail)
    })
    const capability = UiCapabilityBindingSchema.parse({
      capabilityId: 'kanban-board',
      events: {
        'generic.kanban.card_moved': {
          detailSchema: {
            type: 'object',
            properties: {
              topic: { type: 'string' },
              cardId: { type: 'string' },
            },
            required: ['topic', 'cardId'],
            additionalProperties: false,
          },
        },
      },
      specs: [
        {
          label: 'kanban-card-moved-spec',
          thread: {
            once: true,
            syncPoints: [
              {
                waitFor: [
                  {
                    type: 'generic.kanban.card_moved',
                  },
                ],
              },
              {
                request: {
                  type: 'ui_state.patch_requested',
                  detail: {
                    source: 'generated-spec',
                  },
                },
              },
            ],
          },
        },
      ],
      requiredHandlerSurfaces: ['ui_state.patch_requested'],
    })

    activateUiCapabilityBindings({
      runtime,
      capability,
      availableHandlerSurfaces: new Set(['ui_state.patch_requested']),
    })
    runtime.trigger({
      type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
      detail: {
        type: 'generic.kanban.card_moved',
        detail: {
          topic: 'board:a',
          cardId: 'card-1',
        },
      },
    })
    await Bun.sleep(0)

    expect(genericRequests).toEqual([
      {
        source: 'generated-spec',
      },
    ])
  })

  test('re-emits a shared semantic event once while running each capability action mapping', async () => {
    const runtime = behavioral()
    const semanticEvents: unknown[] = []
    const genericRequests: unknown[] = []
    runtime.addHandler('generic.shared.selected', (detail) => {
      semanticEvents.push(detail)
    })
    runtime.addHandler('ui_state.patch_requested', (detail) => {
      genericRequests.push(detail)
    })
    const createCapability = (capabilityId: string) =>
      UiCapabilityBindingSchema.parse({
        capabilityId,
        events: {
          'generic.shared.selected': {
            detailSchema: {
              type: 'object',
              properties: {
                topic: { type: 'string' },
              },
              required: ['topic'],
              additionalProperties: false,
            },
          },
        },
        actions: [
          {
            when: 'generic.shared.selected',
            request: 'ui_state.patch_requested',
            mapping: {
              topic: ['detail', 'topic'],
              capabilityId,
            },
          },
        ],
      })

    activateUiCapabilityBindings({
      runtime,
      capability: createCapability('alpha'),
      availableHandlerSurfaces: new Set(['ui_state.patch_requested']),
    })
    activateUiCapabilityBindings({
      runtime,
      capability: createCapability('beta'),
      availableHandlerSurfaces: new Set(['ui_state.patch_requested']),
    })
    runtime.trigger({
      type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
      detail: {
        type: 'generic.shared.selected',
        detail: {
          topic: 'board:a',
        },
      },
    })
    await Bun.sleep(0)

    expect(semanticEvents).toEqual([{ topic: 'board:a' }])
    expect(genericRequests).toEqual([
      {
        topic: 'board:a',
        capabilityId: 'alpha',
      },
      {
        topic: 'board:a',
        capabilityId: 'beta',
      },
    ])
  })

  test('scopes semantic event dedupe to each behavioral runtime', async () => {
    const firstRuntime = behavioral()
    const secondRuntime = behavioral()
    const firstEvents: unknown[] = []
    const secondEvents: unknown[] = []
    firstRuntime.addHandler('generic.shared.selected', (detail) => {
      firstEvents.push(detail)
    })
    secondRuntime.addHandler('generic.shared.selected', (detail) => {
      secondEvents.push(detail)
    })
    const capability = UiCapabilityBindingSchema.parse({
      capabilityId: 'shared-selection',
      events: {
        'generic.shared.selected': {
          detailSchema: {
            type: 'object',
            properties: {
              topic: { type: 'string' },
            },
            required: ['topic'],
            additionalProperties: false,
          },
        },
      },
    })
    const envelope = {
      type: 'generic.shared.selected',
      detail: {
        topic: 'board:a',
      },
    }

    activateUiCapabilityBindings({
      runtime: firstRuntime,
      capability,
      availableHandlerSurfaces: new Set(),
    })
    activateUiCapabilityBindings({
      runtime: secondRuntime,
      capability,
      availableHandlerSurfaces: new Set(),
    })
    firstRuntime.trigger({
      type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
      detail: envelope,
    })
    secondRuntime.trigger({
      type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
      detail: envelope,
    })
    await Bun.sleep(0)

    expect(firstEvents).toEqual([{ topic: 'board:a' }])
    expect(secondEvents).toEqual([{ topic: 'board:a' }])
  })

  test('does not dedupe separate controller event dispatches that reuse the same envelope object', async () => {
    const runtime = behavioral()
    const semanticEvents: unknown[] = []
    runtime.addHandler('generic.shared.selected', (detail) => {
      semanticEvents.push(detail)
    })
    const capability = UiCapabilityBindingSchema.parse({
      capabilityId: 'shared-selection',
      events: {
        'generic.shared.selected': {
          detailSchema: {
            type: 'object',
            properties: {
              topic: { type: 'string' },
            },
            required: ['topic'],
            additionalProperties: false,
          },
        },
      },
    })
    const envelope = {
      type: 'generic.shared.selected',
      detail: {
        topic: 'board:a',
      },
    }

    activateUiCapabilityBindings({
      runtime,
      capability,
      availableHandlerSurfaces: new Set(),
    })
    runtime.trigger({
      type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
      detail: envelope,
    })
    runtime.trigger({
      type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
      detail: envelope,
    })
    await Bun.sleep(0)

    expect(semanticEvents).toEqual([{ topic: 'board:a' }, { topic: 'board:a' }])
  })

  test('continues dispatching later capabilities when one capability mapping fails', async () => {
    const runtime = behavioral()
    const genericRequests: unknown[] = []
    const snapshots: unknown[] = []
    runtime.addHandler('ui_state.patch_requested', (detail) => {
      genericRequests.push(detail)
    })
    runtime.useSnapshot((snapshot) => {
      snapshots.push(snapshot)
    })
    const createCapability = ({ capabilityId, mapping }: { capabilityId: string; mapping: Record<string, unknown> }) =>
      UiCapabilityBindingSchema.parse({
        capabilityId,
        events: {
          'generic.shared.selected': {
            detailSchema: {
              type: 'object',
              properties: {
                topic: { type: 'string' },
              },
              required: ['topic'],
              additionalProperties: false,
            },
          },
        },
        actions: [
          {
            when: 'generic.shared.selected',
            request: 'ui_state.patch_requested',
            mapping,
          },
        ],
      })

    activateUiCapabilityBindings({
      runtime,
      capability: createCapability({
        capabilityId: 'bad-capability',
        mapping: {
          missing: ['detail', 'missing'],
        },
      }),
      availableHandlerSurfaces: new Set(['ui_state.patch_requested']),
    })
    activateUiCapabilityBindings({
      runtime,
      capability: createCapability({
        capabilityId: 'valid-capability',
        mapping: {
          topic: ['detail', 'topic'],
          capabilityId: 'valid-capability',
        },
      }),
      availableHandlerSurfaces: new Set(['ui_state.patch_requested']),
    })
    runtime.trigger({
      type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
      detail: {
        type: 'generic.shared.selected',
        detail: {
          topic: 'board:a',
        },
      },
    })
    await Bun.sleep(0)

    expect(genericRequests).toEqual([
      {
        topic: 'board:a',
        capabilityId: 'valid-capability',
      },
    ])
    expect(snapshots).toContainEqual(
      expect.objectContaining({
        kind: SNAPSHOT_MESSAGE_KINDS.feedback_error,
        type: CONTROLLER_TO_AGENT_EVENTS.ui_event,
        error: expect.stringContaining('detail.missing'),
      }),
    )
  })
})
