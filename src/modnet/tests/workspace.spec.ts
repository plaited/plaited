import { mkdtemp, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterAll, beforeAll, describe, expect, test } from 'bun:test'
import { initModule, initNodeWorkspace } from '../workspace.ts'

// ============================================================================
// Fixtures
// ============================================================================

let testDir: string

beforeAll(async () => {
  testDir = await new Promise<string>((resolve, reject) =>
    mkdtemp(join(tmpdir(), 'modnet-test-'), (err, dir) => (err ? reject(err) : resolve(dir))),
  )
})

afterAll(() => {
  rmSync(testDir, { recursive: true, force: true })
})

// ============================================================================
// initNodeWorkspace
// ============================================================================

describe('initNodeWorkspace', () => {
  test('creates git-initialized node directory', async () => {
    const nodePath = join(testDir, 'test-node')
    await initNodeWorkspace({ path: nodePath, scope: '@testnode' })

    expect(await Bun.file(join(nodePath, '.git/HEAD')).exists()).toBe(true)
  })

  test('creates package.json with workspaces and scope', async () => {
    const nodePath = join(testDir, 'test-node')
    const pkg = await Bun.file(join(nodePath, 'package.json')).json()

    expect(pkg.private).toBe(true)
    expect(pkg.workspaces).toEqual(['modules/*'])
    expect(pkg.modnet.scope).toBe('@testnode')
  })

  test('creates tsconfig.json with bundler resolution', async () => {
    const nodePath = join(testDir, 'test-node')
    const tsconfig = await Bun.file(join(nodePath, 'tsconfig.json')).json()

    expect(tsconfig.compilerOptions.moduleResolution).toBe('bundler')
    expect(tsconfig.compilerOptions.strict).toBe(true)
    expect(tsconfig.compilerOptions.verbatimModuleSyntax).toBe(true)
  })

  test('creates .gitignore excluding modules/', async () => {
    const nodePath = join(testDir, 'test-node')
    const gitignore = await Bun.file(join(nodePath, '.gitignore')).text()

    expect(gitignore).toContain('modules/')
    expect(gitignore).toContain('node_modules/')
  })

  test('creates .memory/ with @context.jsonld', async () => {
    const nodePath = join(testDir, 'test-node')
    const context = await Bun.file(join(nodePath, '.memory', '@context.jsonld')).json()

    expect(context['@context']['@base']).toBe('node://agent/')
    expect(context['@context'].bp).toBe('node://agent/behavioral#')
  })

  test('creates .memory/sessions/ and .memory/constitution/', async () => {
    const nodePath = join(testDir, 'test-node')

    expect(await Bun.file(join(nodePath, '.memory', 'sessions', '.gitkeep')).exists()).toBe(true)
    expect(await Bun.file(join(nodePath, '.memory', 'constitution', '.gitkeep')).exists()).toBe(true)
  })

  test('uses directory basename as default name', async () => {
    const nodePath = join(testDir, 'my-agent')
    await initNodeWorkspace({ path: nodePath, scope: '@myagent' })
    const pkg = await Bun.file(join(nodePath, 'package.json')).json()

    expect(pkg.name).toBe('my-agent')
  })

  test('uses custom name when provided', async () => {
    const nodePath = join(testDir, 'custom-name-node')
    await initNodeWorkspace({ path: nodePath, scope: '@custom', name: 'My Custom Node' })
    const pkg = await Bun.file(join(nodePath, 'package.json')).json()

    expect(pkg.name).toBe('My Custom Node')
  })
})

// ============================================================================
// initModule
// ============================================================================

describe('initModule', () => {
  const nodePath = () => join(testDir, 'test-node')

  test('creates git-initialized module directory', async () => {
    await initModule({ nodePath: nodePath(), name: 'apple-block' })
    const moduleDir = join(nodePath(), 'modules', 'apple-block')

    expect(await Bun.file(join(moduleDir, '.git/HEAD')).exists()).toBe(true)
  })

  test('creates package.json with node scope', async () => {
    const moduleDir = join(nodePath(), 'modules', 'apple-block')
    const pkg = await Bun.file(join(moduleDir, 'package.json')).json()

    expect(pkg.name).toBe('@testnode/apple-block')
    expect(pkg.version).toBe('1.0.0')
  })

  test('creates package.json with modnet field when provided', async () => {
    await initModule({
      nodePath: nodePath(),
      name: 'farm-stand',
      modnet: {
        contentType: 'produce',
        structure: 'list',
        mechanics: ['sort', 'filter'],
        boundary: 'ask',
        scale: 3,
      },
    })
    const moduleDir = join(nodePath(), 'modules', 'farm-stand')
    const pkg = await Bun.file(join(moduleDir, 'package.json')).json()

    expect(pkg.modnet.contentType).toBe('produce')
    expect(pkg.modnet.boundary).toBe('ask')
    expect(pkg.modnet.scale).toBe(3)
    expect(pkg.modnet.mechanics).toEqual(['sort', 'filter'])
  })

  test('creates seed skill directory with SKILL.md', async () => {
    const moduleDir = join(nodePath(), 'modules', 'farm-stand')
    const skillMd = await Bun.file(join(moduleDir, 'skills', 'farm-stand', 'SKILL.md')).text()

    expect(skillMd).toContain('name: farm-stand')
    expect(skillMd).toContain('contentType: produce')
    expect(skillMd).toContain('boundary: ask')
  })

  test('creates skill scripts/ and references/ directories', async () => {
    const moduleDir = join(nodePath(), 'modules', 'farm-stand')

    expect(await Bun.file(join(moduleDir, 'skills', 'farm-stand', 'scripts', '.gitkeep')).exists()).toBe(true)
    expect(await Bun.file(join(moduleDir, 'skills', 'farm-stand', 'references', '.gitkeep')).exists()).toBe(true)
  })

  test('creates .memory/sessions/ directory', async () => {
    const moduleDir = join(nodePath(), 'modules', 'apple-block')

    expect(await Bun.file(join(moduleDir, '.memory', 'sessions', '.gitkeep')).exists()).toBe(true)
  })

  test('creates data/ directory', async () => {
    const moduleDir = join(nodePath(), 'modules', 'apple-block')

    expect(await Bun.file(join(moduleDir, 'data', '.gitkeep')).exists()).toBe(true)
  })

  test('omits modnet field from package.json when not provided', async () => {
    const moduleDir = join(nodePath(), 'modules', 'apple-block')
    const pkg = await Bun.file(join(moduleDir, 'package.json')).json()

    expect(pkg.modnet).toBeUndefined()
  })
})
