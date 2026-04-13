import { describe, expect, test } from 'bun:test'
import { mkdir, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { Signal } from '../../../agent.ts'
import { createAgent } from '../../../agent.ts'
import { SEARCH_MODULE_EVENTS } from '../../search-module/search-module.constants.ts'
import { createSearchModule } from '../../search-module/search-module.ts'
import { SKILLS_MODULE_EVENTS } from '../../skills-module/skills-module.constants.ts'
import { createSkillsModule } from '../../skills-module/skills-module.ts'
import { NOTIFICATION_MODULE_SIGNAL_KEYS } from '../notification-module.constants.ts'
import type { NotificationHistorySchema } from '../notification-module.schemas.ts'
import { createNotificationModule } from '../notification-module.ts'

const TEST_MODELS = {
  primary: async () => ({
    parsed: { thinking: null, toolCalls: [], message: null },
    usage: { inputTokens: 0, outputTokens: 0 },
  }),
  tts: async () => ({ audio: new Uint8Array(), sampleRate: 0, duration: 0 }),
}

describe('createNotificationModule', () => {
  test('retains concise notifications for completions, status, and failures', async () => {
    const workspace = await mkdtemp(join(tmpdir(), 'plaited-notification-module-'))
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
      modules: [
        createSkillsModule({ rootDir: workspace }),
        createSearchModule({ rootDir: workspace }),
        createNotificationModule(),
        ({ signals }) => {
          notificationsSignal = signals.get(NOTIFICATION_MODULE_SIGNAL_KEYS.notifications) as Signal<
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
    agent.trigger({ type: SKILLS_MODULE_EVENTS.skills_module_select, detail: { name: 'notify-skill' } })
    agent.trigger({ type: SEARCH_MODULE_EVENTS.search_module_search, detail: { query: 'notify' } })
    agent.trigger({ type: SKILLS_MODULE_EVENTS.skills_module_select, detail: { name: 'missing-skill' } })

    await notificationsSeen

    const notifications = notificationsSignal?.get() ?? []
    expect(notifications.some((entry) => entry.severity === 'completion')).toBe(true)
    expect(notifications.some((entry) => entry.severity === 'status')).toBe(true)
    expect(notifications.some((entry) => entry.severity === 'warning')).toBe(true)

    await rm(workspace, { recursive: true, force: true })
  })
})
