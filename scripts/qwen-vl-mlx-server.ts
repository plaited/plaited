/**
 * Start the Qwen3 VL MLX vision-language server.
 *
 * @remarks
 * Launches `mlx_vlm.server` from the uv-managed native-model training
 * project. The server exposes an
 * OpenAI-compatible `/v1/chat/completions` endpoint with vision capabilities
 * at `http://localhost:<port>`. Used as the real backend for the
 * `analyze_image` tool in the agent loop.
 *
 * Usage:
 * ```bash
 * bun scripts/qwen-vl-mlx-server.ts              # default port 8082
 * bun scripts/qwen-vl-mlx-server.ts --port 9092  # custom port
 * ```
 *
 * @packageDocumentation
 */

const TRAINING_DIR = `${import.meta.dir}/../dev-research/native-model/training`
const DEFAULT_MODEL = 'mlx-community/Qwen3-VL-4B-Instruct-4bit'
const DEFAULT_PORT = '8082'

const args = process.argv.slice(2)
const portIdx = args.indexOf('--port')
const port = portIdx !== -1 ? (args[portIdx + 1] ?? DEFAULT_PORT) : DEFAULT_PORT
const model = process.env.QWEN_VL_MODEL ?? DEFAULT_MODEL

const pyprojectExists = await Bun.file(`${TRAINING_DIR}/pyproject.toml`).exists()
if (!pyprojectExists) {
  console.error(`Native-model training project not found. Expected:\n  ${TRAINING_DIR}/pyproject.toml`)
  process.exit(1)
}

if (!Bun.which('uv')) {
  console.error('uv not found. Install it first, then run `uv sync --group dev --group mlx`.')
  process.exit(1)
}

console.log(`Starting Qwen3 VL MLX server...`)
console.log(`  Model:  ${model}`)
console.log(`  Port:   ${port}`)
console.log(`  URL:    http://localhost:${port}/v1/chat/completions`)
console.log()

const result = await Bun.$`uv run python -m mlx_vlm.server --model ${model} --port ${port}`
  .cwd(TRAINING_DIR)
  .env({
    ...(process.env as Record<string, string>),
  })
  .nothrow()

process.exit(result.exitCode)
