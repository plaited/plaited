import type { Factory } from '../../agent.ts'
import { MODULE_DISCOVERY_FACTORY_EVENTS } from '../module-discovery-factory/module-discovery-factory.constants.ts'
import { SEARCH_FACTORY_EVENTS } from '../search-factory/search-factory.constants.ts'
import { SKILLS_FACTORY_EVENTS } from '../skills-factory/skills-factory.constants.ts'
import { NOTIFICATION_FACTORY_EVENTS, NOTIFICATION_FACTORY_SIGNAL_KEYS } from './notification-factory.constants.ts'
import {
  type NotificationEntry,
  NotificationEntrySchema,
  NotificationHistorySchema,
  type NotificationSeverity,
} from './notification-factory.schemas.ts'
import type { CreateNotificationFactoryOptions } from './notification-factory.types.ts'

/**
 * Creates the bounded notification factory.
 *
 * @public
 */
export const createNotificationFactory =
  ({
    notificationsSignalKey = NOTIFICATION_FACTORY_SIGNAL_KEYS.notifications,
    maxEntries = 25,
  }: CreateNotificationFactoryOptions = {}): Factory =>
  ({ signals, trigger }) => {
    const notificationsSignal =
      signals.get(notificationsSignalKey) ??
      signals.set({
        key: notificationsSignalKey,
        schema: NotificationHistorySchema,
        value: [],
        readOnly: false,
      })

    const appendNotification = ({
      severity,
      eventType,
      message,
    }: {
      severity: NotificationSeverity
      eventType: string
      message: string
    }) => {
      const next = NotificationEntrySchema.parse({
        severity,
        eventType,
        message,
        timestamp: Date.now(),
      })
      const current = (notificationsSignal.get() ?? []) as NotificationEntry[]
      const last = current.at(-1)
      if (
        last &&
        last.eventType === next.eventType &&
        last.message === next.message &&
        last.severity === next.severity
      ) {
        return
      }
      const updated = [...current, next].slice(-maxEntries)
      notificationsSignal.set?.(updated)
      trigger({
        type: NOTIFICATION_FACTORY_EVENTS.notification_factory_updated,
        detail: { count: updated.length, severity: next.severity },
      })
    }

    return {
      handlers: {
        [SKILLS_FACTORY_EVENTS.skills_factory_selection_failed](detail) {
          appendNotification({
            severity: 'warning',
            eventType: SKILLS_FACTORY_EVENTS.skills_factory_selection_failed,
            message: `Skill selection failed: ${(detail as { reason?: string }).reason ?? 'unknown reason'}`,
          })
        },
        [MODULE_DISCOVERY_FACTORY_EVENTS.module_discovery_load_failed](detail) {
          appendNotification({
            severity: 'warning',
            eventType: MODULE_DISCOVERY_FACTORY_EVENTS.module_discovery_load_failed,
            message: `Module load failed: ${(detail as { reason?: string }).reason ?? 'unknown reason'}`,
          })
        },
        [SEARCH_FACTORY_EVENTS.search_factory_results_updated](detail) {
          appendNotification({
            severity: 'status',
            eventType: SEARCH_FACTORY_EVENTS.search_factory_results_updated,
            message: `Search returned ${((detail as { results?: unknown[] }).results?.length ?? 0).toString()} results`,
          })
        },
        [SKILLS_FACTORY_EVENTS.skills_factory_selected](detail) {
          appendNotification({
            severity: 'completion',
            eventType: SKILLS_FACTORY_EVENTS.skills_factory_selected,
            message: `Selected skill ${(detail as { name?: string }).name ?? 'unknown'}`,
          })
        },
      },
    }
  }
