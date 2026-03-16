/**
 * Workspace initialization utilities for modnet nodes and modules.
 *
 * @remarks
 * Creates the module-per-repo directory structure: a Bun workspace root
 * with `modules/` subdirectory where each module is an independent git
 * repo linked via `workspace:*` resolution.
 *
 * @public
 */

import { join } from 'node:path'
import type { ModnetField } from './modnet.schemas.ts'

// ============================================================================
// Constants
// ============================================================================

const BASE_CONTEXT = {
  '@context': {
    '@base': 'node://agent/',
    bp: 'node://agent/behavioral#',
    tools: 'node://agent/tools#',
    xsd: 'http://www.w3.org/2001/XMLSchema#',

    Session: 'bp:Session',
    SelectionDecision: 'bp:SelectionDecision',
    Bid: 'bp:Bid',
    Thread: 'bp:Thread',
    Event: 'bp:Event',
    Skill: 'bp:Skill',
    GovernanceRule: 'bp:GovernanceRule',
    Commit: 'bp:Commit',
    Goal: 'bp:Goal',

    thread: { '@type': '@id' },
    attestsTo: { '@type': '@id', '@container': '@set' },
    artifacts: { '@container': '@set' },
    session: { '@type': '@id' },
    event: { '@type': '@id' },
    blockedBy: { '@type': '@id' },
    interrupts: { '@type': '@id' },
    requester: { '@type': '@id' },
    provides: { '@type': '@id', '@container': '@set' },
    requires: { '@type': '@id', '@container': '@set' },

    selected: 'xsd:boolean',
    superstep: 'xsd:integer',
    timestamp: 'xsd:dateTime',
    priority: 'xsd:integer',
    embedding: { '@container': '@list' },
  },
}

const NODE_GITIGNORE = `# Module repos are independent git histories
modules/

# Dependencies
node_modules/

# Bun grader artifacts
.bthread-grader-*
`

const NODE_TSCONFIG = {
  compilerOptions: {
    lib: ['ESNext'],
    target: 'ESNext',
    module: 'Preserve',
    moduleDetection: 'force',
    allowJs: true,
    moduleResolution: 'bundler',
    allowImportingTsExtensions: true,
    verbatimModuleSyntax: true,
    noEmit: true,
    strict: true,
    skipLibCheck: true,
    noFallthroughCasesInSwitch: true,
    noUncheckedIndexedAccess: true,
  },
}

// ============================================================================
// Node Workspace Init
// ============================================================================

/**
 * Initialize a new modnet node workspace.
 *
 * @remarks
 * Creates a Bun workspace with `modules/*` glob, git-initialized root,
 * `.memory/` directory with JSON-LD context, and runs `bun install`.
 *
 * @param opts.path - Absolute or relative path for the new node directory
 * @param opts.scope - npm scope for module packages (e.g., `"\@mynode"`)
 * @param opts.name - Optional human-readable name (defaults to directory basename)
 */
export const initNodeWorkspace = async ({
  path,
  scope,
  name,
}: {
  path: string
  scope: string
  name?: string
}): Promise<void> => {
  const nodeName = name ?? path.split('/').pop() ?? 'node'

  // 1. git init
  await Bun.$`git init ${path}`.quiet()

  // 2. package.json with workspaces
  const packageJson = {
    name: nodeName,
    private: true,
    workspaces: ['modules/*'],
    modnet: { scope },
  }
  await Bun.write(join(path, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`)

  // 3. tsconfig.json
  await Bun.write(join(path, 'tsconfig.json'), `${JSON.stringify(NODE_TSCONFIG, null, 2)}\n`)

  // 4. .gitignore
  await Bun.write(join(path, '.gitignore'), NODE_GITIGNORE)

  // 5. .memory/ with @context.jsonld, sessions/, constitution/
  const memoryDir = join(path, '.memory')
  await Bun.write(join(memoryDir, '@context.jsonld'), `${JSON.stringify(BASE_CONTEXT, null, 2)}\n`)
  await Bun.write(join(memoryDir, 'sessions', '.gitkeep'), '')
  await Bun.write(join(memoryDir, 'constitution', '.gitkeep'), '')

  // 6. modules/ directory
  await Bun.write(join(path, 'modules', '.gitkeep'), '')

  // 7. bun install
  await Bun.$`bun install`.cwd(path).quiet()
}

// ============================================================================
// Module Init
// ============================================================================

/**
 * Initialize a new module within an existing node workspace.
 *
 * @remarks
 * Creates a module directory under `modules/` with its own git repo,
 * `package.json` scoped to the node, seed skill directory, `.memory/`,
 * and `data/` directories. Runs `bun install` at the node root to link
 * the new workspace package.
 *
 * @param opts.nodePath - Path to the node workspace root
 * @param opts.name - Module name (used for directory and package name)
 * @param opts.modnet - Optional MSS bridge-code tags
 */
export const initModule = async ({
  nodePath,
  name,
  modnet,
}: {
  nodePath: string
  name: string
  modnet?: ModnetField
}): Promise<void> => {
  // Read node scope from root package.json
  const rootPkg = (await Bun.file(join(nodePath, 'package.json')).json()) as {
    modnet?: { scope?: string }
  }
  const scope = rootPkg.modnet?.scope ?? '@node'

  const moduleDir = join(nodePath, 'modules', name)

  // 1. git init
  await Bun.$`git init ${moduleDir}`.quiet()

  // 2. package.json with @node/ scope and modnet field
  const packageJson: Record<string, unknown> = {
    name: `${scope}/${name}`,
    version: '1.0.0',
  }
  if (modnet) {
    packageJson.modnet = modnet
  }
  await Bun.write(join(moduleDir, 'package.json'), `${JSON.stringify(packageJson, null, 2)}\n`)

  // 3. Seed skill directory with SKILL.md
  const skillDir = join(moduleDir, 'skills', name)
  const skillMd = `---
name: ${name}
description: Seed skill for the ${name} module
metadata:
  contentType: ${modnet?.contentType ?? 'unknown'}
  boundary: ${modnet?.boundary ?? 'none'}
  scale: "${modnet?.scale ?? 1}"
---

# ${name}

Seed skill for the ${name} module.
`
  await Bun.write(join(skillDir, 'SKILL.md'), skillMd)
  await Bun.write(join(skillDir, 'scripts', '.gitkeep'), '')
  await Bun.write(join(skillDir, 'references', '.gitkeep'), '')

  // 4. .memory/ directory
  await Bun.write(join(moduleDir, '.memory', 'sessions', '.gitkeep'), '')

  // 5. data/ directory
  await Bun.write(join(moduleDir, 'data', '.gitkeep'), '')

  // 6. Run bun install at node root to link workspace
  await Bun.$`bun install`.cwd(nodePath).quiet()
}
