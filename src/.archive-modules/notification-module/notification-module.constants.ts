import { keyMirror } from '../../utils.ts'

/**
 * Event names used by the notification module.
 *
 * @public
 */
export const NOTIFICATION_MODULE_EVENTS = keyMirror('notification_module_updated')

/**
 * Default signal keys used by the notification module.
 *
 * @public
 */
export const NOTIFICATION_MODULE_SIGNAL_KEYS = {
  notifications: 'notification_module_notifications',
} as const
