import * as z from 'zod'

import { makeCli } from '../cli/cli.ts'
import { AGENT_RUNTIMES } from '../shared.ts'

const HealthInputSchema = z
  .object({
    runtime: z.literal(Object.values(AGENT_RUNTIMES)).describe('Runtime lane to check for an active vLLM server.'),
    port: z
      .number()
      .int()
      .positive()
      .max(65535)
      .optional()
      .describe('Optional localhost TCP port override for the runtime health check.'),
  })
  .describe('Checks whether the selected vLLM runtime server is healthy on localhost.')

type HealthInput = z.output<typeof HealthInputSchema>

const HealthOutputSchema = z
  .object({
    ok: z.boolean().describe('True when the runtime health endpoint returned a successful response.'),
  })
  .describe('Health status for the selected vLLM runtime server.')

type HealthOutput = z.output<typeof HealthOutputSchema>

const ServeInputSchema = z
  .object({
    runtime: z.literal(Object.values(AGENT_RUNTIMES)).describe('Runtime lane and model to serve with vLLM.'),
    maxAttempts: z
      .number()
      .int()
      .positive()
      .optional()
      .describe('Maximum number of health polling attempts before startup is treated as failed.'),
    delayMs: z.number().positive().optional().describe('Delay in milliseconds between health polling attempts.'),
    port: z
      .number()
      .int()
      .positive()
      .max(65535)
      .optional()
      .describe('Optional localhost TCP port override for the vLLM server.'),
  })
  .describe('Starts the selected vLLM runtime server and waits for its health endpoint to become ready.')

type ServeInput = z.output<typeof ServeInputSchema>

const LaunchOutputSchema = z
  .object({
    pid: z.number().int().positive().describe('Operating system process ID for the launched vLLM server.'),
  })
  .describe('Structured launch metadata emitted by the detached vLLM shell launcher.')

const ServeOutputSchema = z
  .object({
    ok: z.boolean().describe('True when the launched vLLM server became healthy.'),
    pid: z.number().int().positive().describe('Operating system process ID for the launched vLLM server.'),
  })
  .describe('Ready status and process ID for the launched vLLM runtime server.')

type ServeOutput = z.output<typeof ServeOutputSchema>

const VllmInputSchema = z
  .discriminatedUnion('mode', [
    HealthInputSchema.extend({
      mode: z.literal('health').describe('Check whether a vLLM runtime server is healthy.'),
    }),
    ServeInputSchema.extend({
      mode: z.literal('serve').describe('Start a vLLM runtime server and wait for readiness.'),
    }),
  ])
  .describe('Runs a vLLM runtime server operation.')

type VllmInput = z.output<typeof VllmInputSchema>

const VllmOutputSchema = z
  .discriminatedUnion('mode', [
    HealthOutputSchema.extend({
      mode: z.literal('health').describe('Health check result.'),
    }),
    ServeOutputSchema.extend({
      mode: z.literal('serve').describe('Server launch result.'),
    }),
  ])
  .describe('Result for a vLLM runtime server operation.')

type VllmOutput = z.output<typeof VllmOutputSchema>

export type RuntimeHealthConfig = {
  model: string
  port: number
  maxModelLen: number
  memoryUtilization: number
}

const DEFAULT_MAX_ATTEMPTS = 120
const DEFAULT_DELAY_MS = 1000

const DEFAULT_ANALYST_PORT = 8001
const DEFAULT_CODER_PORT = 8002

export const RUNTIME_SERVER_CONFIG: Record<keyof typeof AGENT_RUNTIMES, RuntimeHealthConfig> = {
  analyst: {
    model: 'google/gemma-4-E4B-it',
    port: DEFAULT_ANALYST_PORT,
    maxModelLen: 131072,
    memoryUtilization: 0.1875,
  },
  coder: {
    model: 'google/gemma-4-26B-A4B-it',
    port: DEFAULT_CODER_PORT,
    maxModelLen: 262144,
    memoryUtilization: 0.625,
  },
}

const vllmHealth = async ({ runtime, port }: HealthInput): Promise<HealthOutput> =>
  fetch(`http://127.0.0.1:${port ?? RUNTIME_SERVER_CONFIG[runtime].port}/health`)
    .then((response) => ({ ok: response.ok }))
    .catch(() => ({ ok: false }))

