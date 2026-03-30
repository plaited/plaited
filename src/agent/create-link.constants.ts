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
