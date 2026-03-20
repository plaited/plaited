/**
 * Start the EmbeddingGemma MLX embedding server.
 *
 * @remarks
 * Launches `mlx_lm.server` from the project venv with an embedding-focused
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

const VENV_PYTHON = `${import.meta.dir}/../.venv/bin/python3`
const DEFAULT_MODEL = 'mlx-community/multilingual-e5-small-mlx'
const DEFAULT_PORT = '8081'

const args = process.argv.slice(2)
const portIdx = args.indexOf('--port')
const port = portIdx !== -1 ? (args[portIdx + 1] ?? DEFAULT_PORT) : DEFAULT_PORT
const model = process.env.EMBEDDING_MODEL ?? DEFAULT_MODEL

const venvExists = await Bun.file(VENV_PYTHON).exists()
if (!venvExists) {
  console.error(
    'Python venv not found. Create it with:\n' +
      '  python3.12 -m venv .venv\n' +
      '  .venv/bin/pip install mlx-lm huggingface-hub',
  )
  process.exit(1)
}

console.log(`Starting EmbeddingGemma MLX server...`)
console.log(`  Model:  ${model}`)
console.log(`  Port:   ${port}`)
console.log(`  URL:    http://localhost:${port}/v1/embeddings`)
console.log()

const proc = Bun.spawn([VENV_PYTHON, '-m', 'mlx_lm.server', '--model', model, '--port', port], {
  cwd: `${import.meta.dir}/..`,
  stdout: 'inherit',
  stderr: 'inherit',
  env: { ...process.env, HF_TOKEN: process.env.HF_TOKEN },
})

const shutdown = () => proc.kill('SIGTERM')
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

await proc.exited
