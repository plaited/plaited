/**
 * Runtime taxonomy values for the PM-mediated modnet runtime.
 *
 * @public
 */
export const RUNTIME_TAXONOMY = ['mss_object', 'artifact', 'behavioral_actor', 'sub_agent', 'team', 'pm'] as const

/**
 * Valid MSS boundary values.
 *
 * @public
 */
export const MSS_BOUNDARIES = ['all', 'none', 'ask', 'paid'] as const

/**
 * Valid MSS structure values.
 *
 * @public
 */
export const MSS_STRUCTURES = [
  'object',
  'form',
  'list',
  'collection',
  'steps',
  'pool',
  'stream',
  'feed',
  'wall',
  'thread',
  'daisy',
  'hierarchy',
  'matrix',
  'hypertext',
] as const

/**
 * Valid MSS mechanic values.
 *
 * @public
 */
export const MSS_MECHANICS = [
  'track',
  'chart',
  'filter',
  'sort',
  'post',
  'reply',
  'vote',
  'karma',
  'gold',
  'follow',
  'like',
  'swipe',
  'scarcity',
  'limited-loops',
  'share',
] as const

/**
 * Valid MSS scale values.
 *
 * @public
 */
export const MSS_SCALES = ['S1', 'S2', 'S3', 'S4', 'S5', 'S6', 'S7', 'S8'] as const

/**
 * Observable link lifecycle moments.
 *
 * @public
 */
export const LINK_ACTIVITY_KINDS = [
  'publish',
  'receive',
  'deliver',
  'deliver_failed',
  'bridge_failed',
  'subscribe',
  'unsubscribe',
  'destroy',
] as const
