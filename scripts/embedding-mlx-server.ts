/**
 * Start the EmbeddingGemma MLX embedding server.
 *
 * @remarks
 * Launches `mlx_lm.server` from the uv-managed native-model training project
 * with an embedding-focused
 * model. The server exposes an OpenAI-compatible `/v1/embeddings` endpoint at
 * `http://localhost:<port>`. Used as the real backend for the `embed_search`
 * tool in the agent loop.
 *
 * Usage:
 * ```bash
 * bun scripts/embedding-mlx-server.ts              # default port 8081
 * bun scripts/embedding-mlx-server.ts --port 9091  # custom port
 * ```
 *
 * @packageDocumentation
 */

const TRAINING_DIR = `${import.meta.dir}/../dev-research/native-model/training`
const DEFAULT_MODEL = 'mlx-community/embeddinggemma-300m-4bit'
const DEFAULT_PORT = '8081'

const args = process.argv.slice(2)
const portIdx = args.indexOf('--port')
const port = portIdx !== -1 ? (args[portIdx + 1] ?? DEFAULT_PORT) : DEFAULT_PORT
const model = process.env.EMBEDDING_MODEL ?? DEFAULT_MODEL

const pyprojectExists = await Bun.file(`${TRAINING_DIR}/pyproject.toml`).exists()
if (!pyprojectExists) {
  console.error(`Native-model training project not found. Expected:\n  ${TRAINING_DIR}/pyproject.toml`)
  process.exit(1)
}

if (!Bun.which('uv')) {
  console.error('uv not found. Install it first, then run `uv sync --group dev --group mlx`.')
  process.exit(1)
}

console.log(`Starting EmbeddingGemma MLX server...`)
console.log(`  Model:  ${model}`)
console.log(`  Port:   ${port}`)
console.log(`  URL:    http://localhost:${port}/v1/embeddings`)
console.log()

const result = await Bun.$`uv run python -m mlx_lm.server --model ${model} --port ${port}`
  .cwd(TRAINING_DIR)
  .env({
    ...(process.env as Record<string, string>),
  })
  .nothrow()

process.exit(result.exitCode)
