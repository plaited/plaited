#!/usr/bin/env bun

import { appendFile } from 'node:fs/promises'
import { join } from 'node:path'
import { z } from 'zod'

const PiRpcEventSchema = z
  .object({
    type: z.string().optional(),
    message: z.string().optional(),
    text: z.string().optional(),
    content: z.string().optional(),
    delta: z.string().optional(),
    error: z.string().optional(),
  })
  .catchall(z.unknown())

export type PiRpcEvent = z.infer<typeof PiRpcEventSchema>

type PiRpcOptions = {
  model?: string
  sessionDir?: string
  systemPrompt?: string
  appendSystemPrompt?: string
}

type PromptResult = {
  text: string
  events: PiRpcEvent[]
}

type WritableSink = {
  write(chunk: string | ArrayBufferView | ArrayBufferLike): unknown
  end(): unknown
}

const DEFAULT_MODEL = 'openrouter/minimax/minimax-m2.7'

const ensureDir = async (path: string) => {
  await Bun.$`mkdir -p ${path}`.quiet()
}

const readStreamLines = (
  stream: ReadableStream<Uint8Array> | undefined,
  onLine: (line: string) => Promise<void> | void,
) => {
  if (!stream) return Promise.resolve()

  return (async () => {
    const reader = stream.getReader()
    const decoder = new TextDecoder()
    let buffer = ''

    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      while (true) {
        const newlineIndex = buffer.indexOf('\n')
        if (newlineIndex === -1) break
        const line = buffer.slice(0, newlineIndex).trim()
        buffer = buffer.slice(newlineIndex + 1)
        if (line) {
          await onLine(line)
        }
      }
    }

    const tail = buffer.trim()
    if (tail) {
      await onLine(tail)
    }
  })()
}

const isReadableStream = (value: unknown): value is ReadableStream<Uint8Array> =>
  typeof value === 'object' && value !== null && 'getReader' in value

const isWritableSink = (value: unknown): value is WritableSink =>
  typeof value === 'object' && value !== null && 'write' in value && 'end' in value

const extractEventText = (event: PiRpcEvent): string | null => {
  const candidates = [event.delta, event.text, event.message, event.content]
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate
    }
  }
  return null
}

const extractAssistantMessageText = (value: unknown): string | null => {
  if (Array.isArray(value)) {
    for (const item of value) {
      const text = extractAssistantMessageText(item)
      if (text) {
        return text
      }
    }
    return null
  }

  if (typeof value !== 'object' || value === null) {
    return null
  }

  const message = value as {
    role?: unknown
    content?: unknown
  }

  if (message.role !== 'assistant' || !Array.isArray(message.content)) {
    return null
  }

  const text = message.content
    .flatMap((item) => {
      if (typeof item !== 'object' || item === null) {
        return []
      }
      const block = item as { type?: unknown; text?: unknown }
      return block.type === 'text' && typeof block.text === 'string' ? [block.text] : []
    })
    .join('')
    .trim()

  return text || null
}

export class PiRpcClient {
  #proc: ReturnType<typeof Bun.spawn>
  #events: PiRpcEvent[] = []
  #textParts: string[] = []
  #finalAssistantText: string | null = null
  #stdoutDone: Promise<void>
  #stderrDone: Promise<void>
  #stderrPath: string
  #promptDoneResolve: (() => void) | null = null
  #promptDone: Promise<void> | null = null

  constructor({
    model = DEFAULT_MODEL,
    sessionDir = join('.prompts', 'pi-sessions'),
    systemPrompt,
    appendSystemPrompt,
  }: PiRpcOptions = {}) {
    const args = ['varlock', 'run', '--', 'bunx', 'pi', '--mode', 'rpc', '--no-session', '--model', model]

    if (sessionDir) {
      args.push('--session-dir', sessionDir)
    }
    if (systemPrompt) {
      args.push('--system-prompt', systemPrompt)
    }
    if (appendSystemPrompt) {
      args.push('--append-system-prompt', appendSystemPrompt)
    }

    this.#stderrPath = join('.prompts', 'pi-sessions', `stderr-${Date.now()}.log`)
    this.#proc = Bun.spawn({
      cmd: ['bunx', ...args],
      stdin: 'pipe',
      stdout: 'pipe',
      stderr: 'pipe',
    })

    this.#stdoutDone = readStreamLines(
      isReadableStream(this.#proc.stdout) ? this.#proc.stdout : undefined,
      async (line) => {
        try {
          const parsed = JSON.parse(line) as unknown
          const result = PiRpcEventSchema.safeParse(parsed)
          if (!result.success) {
            this.#textParts.push(line)
            return
          }
          const event = result.data
          this.#events.push(event)
          const record = event as Record<string, unknown>
          const finalText =
            (event.type === 'message_end' ? extractAssistantMessageText(record.message) : null) ??
            (event.type === 'agent_end' ? extractAssistantMessageText(record.messages) : null)
          if (finalText) {
            this.#finalAssistantText = finalText
          }
          if (event.type === 'agent_end' && this.#promptDoneResolve) {
            this.#promptDoneResolve()
          }
          const text = extractEventText(event)
          if (text) {
            this.#textParts.push(text)
          }
        } catch {
          this.#textParts.push(line)
        }
      },
    )

    this.#stderrDone = readStreamLines(
      isReadableStream(this.#proc.stderr) ? this.#proc.stderr : undefined,
      async (line) => {
        await ensureDir(join('.prompts', 'pi-sessions'))
        await appendFile(this.#stderrPath, `${line}\n`)
      },
    )
  }

  async prompt(message: string): Promise<PromptResult> {
    this.#events = []
    this.#textParts = []
    this.#finalAssistantText = null
    this.#promptDone = new Promise<void>((resolve) => {
      this.#promptDoneResolve = resolve
    })

    const payload = `${JSON.stringify({ type: 'prompt', message })}\n`
    const stdin = this.#proc.stdin
    if (!isWritableSink(stdin)) {
      throw new Error('Pi RPC stdin is not writable')
    }
    stdin.write(payload)
    await this.#promptDone

    return {
      text: this.#finalAssistantText ?? this.#textParts.join('').trim(),
      events: [...this.#events],
    }
  }

  async close() {
    try {
      const stdin = this.#proc.stdin
      if (isWritableSink(stdin)) {
        stdin.write(`${JSON.stringify({ type: 'abort' })}\n`)
        stdin.end()
      }
    } catch {
      // ignore
    }
    await this.#stdoutDone
    await this.#stderrDone
    await this.#proc.exited
  }
}

if (import.meta.main) {
  const message = Bun.argv.slice(2).join(' ').trim()
  if (!message) {
    console.error('Usage: bun scripts/modnet-pi-rpc.ts "<message>"')
    process.exit(1)
  }

  const client = new PiRpcClient()
  const result = await client.prompt(message)
  console.log(result.text)
}
