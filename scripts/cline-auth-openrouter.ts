const providerId = 'openrouter'
const modelId = 'minimax/minimax-m2.7'
const openRouterApiKey = process.env.OPENROUTER_API_KEY?.trim()

if (!openRouterApiKey) {
  console.error(
    'OPENROUTER_API_KEY is required. Load secrets with `bunx varlock run -- bun run cline:auth:openrouter`.',
  )
  process.exit(1)
}

if (!Bun.which('cline')) {
  console.error('Could not find `cline` on PATH. Run `bun install --frozen-lockfile` first.')
  process.exit(1)
}

const result = await Bun.$`cline auth -p ${providerId} -k ${openRouterApiKey} -m ${modelId}`.nothrow()

if (result.exitCode !== 0) {
  if (result.stderr.length > 0) {
    process.stderr.write(result.stderr.toString())
  }
  process.exit(result.exitCode)
}

if (result.stdout.length > 0) {
  process.stdout.write(result.stdout.toString())
}
