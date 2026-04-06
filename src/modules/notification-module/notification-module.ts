import type { Module } from '../../agent.ts'
import { MODULE_DISCOVERY_MODULE_EVENTS } from '../module-discovery-module/module-discovery-module.constants.ts'
import { SEARCH_MODULE_EVENTS } from '../search-module/search-module.constants.ts'
import { SKILLS_MODULE_EVENTS } from '../skills-module/skills-module.constants.ts'
import { NOTIFICATION_MODULE_EVENTS, NOTIFICATION_MODULE_SIGNAL_KEYS } from './notification-module.constants.ts'
import {
  type NotificationEntry,
  NotificationEntrySchema,
  NotificationHistorySchema,
  type NotificationSeverity,
} from './notification-module.schemas.ts'
import type { CreateNotificationModuleOptions } from './notification-module.types.ts'

/**
 * Creates the bounded notification module.
 *
 * @public
 */
export const createNotificationModule =
  ({
    notificationsSignalKey = NOTIFICATION_MODULE_SIGNAL_KEYS.notifications,
    maxEntries = 25,
  }: CreateNotificationModuleOptions = {}): Module =>
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
        type: NOTIFICATION_MODULE_EVENTS.notification_module_updated,
        detail: { count: updated.length, severity: next.severity },
      })
    }

    return {
      handlers: {
        [SKILLS_MODULE_EVENTS.skills_module_selection_failed](detail) {
          appendNotification({
            severity: 'warning',
            eventType: SKILLS_MODULE_EVENTS.skills_module_selection_failed,
            message: `Skill selection failed: ${(detail as { reason?: string }).reason ?? 'unknown reason'}`,
          })
        },
        [MODULE_DISCOVERY_MODULE_EVENTS.module_discovery_load_failed](detail) {
          appendNotification({
            severity: 'warning',
            eventType: MODULE_DISCOVERY_MODULE_EVENTS.module_discovery_load_failed,
            message: `Module load failed: ${(detail as { reason?: string }).reason ?? 'unknown reason'}`,
          })
        },
        [SEARCH_MODULE_EVENTS.search_module_results_updated](detail) {
          appendNotification({
            severity: 'status',
            eventType: SEARCH_MODULE_EVENTS.search_module_results_updated,
            message: `Search returned ${((detail as { results?: unknown[] }).results?.length ?? 0).toString()} results`,
          })
        },
        [SKILLS_MODULE_EVENTS.skills_module_selected](detail) {
          appendNotification({
            severity: 'completion',
            eventType: SKILLS_MODULE_EVENTS.skills_module_selected,
            message: `Selected skill ${(detail as { name?: string }).name ?? 'unknown'}`,
          })
        },
      },
    }
  }
