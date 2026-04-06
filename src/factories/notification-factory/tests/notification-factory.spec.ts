import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import { SEARCH_FACTORY_EVENTS } from '../../search-factory/search-factory.constants.ts'
import { createSearchFactory } from '../../search-factory/search-factory.ts'
import { SKILLS_FACTORY_EVENTS } from '../../skills-factory/skills-factory.constants.ts'
import { createSkillsFactory } from '../../skills-factory/skills-factory.ts'
import { NOTIFICATION_FACTORY_SIGNAL_KEYS } from '../notification-factory.constants.ts'
import type { NotificationHistorySchema } from '../notification-factory.schemas.ts'
import { createNotificationFactory } from '../notification-factory.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createNotificationFactory', () => {
  test('retains concise notifications for completions, status, and failures', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'plaited-notification-factory-'))
    const skillDir = join(workspace, 'skills', 'notify-skill')
    await mkdir(skillDir, { recursive: true })
    await Bun.write(
      join(skillDir, 'SKILL.md'),
      `---
name: notify-skill
description: Notify skill
---

Notify body.
`,
    )

    let notificationsSignal: Signal<typeof NotificationHistorySchema> | undefined
    let resolveNotifications!: () => void
    const notificationsSeen = new Promise<void>((resolve) => {
      resolveNotifications = resolve
    })

    const agent = await createAgent({
      id: 'agent:notification',
      cwd: workspace,
      workspace,
      models: TEST_MODELS,
      factories: [
        createSkillsFactory({ rootDir: workspace }),
        createSearchFactory({ rootDir: workspace }),
        createNotificationFactory(),
        ({ signals }) => {
          notificationsSignal = signals.get(NOTIFICATION_FACTORY_SIGNAL_KEYS.notifications) as Signal<
            typeof NotificationHistorySchema
          >
          notificationsSignal.listen(() => {
            if ((notificationsSignal?.get()?.length ?? 0) >= 3) resolveNotifications()
          })
          return {}
        },
      ],
    })

    await Bun.sleep(50)
    agent.trigger({ type: SKILLS_FACTORY_EVENTS.skills_factory_select, detail: { name: 'notify-skill' } })
    agent.trigger({ type: SEARCH_FACTORY_EVENTS.search_factory_search, detail: { query: 'notify' } })
    agent.trigger({ type: SKILLS_FACTORY_EVENTS.skills_factory_select, detail: { name: 'missing-skill' } })

    await notificationsSeen

    const notifications = notificationsSignal?.get() ?? []
    expect(notifications.some((entry) => entry.severity === 'completion')).toBe(true)
    expect(notifications.some((entry) => entry.severity === 'status')).toBe(true)
    expect(notifications.some((entry) => entry.severity === 'warning')).toBe(true)

    await rm(workspace, { recursive: true, force: true })
  })
})
