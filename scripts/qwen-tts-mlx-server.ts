/**
 * Start the Qwen3-TTS MLX audio server.
 *
 * @remarks
 * Launches the Qwen3-TTS inference server from the project venv. The server
 * exposes an OpenAI-compatible `/v1/audio/speech` endpoint at
 * `http://localhost:<port>`. Used as the real backend for the `speak` tool
 * in the agent loop.
 *
 * Usage:
 * ```bash
 * bun scripts/qwen-tts-mlx-server.ts              # default port 8083
 * bun scripts/qwen-tts-mlx-server.ts --port 9093  # custom port
 * ```
 *
 * @packageDocumentation
 */

const VENV_PYTHON = `${import.meta.dir}/../.venv/bin/python3`
const DEFAULT_MODEL = 'mlx-community/Qwen3-TTS-4B-4bit'
const DEFAULT_PORT = '8083'

const args = process.argv.slice(2)
const portIdx = args.indexOf('--port')
const port = portIdx !== -1 ? (args[portIdx + 1] ?? DEFAULT_PORT) : DEFAULT_PORT
const model = process.env.QWEN_TTS_MODEL ?? DEFAULT_MODEL

const venvExists = await Bun.file(VENV_PYTHON).exists()
if (!venvExists) {
  console.error(
    'Python venv not found. Create it with:\n' +
      '  python3.12 -m venv .venv\n' +
      '  .venv/bin/pip install mlx-audio huggingface-hub',
  )
  process.exit(1)
}

console.log(`Starting Qwen3-TTS MLX server...`)
console.log(`  Model:  ${model}`)
console.log(`  Port:   ${port}`)
console.log(`  URL:    http://localhost:${port}/v1/audio/speech`)
console.log()

const proc = Bun.spawn([VENV_PYTHON, '-m', 'mlx_audio.server', '--model', model, '--port', port], {
  cwd: `${import.meta.dir}/..`,
  stdout: 'inherit',
  stderr: 'inherit',
  env: { ...process.env, HF_TOKEN: process.env.HF_TOKEN },
})

const shutdown = () => proc.kill('SIGTERM')
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

await proc.exited
