/**
 * Start the Qwen3 VL MLX vision-language server.
 *
 * @remarks
 * Launches `mlx_vlm.server` from the project venv. The server exposes an
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

const VENV_PYTHON = `${import.meta.dir}/../.venv/bin/python3`
const DEFAULT_MODEL = 'mlx-community/Qwen3-VL-4B-Instruct-4bit'
const DEFAULT_PORT = '8082'

const args = process.argv.slice(2)
const portIdx = args.indexOf('--port')
const port = portIdx !== -1 ? (args[portIdx + 1] ?? DEFAULT_PORT) : DEFAULT_PORT
const model = process.env.QWEN_VL_MODEL ?? DEFAULT_MODEL

const venvExists = await Bun.file(VENV_PYTHON).exists()
if (!venvExists) {
  console.error(
    'Python venv not found. Create it with:\n' +
      '  python3.12 -m venv .venv\n' +
      '  .venv/bin/pip install mlx-vlm huggingface-hub',
  )
  process.exit(1)
}

console.log(`Starting Qwen3 VL MLX server...`)
console.log(`  Model:  ${model}`)
console.log(`  Port:   ${port}`)
console.log(`  URL:    http://localhost:${port}/v1/chat/completions`)
console.log()

const proc = Bun.spawn([VENV_PYTHON, '-m', 'mlx_vlm.server', '--model', model, '--port', port], {
  cwd: `${import.meta.dir}/..`,
  stdout: 'inherit',
  stderr: 'inherit',
  env: { ...process.env, HF_TOKEN: process.env.HF_TOKEN },
})

const shutdown = () => proc.kill('SIGTERM')
process.on('SIGINT', shutdown)
process.on('SIGTERM', shutdown)

await proc.exited
