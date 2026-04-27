import { behavioral, sync, thread } from '../behavioral.ts'

import { ANALYST_PORT, CODER_PORT, RESEARCH_EVENTS } from './research.constants.ts'
import type { AnalystExecuteEvent, ServeEvent } from './research.schema.ts'

const { trigger, addHandler, addThread } = behavioral()

type Runtimes = {
  analyst?: Bun.Subprocess
  coder?: Bun.Subprocess
}

const runtimes: Runtimes = {}

addThread(
  `Block event until start`,
  thread([
    sync({
      waitFor: {
        type: RESEARCH_EVENTS.start,
      },
      block: [
        { type: RESEARCH_EVENTS.check_health },
        { type: RESEARCH_EVENTS.context_ready },
        { type: RESEARCH_EVENTS.execute },
        { type: RESEARCH_EVENTS.serve },
        { type: RESEARCH_EVENTS.start },
        { type: RESEARCH_EVENTS.stop },
        { type: RESEARCH_EVENTS.vllm_ready },
      ],
    }),
  ]),
)

addThread(
  `Block re-start attempts`,
  thread(
    [
      sync({
        waitFor: {
          type: RESEARCH_EVENTS.start,
        },
      }),
      sync({
        block: {
          type: RESEARCH_EVENTS.start,
        },
      }),
    ],
    true,
  ),
)

addThread(
  `Serve on start`,
  thread([
    sync({
      waitFor: {
        type: RESEARCH_EVENTS.start,
      },
    }),
    sync({
      request: {
        type: RESEARCH_EVENTS.check_health,
      },
    }),
  ]),
)

addHandler(RESEARCH_EVENTS.check_health, async () => {
  const analystResponse = await fetch(`http://127.0.0.1:${ANALYST_PORT}/health`).catch(() => undefined)
  const coderResponse = await fetch(`http://127.0.0.1:${CODER_PORT}/health`).catch(() => undefined)

  trigger<ServeEvent>({
    type: RESEARCH_EVENTS.serve,
    detail: {
      analyst: !analystResponse?.ok,
      coder: !coderResponse?.ok,
    },
  })
})

addHandler<ServeEvent['detail']>(RESEARCH_EVENTS.serve, async ({ analyst, coder }) => {
  if (analyst) {
    runtimes.analyst = Bun.spawn(
      [
        'vllm',
        'serve',
        'google/gemma-4-31B-it',
        '--port',
        ANALYST_PORT,
        '--max-model-len',
        '16384',
        '--gpu-memory-utilization',
        '0.90',
        '--enable-auto-tool-choice',
        '--reasoning-parser',
        'gemma4',
        '--tool-call-parser',
        'gemma4',
        '--chat-template',
        `${import.meta.dir}/assets/tool_chat_template_gemma4.jinja`,
      ],
      {
        stdout: 'pipe',
        stderr: 'pipe',
        stdin: 'ignore',
      },
    )
  }

  if (coder) {
    runtimes.coder = Bun.spawn(
      [
        'vllm',
        'serve',
        'google/gemma-4-26B-A4B-it',
        '--port',
        CODER_PORT,
        '--max-model-len',
        '16384',
        '--gpu-memory-utilization',
        '0.90',
        '--enable-auto-tool-choice',
        '--reasoning-parser',
        'gemma4',
        '--tool-call-parser',
        'gemma4',
        '--chat-template',
        `${import.meta.dir}/assets/tool_chat_template_gemma4.jinja`,
      ],
      {
        stdout: 'pipe',
        stderr: 'pipe',
        stdin: 'ignore',
      },
    )
  }

  if (analyst) {
    let analystReady = false
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const response = await fetch(`http://127.0.0.1:${ANALYST_PORT}/health`).catch(() => undefined)
      if (response?.ok) {
        analystReady = true
        break
      }
      await Bun.sleep(1000)
    }

    if (!analystReady) {
      throw new Error(`Analyst vLLM did not become healthy on port ${ANALYST_PORT}`)
    }
  }

  if (coder) {
    let coderReady = false
    for (let attempt = 0; attempt < 120; attempt += 1) {
      const response = await fetch(`http://127.0.0.1:${CODER_PORT}/health`).catch(() => undefined)
      if (response?.ok) {
        coderReady = true
        break
      }
      await Bun.sleep(1000)
    }

    if (!coderReady) {
      throw new Error(`Coder vLLM did not become healthy on port ${CODER_PORT}`)
    }
  }
  trigger({
    type: RESEARCH_EVENTS.vllm_ready,
  })
})

addHandler<AnalystExecuteEvent['detail']>(RESEARCH_EVENTS.execute, async ({ prompt }) => {
  const proc = Bun.spawn(
    [
      'bunx',
      '--package',
      '@mariozechner/pi-coding-agent',
      'pi',
      '--mode',
      'json',
      '--no-session',
      '--tools',
      'read,grep,find,ls',
      prompt,
    ],
    {
      stdout: 'pipe',
      stderr: 'pipe',
      stdin: 'ignore',
    },
  )

  const decoder = new TextDecoder()
  let buffer = ''

  for await (const chunk of proc.stdout) {
    buffer += decoder.decode(chunk, { stream: true })

    while (true) {
      const newlineIndex = buffer.indexOf('\n')
      if (newlineIndex === -1) break

      const line = buffer.slice(0, newlineIndex).trim()
      buffer = buffer.slice(newlineIndex + 1)
      if (!line) continue

      const event = JSON.parse(line)

      if (event.type === 'message_update') {
        // stream text deltas / tool events
      }

      if (event.type === 'message_end') {
        // candidate final assistant message
      }

      if (event.type === 'agent_end') {
        // done
      }
    }
  }
})
