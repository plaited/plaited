/**
 * Start the Falcon H1R 7B MLX inference server.
 *
 * @remarks
 * Convenience wrapper that launches `mlx_lm.server` from the project venv
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

const VENV_PYTHON = `${import.meta.dir}/../.venv/bin/python3`
const DEFAULT_MODEL = 'mlx-community/Falcon-H1R-7B-4bit'
const DEFAULT_PORT = '8080'

// ============================================================================
// Parse args
// ============================================================================

const args = process.argv.slice(2)
const portIdx = args.indexOf('--port')
const port = portIdx !== -1 ? (args[portIdx + 1] ?? DEFAULT_PORT) : DEFAULT_PORT
const model = process.env.FALCON_MODEL ?? DEFAULT_MODEL

// ============================================================================
// Verify venv exists
// ============================================================================

const venvExists = await Bun.file(VENV_PYTHON).exists()
if (!venvExists) {
  console.error(
    'Python venv not found. Create it with:\n' +
      '  python3.12 -m venv .venv\n' +
      '  .venv/bin/pip install mlx-lm huggingface-hub',
  )
  process.exit(1)
}

// ============================================================================
// Launch MLX server
// ============================================================================

console.log(`Starting Falcon H1R MLX server...`)
console.log(`  Model:  ${model}`)
console.log(`  Port:   ${port}`)
console.log(`  URL:    http://localhost:${port}/v1/chat/completions`)
console.log()

const proc = Bun.spawn([VENV_PYTHON, '-m', 'mlx_lm.server', '--model', model, '--port', port], {
  cwd: `${import.meta.dir}/..`,
  stdout: 'inherit',
  stderr: 'inherit',
  env: {
    ...process.env,
    HF_TOKEN: process.env.HF_TOKEN,
  },
})

// Forward SIGINT/SIGTERM to the subprocess for clean shutdown
const shutdown = () => {
  proc.kill('SIGTERM')
}
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

await proc.exited