const vllmServe = async ({
  runtime,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  delayMs = DEFAULT_DELAY_MS,
  port,
}: ServeInput): Promise<ServeOutput> => {
  const config = RUNTIME_SERVER_CONFIG[runtime]
  const healthUrl = `http://127.0.0.1:${port ?? config.port}/health`
  const stdoutPath = `/tmp/plaited-vllm-${runtime}-${port ?? config.port}.stdout.log`
  const stderrPath = `/tmp/plaited-vllm-${runtime}-${port ?? config.port}.stderr.log`
  await Bun.$`env PORT=${String(port ?? config.port)} bash -c ${`
    if command -v lsof >/dev/null 2>&1; then
      for pid in $(lsof -nP -t -iTCP:"$PORT" -sTCP:LISTEN 2>/dev/null | sort -u); do
        command="$(ps -p "$pid" -o command= 2>/dev/null || true)"
        case "$command" in
          *"vllm serve"*)
            kill "$pid" 2>/dev/null || true
            ;;
          *)
            echo "Cannot start vLLM: port $PORT is occupied by non-vLLM process $pid: $command" >&2
            exit 1
            ;;
        esac
      done
    elif command -v fuser >/dev/null 2>&1; then
      for pid in $(fuser "$PORT/tcp" 2>/dev/null | tr ' ' '\n' | sort -u); do
        command="$(ps -p "$pid" -o command= 2>/dev/null || true)"
        case "$command" in
          *"vllm serve"*)
            kill "$pid" 2>/dev/null || true
            ;;
          *)
            echo "Cannot start vLLM: port $PORT is occupied by non-vLLM process $pid: $command" >&2
            exit 1
            ;;
        esac
      done
    fi

    for _ in 1 2 3 4 5; do
      if command -v lsof >/dev/null 2>&1; then
        if ! lsof -nP -t -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
          exit 0
        fi
      elif ! (: < /dev/tcp/127.0.0.1/"$PORT") >/dev/null 2>&1; then
        exit 0
      fi
      sleep 1
    done

    echo "Cannot start vLLM: port $PORT is still occupied after stopping existing vLLM listeners" >&2
    exit 1
  `}`.quiet()
  const launch = LaunchOutputSchema.parse(
    await Bun.$`env MODEL=${config.model} PORT=${String(port ?? config.port)} MAX_MODEL_LEN=${String(config.maxModelLen)} GPU_MEMORY_UTILIZATION=${String(config.memoryUtilization)} CHAT_TEMPLATE=${`${import.meta.dir}/assets/tool_chat_template_gemma4.jinja`} STDOUT_PATH=${stdoutPath} STDERR_PATH=${stderrPath} bash -c ${`
      nohup vllm serve "$MODEL" \
        --port "$PORT" \
        --max-model-len "$MAX_MODEL_LEN" \
        --gpu-memory-utilization "$GPU_MEMORY_UTILIZATION" \
        --enable-auto-tool-choice \
        --reasoning-parser gemma4 \
        --tool-call-parser gemma4 \
        --chat-template "$CHAT_TEMPLATE" \
        > "$STDOUT_PATH" 2> "$STDERR_PATH" &
      pid=$!
      printf '{"pid":%s}\n' "$pid"
    `}`.json(),
  )

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const response = await fetch(healthUrl).catch(() => undefined)
    if (response?.ok) {
      return {
        ok: true,
        pid: launch.pid,
      }
    }

    if ((await Bun.$`kill -0 ${launch.pid}`.quiet().nothrow()).exitCode !== 0) {
      throw new Error(
        [
          `${runtime} vLLM exited before becoming healthy on port ${port ?? config.port}`,
          `pid: ${launch.pid}`,
          `stdout:\n${(await Bun.file(stdoutPath).exists()) ? await Bun.file(stdoutPath).text() : ''}`,
          `stderr:\n${(await Bun.file(stderrPath).exists()) ? await Bun.file(stderrPath).text() : ''}`,
        ].join('\n'),
      )
    }

    await Bun.sleep(delayMs)
  }

  throw new Error(
    [
      `${runtime} vLLM did not become healthy on port ${port ?? config.port}`,
      `pid: ${launch.pid}`,
      `stdout:\n${(await Bun.file(stdoutPath).exists()) ? await Bun.file(stdoutPath).text() : ''}`,
      `stderr:\n${(await Bun.file(stderrPath).exists()) ? await Bun.file(stderrPath).text() : ''}`,
    ].join('\n'),
  )
}

export const runVllm = async (input: VllmInput): Promise<VllmOutput> => {
  if (input.mode === 'health') {
    return {
      mode: 'health',
      ...(await vllmHealth(input)),
    }
  }

  return {
    mode: 'serve',
    ...(await vllmServe(input)),
  }
}

export const VLLM_COMMAND = 'vllm'

export const vllmCli = makeCli({
  name: VLLM_COMMAND,
  inputSchema: VllmInputSchema,
  outputSchema: VllmOutputSchema,
  help: [
    'Modes:',
    '  - health: check whether the selected runtime server is healthy',
    '  - serve: start the selected runtime server and return its PID after /health is ready',
  ].join('\n'),
  run: runVllm,
})
