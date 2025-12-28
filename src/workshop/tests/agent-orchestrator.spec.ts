import { expect, test } from 'bun:test'
import { AGENT_EVENTS } from '../../testing/testing.constants.ts'
import type { AgentMessage } from '../../testing/testing.schemas.ts'
import {
  AGENT_ORCHESTRATOR_EVENTS,
  createAgentOrchestrator,
  type DiscoverElementsRequest,
  type DiscoverStoriesRequest,
  type GetStoryUrlRequest,
  type SendToClientRequest,
} from '../agent-orchestrator.ts'

test('AGENT_ORCHESTRATOR_EVENTS constants are defined', () => {
  expect(AGENT_ORCHESTRATOR_EVENTS.discover_stories_request).toBe('discover_stories_request')
  expect(AGENT_ORCHESTRATOR_EVENTS.discover_stories_response).toBe('discover_stories_response')
  expect(AGENT_ORCHESTRATOR_EVENTS.discover_elements_request).toBe('discover_elements_request')
  expect(AGENT_ORCHESTRATOR_EVENTS.discover_elements_response).toBe('discover_elements_response')
  expect(AGENT_ORCHESTRATOR_EVENTS.get_story_url_request).toBe('get_story_url_request')
  expect(AGENT_ORCHESTRATOR_EVENTS.get_story_url_response).toBe('get_story_url_response')
  expect(AGENT_ORCHESTRATOR_EVENTS.send_to_client).toBe('send_to_client')
  expect(AGENT_ORCHESTRATOR_EVENTS.workflow_complete).toBe('workflow_complete')
})

test('createAgentOrchestrator returns orchestrator with execute method', () => {
  const orchestrator = createAgentOrchestrator({})
  expect(orchestrator).toHaveProperty('execute')
  expect(typeof orchestrator.execute).toBe('function')
})

test('orchestrator executes discover stories callback', async () => {
  let callbackCalled = false
  let receivedRequest: DiscoverStoriesRequest | null = null

  const orchestrator = createAgentOrchestrator({
    onDiscoverStories: async (request) => {
      callbackCalled = true
      receivedRequest = request
      return [{ route: '/test-story', exportName: 'TestStory' }]
    },
  })

  const result = await orchestrator.execute({
    type: AGENT_ORCHESTRATOR_EVENTS.discover_stories_request,
    detail: { cwd: '/test/cwd', paths: ['src/'] },
  })

  expect(callbackCalled).toBe(true)
  expect(receivedRequest).not.toBeNull()
  expect(receivedRequest!).toEqual({ cwd: '/test/cwd', paths: ['src/'] })
  expect(result).toEqual([{ route: '/test-story', exportName: 'TestStory' }])
})

test('orchestrator executes discover elements callback', async () => {
  let callbackCalled = false
  let receivedRequest: DiscoverElementsRequest | null = null

  const orchestrator = createAgentOrchestrator({
    onDiscoverElements: async (request) => {
      callbackCalled = true
      receivedRequest = request
      return [{ exportName: 'TestElement', filePath: '/test/element.tsx' }]
    },
  })

  const result = await orchestrator.execute({
    type: AGENT_ORCHESTRATOR_EVENTS.discover_elements_request,
    detail: { cwd: '/test/cwd' },
  })

  expect(callbackCalled).toBe(true)
  expect(receivedRequest).not.toBeNull()
  expect(receivedRequest!).toEqual({ cwd: '/test/cwd' })
  expect(result).toEqual([{ exportName: 'TestElement', filePath: '/test/element.tsx' }])
})

test('orchestrator executes get story URL callback', async () => {
  let callbackCalled = false
  let receivedRequest: GetStoryUrlRequest | null = null

  const orchestrator = createAgentOrchestrator({
    onGetStoryUrl: async (request) => {
      callbackCalled = true
      receivedRequest = request
      return {
        url: 'http://localhost:3000/test-story',
        templateUrl: 'http://localhost:3000/test-story.template',
      }
    },
  })

  const result = await orchestrator.execute({
    type: AGENT_ORCHESTRATOR_EVENTS.get_story_url_request,
    detail: {
      cwd: '/test/cwd',
      filePath: '/test/story.stories.tsx',
      exportName: 'TestStory',
      port: 3000,
    },
  })

  expect(callbackCalled).toBe(true)
  expect(receivedRequest).not.toBeNull()
  expect(receivedRequest!).toEqual({
    cwd: '/test/cwd',
    filePath: '/test/story.stories.tsx',
    exportName: 'TestStory',
    port: 3000,
  })
  expect(result).toEqual({
    url: 'http://localhost:3000/test-story',
    templateUrl: 'http://localhost:3000/test-story.template',
  })
})

