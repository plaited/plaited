/**
 * Start the Qwen3-TTS MLX audio server.
 *
 * @remarks
 * Launches the Qwen3-TTS inference server from the uv-managed native-model
 * training project. The server
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

const TRAINING_DIR = `${import.meta.dir}/../dev-research/native-model/training`
const DEFAULT_MODEL = 'mlx-community/Qwen3-TTS-4B-4bit'
const DEFAULT_PORT = '8083'

const args = process.argv.slice(2)
const portIdx = args.indexOf('--port')
const port = portIdx !== -1 ? (args[portIdx + 1] ?? DEFAULT_PORT) : DEFAULT_PORT
const model = process.env.QWEN_TTS_MODEL ?? DEFAULT_MODEL

const pyprojectExists = await Bun.file(`${TRAINING_DIR}/pyproject.toml`).exists()
if (!pyprojectExists) {
  console.error(`Native-model training project not found. Expected:\n  ${TRAINING_DIR}/pyproject.toml`)
  process.exit(1)
}

if (!Bun.which('uv')) {
  console.error('uv not found. Install it first, then run `uv sync --group dev --group mlx`.')
  process.exit(1)
}

console.log(`Starting Qwen3-TTS MLX server...`)
console.log(`  Model:  ${model}`)
console.log(`  Port:   ${port}`)
console.log(`  URL:    http://localhost:${port}/v1/audio/speech`)
console.log()

const result = await Bun.$`uv run python -m mlx_audio.server --model ${model} --port ${port}`
  .cwd(TRAINING_DIR)
  .env({
    ...(process.env as Record<string, string>),
  })
  .nothrow()

process.exit(result.exitCode)
