/**
 * Start the Falcon H1R 7B MLX inference server.
 *
 * @remarks
 * Convenience wrapper that launches `mlx_lm.server` from the uv-managed
 * native-model training project
 * with sensible defaults. The server exposes an OpenAI-compatible API at
 * `http://localhost:<port>/v1/chat/completions`.
 *
 * Usage:
 * ```bash
 * bun scripts/falcon-server.ts              # default port 8080
 * bun scripts/falcon-server.ts --port 9090  # custom port
 * ```
 *
 * @packageDocumentation
 */

const TRAINING_DIR = `${import.meta.dir}/../dev-research/native-model/training`
const DEFAULT_MODEL = 'mlx-community/Falcon-H1R-7B-4bit'
const DEFAULT_PORT = '8080'

// ============================================================================
// Parse args
// ============================================================================

const args = process.argv.slice(2)
const portIdx = args.indexOf('--port')
const port = portIdx !== -1 ? (args[portIdx + 1] ?? DEFAULT_PORT) : DEFAULT_PORT
const model = process.env.FALCON_MODEL ?? DEFAULT_MODEL
const adapterPath = process.env.FALCON_ADAPTER_PATH

// ============================================================================
// Verify uv training project exists
// ============================================================================

const pyprojectExists = await Bun.file(`${TRAINING_DIR}/pyproject.toml`).exists()
if (!pyprojectExists) {
  console.error(`Native-model training project not found. Expected:\n  ${TRAINING_DIR}/pyproject.toml`)
  process.exit(1)
}

if (!Bun.which('uv')) {
  console.error('uv not found. Install it first, then run `uv sync --group dev --group mlx`.')
  process.exit(1)
}

// ============================================================================
// Launch MLX server
// ============================================================================

console.log(`Starting Falcon H1R MLX server...`)
console.log(`  Model:  ${model}`)
if (adapterPath) {
  console.log(`  Adapter: ${adapterPath}`)
}
console.log(`  Port:   ${port}`)
console.log(`  URL:    http://localhost:${port}/v1/chat/completions`)
console.log()

const adapterArgs = adapterPath ? ['--adapter-path', adapterPath] : []
const result = await Bun.$`uv run python -m mlx_lm.server --model ${model} --port ${port} ${adapterArgs}`
  .cwd(TRAINING_DIR)
  .env({
    ...(process.env as Record<string, string>),
  })
  .nothrow()

process.exit(result.exitCode)