test('orchestrator formats and sends client messages', async () => {
  let sentMessage: AgentMessage | null = null

  const orchestrator = createAgentOrchestrator({
    onSendToClient: (message) => {
      sentMessage = message
    },
  })

  await orchestrator.execute({
    type: AGENT_ORCHESTRATOR_EVENTS.send_to_client,
    detail: {
      content: 'Test message',
      agentId: 'test-agent-123',
    } as SendToClientRequest,
  })

  expect(sentMessage).not.toBeNull()
  expect(sentMessage!.type).toBe(AGENT_EVENTS.agent_message)
  expect(sentMessage!.detail.content).toBe('Test message')
  expect(sentMessage!.detail.agentId).toBe('test-agent-123')
  expect(typeof sentMessage!.detail.timestamp).toBe('number')
})

test('orchestrator handles client messages without agentId', async () => {
  let sentMessage: AgentMessage | null = null

  const orchestrator = createAgentOrchestrator({
    onSendToClient: (message) => {
      sentMessage = message
    },
  })

  await orchestrator.execute({
    type: AGENT_ORCHESTRATOR_EVENTS.send_to_client,
    detail: {
      content: 'Test message without agent ID',
    } as SendToClientRequest,
  })

  expect(sentMessage).not.toBeNull()
  expect(sentMessage!.type).toBe(AGENT_EVENTS.agent_message)
  expect(sentMessage!.detail.content).toBe('Test message without agent ID')
  expect(sentMessage!.detail.agentId).toBeUndefined()
})

test('orchestrator handles unknown event types gracefully', async () => {
  const orchestrator = createAgentOrchestrator({})

  const result = await orchestrator.execute({
    type: 'unknown_event_type',
    detail: { some: 'data' },
  })

  expect(result).toBeUndefined()
})

test('orchestrator does not call callback when not provided', async () => {
  const orchestrator = createAgentOrchestrator({})

  const result = await orchestrator.execute({
    type: AGENT_ORCHESTRATOR_EVENTS.discover_stories_request,
    detail: { cwd: '/test', paths: ['src/'] },
  })

  expect(result).toBeUndefined()
})

test('orchestrator supports all callbacks simultaneously', async () => {
  let storiesCallbackCalled = false
  let elementsCallbackCalled = false
  let urlCallbackCalled = false
  let clientCallbackCalled = false

  const orchestrator = createAgentOrchestrator({
    onDiscoverStories: async () => {
      storiesCallbackCalled = true
      return []
    },
    onDiscoverElements: async () => {
      elementsCallbackCalled = true
      return []
    },
    onGetStoryUrl: async () => {
      urlCallbackCalled = true
      return { url: '', templateUrl: '' }
    },
    onSendToClient: () => {
      clientCallbackCalled = true
    },
  })

  await orchestrator.execute({
    type: AGENT_ORCHESTRATOR_EVENTS.discover_stories_request,
    detail: { cwd: '/', paths: [] },
  })
  await orchestrator.execute({
    type: AGENT_ORCHESTRATOR_EVENTS.discover_elements_request,
    detail: { cwd: '/' },
  })
  await orchestrator.execute({
    type: AGENT_ORCHESTRATOR_EVENTS.get_story_url_request,
    detail: { cwd: '/', filePath: '', exportName: '' },
  })
  await orchestrator.execute({
    type: AGENT_ORCHESTRATOR_EVENTS.send_to_client,
    detail: { content: '' },
  })

  expect(storiesCallbackCalled).toBe(true)
  expect(elementsCallbackCalled).toBe(true)
  expect(urlCallbackCalled).toBe(true)
  expect(clientCallbackCalled).toBe(true)
})
