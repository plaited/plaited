import { keyMirror } from '../../utils.ts'

/**
 * Event names used by the notification factory.
 *
 * @public
 */
export const NOTIFICATION_FACTORY_EVENTS = keyMirror('notification_factory_updated')

/**
 * Default signal keys used by the notification factory.
 *
 * @public
 */
export const NOTIFICATION_FACTORY_SIGNAL_KEYS = {
  notifications: 'notification_factory_notifications',
} as const
