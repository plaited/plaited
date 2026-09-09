/**
 * `behavioral init` — first-time setup command.
 *
 * @remarks
 * Copies the bundled default plugin from `src/plugin/` into the
 * scope-resolved `.agents/plugins/behavioral/` directory, optionally
 * configures you-web auth (apiKey → keychain, or interactive OAuth), and
 * prints the result as JSON. Uses the shared {@link makeCli} framework —
 * no new CLI machinery.
 *
 * Auth precedence for you-web:
 * 1. `you-web.apiKey` present → stored to keychain (bearer-env at connection)
 * 2. `you-web.oauth` true (default when no apiKey) → interactive OAuth flow
 * 3. Neither → auth is `unresolved` (provisioner probes at runtime)
 *
 * @internal
 */

import * as path from 'node:path'
import * as z from 'zod'
import { makeCli } from './cli.ts'

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLUGIN_SOURCE_DIR = path.resolve(import.meta.dir, '../plugin')

// ---------------------------------------------------------------------------
// Zod schemas (CLI framework — Zod for --schema reflection)
// ---------------------------------------------------------------------------

const YouWebSchema = z
  .object({
    apiKey: z.string().nullable().optional(),
    oauth: z.boolean().optional(),
  })
  .strict()
  .describe('you-web auth config — apiKey for headless, oauth for interactive, or neither for unresolved')

const InitCliInputSchema = z
  .object({
    scope: z.enum(['user', 'project']).default('user'),
    force: z.boolean().default(false),
    'you-web': YouWebSchema.optional(),
  })
  .strict()
  .describe('Init CLI input — install the default behavioral plugin and configure auth')

const InitCliOutputSchema = z
  .object({
    installed: z.string(),
    scope: z.enum(['user', 'project']),
    auth: z.enum(['apiKey', 'oauth', 'unresolved']),
    force: z.boolean(),
  })
  .strict()
  .describe('Init CLI output — the install path, auth resolution, and force flag')

const InitErrorSchema = z
  .object({
    isError: z.literal(true),
    message: z.string(),
  })
  .strict()
  .describe('Init CLI error output')

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const resolveScopeDir = (scope: 'user' | 'project'): string => {
  if (scope === 'user') {
    const home = process.env.HOME ?? process.env.USERPROFILE ?? ''
    if (!home) throw new Error('Cannot resolve HOME directory for user scope')
    return path.join(home, '.agents', 'plugins', 'behavioral')
  }
  return path.join(process.cwd(), '.agents', 'plugins', 'behavioral')
}

const copyDir = async (src: string, dest: string): Promise<void> => {
  await Bun.$`mkdir -p ${dest}`.quiet()
  for (const entry of await Array.fromAsync(new Bun.Glob('*').scan({ cwd: src, onlyFiles: false }))) {
    const srcPath = path.join(src, entry)
    const destPath = path.join(dest, entry)
    if (await Bun.file(srcPath).exists()) {
      await Bun.write(destPath, await Bun.file(srcPath).bytes())
    } else {
      await copyDir(srcPath, destPath)
    }
  }
}

const pluginExists = async (dir: string): Promise<boolean> => Bun.file(path.join(dir, 'plugin.json')).exists()

const resolveAuth = (
  youWeb: { apiKey?: string | null; oauth?: boolean } | undefined,
): { auth: 'apiKey' | 'oauth' | 'unresolved'; apiKey?: string } => {
  if (youWeb?.apiKey) {
    return { auth: 'apiKey', apiKey: youWeb.apiKey }
  }
  if (youWeb && youWeb.oauth !== false) {
    return { auth: 'oauth' }
  }
  return { auth: 'unresolved' }
}

const storeApiKey = async (apiKey: string): Promise<void> => {
  try {
    const { BunKeychain, KEYCHAIN_SERVICE } = await import('../kernel/oauth/keychain.ts')
    const keychain = BunKeychain(KEYCHAIN_SERVICE)
    await keychain.set('you-web-api-key', apiKey)
  } catch {
    // Keychain unavailable (headless/CI/sandbox) — the provisioner probes
    // env at runtime as a fallback. Auth status is still 'apiKey' because
    // the user provided the key; it's just not persisted to the OS store.
  }
}

// ---------------------------------------------------------------------------
// Run
// ---------------------------------------------------------------------------

const run = async (
  input: z.infer<typeof InitCliInputSchema>,
): Promise<z.infer<typeof InitCliOutputSchema> | z.infer<typeof InitErrorSchema>> => {
  const targetDir = resolveScopeDir(input.scope)

  if (await pluginExists(targetDir)) {
    if (!input.force) {
      return {
        isError: true,
        message: 'already installed — pass force: true to overwrite',
      }
    }
    await Bun.$`rm -rf ${targetDir}`.quiet()
  }

  await copyDir(PLUGIN_SOURCE_DIR, targetDir)

  const youWeb = input['you-web']
  const authResult = resolveAuth(youWeb)

  if (authResult.auth === 'apiKey' && authResult.apiKey) {
    await storeApiKey(authResult.apiKey)
  }

  // MINIMAL: oauth flow is not wired here — the provisioner handles interactive
  // OAuth at connection time via the keychain OAuth provider. Upgrade path:
  // trigger the browser OAuth flow directly from init when running interactively.

  return {
    installed: targetDir,
    scope: input.scope,
    auth: authResult.auth,
    force: input.force,
  }
}

// ---------------------------------------------------------------------------
// CLI registration
// ---------------------------------------------------------------------------

export const initCli = makeCli({
  name: 'init',
  inputSchema: InitCliInputSchema,
  outputSchema: z.union([InitCliOutputSchema, InitErrorSchema]),
  help: [
    'First-time setup — install the default behavioral plugin and configure you-web auth.',
    '',
    'Installs the bundled plugin from src/plugin/ into:',
    '  user scope    → ~/.agents/plugins/behavioral/',
    '  project scope → <cwd>/.agents/plugins/behavioral/',
    '',
    'force: default false — refuses to overwrite an existing install.',
    '  pass force: true to replace it (loses edits to the installed copy).',
    '  No silent clobbering — existing installs are protected.',
    '',
    'Auth precedence for you-web:',
    '  1. apiKey present → stored to keychain (bearer-env at connection)',
    '  2. oauth: true (default when no apiKey) → interactive OAuth flow',
    '  3. Neither → unresolved (provisioner probes at runtime)',
    '',
    'Examples:',
    '  behavioral init \'{"scope":"project","you-web":{"apiKey":"KEY"}}\'',
    '  behavioral init \'{"scope":"user","force":true}\'',
    "  behavioral init '{}'  # user scope, default auth (unresolved)",
  ].join('\n'),
  run,
})
