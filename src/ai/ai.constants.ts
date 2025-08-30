import { keyMirror } from '../utils.js'
// import { EventDetails } from '../behavioral.js'
export const CLIENT_EVENTS = keyMirror(
  'resources_list',
  'resources_read',
  'notifications_resources_list_changed',
  'resources_subscribe',
  'resources_updated',
  'resources_read',
  'resources_unsubscribe',
  'prompts_list',
  'prompts_get',
  'notifications_prompts_list_changed',
  'tools_list',
  'tools_call',
  'notifications_tools_list_changed',
  'sampling_createMessage',
  'elicitation_create',
  /**
   * THis is uses for list of prompts resources and tools
   */
  'discover_primitives',
  /**
   * THis should probably be used for notifications like tool list changed
   * or promp list changed
   */
  'handle_notification',
)

export const LIST_PRIMITIVES = keyMirror('listPrompts', 'listResources', 'listResourceTemplates', 'listTools')

// type DefaultClientDetails = {
//   [CLIENT_EVENTS.discover_primitives]: void
// }

export const CLIENT_ERROR_EVENTS = keyMirror(
  'ERROR_LIST_TOOLS',
  'ERROR_LIST_RESOURCES',
  'ERROR_LIST_RESOURCE_TEMPLATES',
  'ERROR_LIST_PROMPTS',
  'ERROR_DISCOVER_PRIMITIVES',
  'ERROR_REGISTERING_CLIENT',
)

