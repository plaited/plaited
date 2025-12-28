/**
 * @module agent-orchestrator
 *
 * Event-driven orchestrator for coordinating AI agent interactions with Plaited workshop.
 *
 * @remarks
 * Provides a simple event emitter pattern for coordinating agent workflows.
 * Handles tool discovery, execution, and response management through callback-based coordination.
 *
 * @public
 */

import { AGENT_EVENTS } from '../testing/testing.constants.ts'
import type { AgentMessage } from '../testing/testing.schemas.ts'

/**
 * Event types for agent orchestration workflow.
 * Used for coordinating agent discovery, tool execution, and response handling.
 */
export const AGENT_ORCHESTRATOR_EVENTS = {
  /** Agent requests to discover available stories */
  discover_stories_request: 'discover_stories_request',
  /** Stories have been discovered and are ready */
  discover_stories_response: 'discover_stories_response',
  /** Agent requests to discover behavioral elements */
  discover_elements_request: 'discover_elements_request',
  /** Elements have been discovered and are ready */
  discover_elements_response: 'discover_elements_response',
  /** Agent requests story URL generation */
  get_story_url_request: 'get_story_url_request',
  /** Story URL has been generated */
  get_story_url_response: 'get_story_url_response',
  /** Agent sends a message to client */
  send_to_client: 'send_to_client',
  /** Workflow has completed */
  workflow_complete: 'workflow_complete',
} as const

/**
 * Detail payload for story discovery requests.
 */
export type DiscoverStoriesRequest = {
  cwd: string
  paths: string[]
}

/**
 * Detail payload for element discovery requests.
 */
export type DiscoverElementsRequest = {
  cwd: string
}

/**
 * Detail payload for story URL generation requests.
 */
export type GetStoryUrlRequest = {
  cwd: string
  filePath: string
  exportName: string
  port?: number
}

/**
 * Detail payload for sending messages to client.
 */
export type SendToClientRequest = {
  content: string
  agentId?: string
}

/**
 * Creates an event-driven orchestrator for coordinating agent interactions.
 *
 * @param options - Configuration options
 * @param options.onDiscoverStories - Callback for handling story discovery requests
 * @param options.onDiscoverElements - Callback for handling element discovery requests
 * @param options.onGetStoryUrl - Callback for handling story URL generation requests
 * @param options.onSendToClient - Callback for sending messages to connected clients
 * @returns Orchestrator instance with execute method for processing agent requests
 *
 * @remarks
 * The orchestrator provides a simple event-driven API for coordinating agent workflows:
 *
 * **Story Discovery Workflow**:
 * 1. Agent sends `discover_stories_request` event
 * 2. Orchestrator executes discovery callback
 * 3. Returns discovered story metadata
 *
 * **Element Discovery Workflow**:
 * 1. Agent sends `discover_elements_request` event
 * 2. Orchestrator executes discovery callback
 * 3. Returns discovered element metadata
 *
 * **Story URL Generation Workflow**:
 * 1. Agent sends `get_story_url_request` event
 * 2. Orchestrator executes URL generation callback
 * 3. Returns generated URLs
 *
 * **Client Messaging**:
 * 1. Agent sends `send_to_client` event with content
 * 2. Orchestrator formats as AgentMessage
 * 3. Broadcasts to all connected WebSocket clients
 *
 * @example
 * ```typescript
 * import { createAgentOrchestrator, AGENT_ORCHESTRATOR_EVENTS } from 'plaited/workshop'
 * import { collectStories, discoverBehavioralTemplateMetadata, getStoryUrl } from 'plaited/workshop'
 *
 * const orchestrator = createAgentOrchestrator({
 *   onDiscoverStories: async ({ cwd, paths }) => {
 *     const stories = await collectStories(cwd, paths)
 *     return Array.from(stories.values())
 *   },
 *   onDiscoverElements: async ({ cwd }) => {
 *     return await discoverBehavioralTemplateMetadata(cwd)
 *   },
 *   onGetStoryUrl: async (params) => {
 *     return getStoryUrl(params)
 *   },
 *   onSendToClient: (message) => {
 *     server.publish(AGENT_TO_CLIENT_TOPIC, JSON.stringify(message))
 *   }
 * })
 *
 * // Execute story discovery
 * const result = await orchestrator.execute({
 *   type: AGENT_ORCHESTRATOR_EVENTS.discover_stories_request,
 *   detail: { cwd: '/project', paths: ['src/'] }
 * })
 * ```
 *
 * @public
 */
export const createAgentOrchestrator = ({
  onDiscoverStories,
  onDiscoverElements,
  onGetStoryUrl,
  onSendToClient,
}: {
  onDiscoverStories?: (request: DiscoverStoriesRequest) => Promise<unknown>
  onDiscoverElements?: (request: DiscoverElementsRequest) => Promise<unknown>
  onGetStoryUrl?: (request: GetStoryUrlRequest) => Promise<unknown>
  onSendToClient?: (message: AgentMessage) => void
}) => {
  /**
   * Execute an agent workflow request.
   *
   * @param event - The event to execute
   * @returns Promise resolving to the workflow result, or void for client messaging
   */
  const execute = async (event: { type: string; detail?: unknown }): Promise<unknown> => {
    switch (event.type) {
      case AGENT_ORCHESTRATOR_EVENTS.discover_stories_request:
        if (onDiscoverStories) {
          return await onDiscoverStories(event.detail as DiscoverStoriesRequest)
        }
        break

      case AGENT_ORCHESTRATOR_EVENTS.discover_elements_request:
        if (onDiscoverElements) {
          return await onDiscoverElements(event.detail as DiscoverElementsRequest)
        }
        break

      case AGENT_ORCHESTRATOR_EVENTS.get_story_url_request:
        if (onGetStoryUrl) {
          return await onGetStoryUrl(event.detail as GetStoryUrlRequest)
        }
        break

      case AGENT_ORCHESTRATOR_EVENTS.send_to_client:
        if (onSendToClient) {
          const { content, agentId } = event.detail as SendToClientRequest
          const message: AgentMessage = {
            type: AGENT_EVENTS.agent_message,
            detail: {
              content,
              timestamp: Date.now(),
              agentId,
            },
          }
          onSendToClient(message)
        }
        break
    }
  }

  return { execute }
}
