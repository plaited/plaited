import { describe, expect, test } from 'bun:test'

import { A2A_METHODS, WEB_A2A_EXTENSION_URI } from '../../shared/shared.constants.ts'
import { expose, usePostMessage } from '../use-post-message.ts'
import { createFakeWindowPair } from './helpers/fake-window.ts'

const consumerCard = (origin: string) => ({
  name: 'consumer-agent',
  version: '1.0.0',
  url: origin,
  capabilities: {
    extensions: [{ uri: WEB_A2A_EXTENSION_URI, description: 'web-a2a', required: true }],
  },
})

const providerCard = (origin: string) => ({
  name: 'provider-agent',
  version: '1.0.0',
  url: origin,
  capabilities: {
    extensions: [{ uri: WEB_A2A_EXTENSION_URI, description: 'web-a2a', required: true }],
  },
})

describe('usePostMessage handshake', () => {
  test('consumer sends GetExtendedAgentCard carrying a MessagePort; provider receives it with origin + port', async () => {
    const { consumer, provider } = createFakeWindowPair({
      consumerOrigin: 'https://consumer.example',
      providerOrigin: 'https://provider.example',
    })

    let handshakeSeen: { origin?: string; portCount?: number; method?: string } = {}
    expose({
      window: provider,
      agentCard: providerCard('https://provider.example'),
      allowedOrigins: ['*'],
      handlers: {},
      onHandshake: (ev) => {
        handshakeSeen = {
          origin: ev.origin,
          portCount: ev.ports.length,
          method: (ev.data as { method?: string }).method,
        }
      },
    })

    await usePostMessage({
      window: consumer,
      targetOrigin: 'https://provider.example',
      agentCard: consumerCard('https://consumer.example'),
    })

    expect(handshakeSeen.method).toBe(A2A_METHODS.GetExtendedAgentCard)
    expect(handshakeSeen.origin).toBe('https://consumer.example')
    expect(handshakeSeen.portCount).toBe(1)
  })

  test('handshake resolves with the provider extended card and migrates RPC to the private port', async () => {
    const { consumer, provider } = createFakeWindowPair({
      consumerOrigin: 'https://consumer.example',
      providerOrigin: 'https://provider.example',
    })

    let providerReceivedPort: MessagePort | undefined
    expose({
      window: provider,
      agentCard: providerCard('https://provider.example'),
      allowedOrigins: ['*'],
      handlers: {
        SendMessage: async (params) => ({ echoed: params }),
      },
      onHandshake: (ev) => {
        providerReceivedPort = ev.ports[0]
      },
    })

    const { extendedCard, remote } = await usePostMessage({
      window: consumer,
      targetOrigin: 'https://provider.example',
      agentCard: consumerCard('https://consumer.example'),
    })

    expect(extendedCard.name).toBe('provider-agent')
    // RPC over the migrated private port (no further window.postMessage)
    const result = await remote(A2A_METHODS.SendMessage, { msg: 'hi' })
    expect(result).toEqual({ echoed: { msg: 'hi' } })
    // provider keeps using the same private port for all RPC
    expect(providerReceivedPort).toBeInstanceOf(Object)
  })

  test('rejects when the provider does not declare the web-a2a extension', async () => {
    const { consumer, provider } = createFakeWindowPair({
      consumerOrigin: 'https://consumer.example',
      providerOrigin: 'https://provider.example',
    })
    const noExtCard = { ...providerCard('https://provider.example'), capabilities: {} }
    expose({
      window: provider,
      agentCard: noExtCard,
      allowedOrigins: ['*'],
      handlers: {},
    })
    await expect(
      usePostMessage({
        window: consumer,
        targetOrigin: 'https://provider.example',
        agentCard: consumerCard('https://consumer.example'),
        handshakeTimeoutMs: 1000,
      }),
    ).rejects.toThrow(/web-a2a extension/)
  })

  test('provider ignores handshakes from disallowed origins', async () => {
    const { consumer, provider } = createFakeWindowPair({
      consumerOrigin: 'https://consumer.example',
      providerOrigin: 'https://provider.example',
    })
    let handshakeSeen = false
    expose({
      window: provider,
      agentCard: providerCard('https://provider.example'),
      allowedOrigins: ['https://trusted.example'],
      handlers: {},
      onHandshake: () => {
        handshakeSeen = true
      },
    })
    await expect(
      usePostMessage({
        window: consumer,
        targetOrigin: 'https://provider.example',
        agentCard: consumerCard('https://consumer.example'),
        handshakeTimeoutMs: 1000,
      }),
    ).rejects.toThrow()
    expect(handshakeSeen).toBe(false)
  })
})
