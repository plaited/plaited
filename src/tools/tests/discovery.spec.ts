import { describe, expect, test } from 'bun:test'
import { createDiscoveryTool, DiscoveryInputSchema, DiscoveryOutputSchema } from '../discovery.ts'
import { ajv } from '../use-tool.ts'

const validateInput = ajv.compile(DiscoveryInputSchema)
const validateOutput = ajv.compile(DiscoveryOutputSchema)

// Each test gets a fresh temp SQLite file so CRUD round-trips are isolated.
const tempDbPath = async (): Promise<{ dbPath: string; cleanup: () => Promise<void> }> => {
  const dir = (await Bun.$`mktemp -d`.quiet().text()).trim()
  return {
    dbPath: `${dir}/discovery.sqlite`,
    cleanup: async () => {
      await Bun.$`rm -rf ${dir}`.quiet().nothrow()
    },
  }
}

describe('discovery tool — schema contract (RED)', () => {
  test('input schema is a 5-branch oneOf on mode', () => {
    expect((DiscoveryInputSchema as { oneOf?: unknown[] }).oneOf).toHaveLength(5)
  })

  test('output schema is a 5-branch oneOf on mode', () => {
    expect((DiscoveryOutputSchema as { oneOf?: unknown[] }).oneOf).toHaveLength(5)
  })

  test('rejects an unknown mode', () => {
    expect(validateInput({ mode: 'nope' })).toBe(false)
  })

  test('create requires kind, name, description, handle', () => {
    expect(validateInput({ mode: 'create', kind: 'mcp-tool', name: 'n' })).toBe(false)
    expect(validateInput({ mode: 'create', kind: 'mcp-tool', name: 'n', description: 'd', handle: 'h' })).toBe(true)
  })

  test('create rejects an invalid kind', () => {
    expect(validateInput({ mode: 'create', kind: 'nope', name: 'n', description: 'd', handle: 'h' })).toBe(false)
  })

  test('read/update/delete require id', () => {
    expect(validateInput({ mode: 'read' })).toBe(false)
    expect(validateInput({ mode: 'read', id: 'x' })).toBe(true)
    expect(validateInput({ mode: 'update' })).toBe(false)
    expect(validateInput({ mode: 'update', id: 'x', description: 'd' })).toBe(true)
    expect(validateInput({ mode: 'delete' })).toBe(false)
    expect(validateInput({ mode: 'delete', id: 'x' })).toBe(true)
  })

  test('search requires query', () => {
    expect(validateInput({ mode: 'search' })).toBe(false)
    expect(validateInput({ mode: 'search', query: 'term' })).toBe(true)
  })

  test('a model-supplied dbPath is rejected — dbPath is provisioner-injected, not model-facing', () => {
    // dbPath is NOT in the schema. A model attempting to choose the store path
    // is rejected at the boundary (additionalProperties: false).
    expect(
      validateInput({
        mode: 'create',
        kind: 'mcp-tool',
        name: 'n',
        description: 'd',
        handle: 'h',
        dbPath: '/etc/passwd',
      }),
    ).toBe(false)
    expect(validateInput({ mode: 'search', query: 'x', dbPath: '/tmp/evil.sqlite' })).toBe(false)
  })
})

describe('discovery tool — CRUD round-trip through .plaited/discovery.sqlite', () => {
  test('create → read → update → delete an mcp-tool row', async () => {
    const { dbPath, cleanup } = await tempDbPath()
    const discovery = createDiscoveryTool({ dbPath })
    try {
      const created = (await discovery({
        mode: 'create',
        kind: 'mcp-tool',
        name: 'you-docs',
        description: 'Search the MCP docs.',
        handle: 'https://api.example.com/mcp',
        metadata: { inputSchema: { type: 'object' } },
      })) as { mode: string; row: { id: string; kind: string; name: string; metadata: unknown } }
      expect(created.mode).toBe('create')
      expect(validateOutput(created)).toBe(true)
      const id = created.row.id
      expect(created.row.kind).toBe('mcp-tool')
      expect(created.row.name).toBe('you-docs')
      expect(created.row.metadata).toEqual({ inputSchema: { type: 'object' } })

      const read = (await discovery({ mode: 'read', id })) as { mode: string; row: { name: string } | null }
      expect(read.mode).toBe('read')
      expect(validateOutput(read)).toBe(true)
      expect(read.row?.name).toBe('you-docs')

      const updated = (await discovery({
        mode: 'update',
        id,
        description: 'Search the MCP docs, updated.',
      })) as { mode: string; row: { description: string } | null }
      expect(updated.mode).toBe('update')
      expect(validateOutput(updated)).toBe(true)
      expect(updated.row?.description).toBe('Search the MCP docs, updated.')

      const deleted = (await discovery({ mode: 'delete', id })) as { mode: string; deleted: boolean }
      expect(deleted.mode).toBe('delete')
      expect(validateOutput(deleted)).toBe(true)
      expect(deleted.deleted).toBe(true)

      const afterDelete = (await discovery({ mode: 'read', id })) as { row: null }
      expect(afterDelete.row).toBeNull()
    } finally {
      await cleanup()
    }
  })

  test('a skill row stores frontmatter as metadata', async () => {
    const { dbPath, cleanup } = await tempDbPath()
    const discovery = createDiscoveryTool({ dbPath })
    try {
      const created = (await discovery({
        mode: 'create',
        kind: 'skill',
        name: 'echo',
        description: 'Echo skill.',
        handle: '/path/to/SKILL.md',
        metadata: { license: 'ISC', 'allowed-tools': 'Bash' },
      })) as { row: { kind: string; metadata: unknown } }
      expect(created.row.kind).toBe('skill')
      expect(created.row.metadata).toEqual({ license: 'ISC', 'allowed-tools': 'Bash' })
    } finally {
      await cleanup()
    }
  })

  test('read of a missing id returns row null', async () => {
    const { dbPath, cleanup } = await tempDbPath()
    const discovery = createDiscoveryTool({ dbPath })
    try {
      const read = (await discovery({ mode: 'read', id: 'nonexistent' })) as { row: null }
      expect(validateOutput({ mode: 'read', row: read.row })).toBe(true)
      expect(read.row).toBeNull()
    } finally {
      await cleanup()
    }
  })

  test('update of a missing id returns row null with isError', async () => {
    const { dbPath, cleanup } = await tempDbPath()
    const discovery = createDiscoveryTool({ dbPath })
    try {
      const updated = (await discovery({ mode: 'update', id: 'nonexistent', description: 'x' })) as {
        row: null
        isError?: boolean
      }
      expect(updated.row).toBeNull()
      expect(updated.isError).toBe(true)
    } finally {
      await cleanup()
    }
  })

  test('delete of a missing id returns deleted false', async () => {
    const { dbPath, cleanup } = await tempDbPath()
    const discovery = createDiscoveryTool({ dbPath })
    try {
      const deleted = (await discovery({ mode: 'delete', id: 'nonexistent' })) as { deleted: boolean }
      expect(deleted.deleted).toBe(false)
    } finally {
      await cleanup()
    }
  })

  test('updating a name and handle persists', async () => {
    const { dbPath, cleanup } = await tempDbPath()
    const discovery = createDiscoveryTool({ dbPath })
    try {
      const created = (await discovery({
        mode: 'create',
        kind: 'mcp-tool',
        name: 'old',
        description: 'd',
        handle: 'h1',
      })) as { row: { id: string } }
      const updated = (await discovery({
        mode: 'update',
        id: created.row.id,
        name: 'new',
        handle: 'h2',
      })) as { row: { name: string; handle: string } }
      expect(updated.row.name).toBe('new')
      expect(updated.row.handle).toBe('h2')
    } finally {
      await cleanup()
    }
  })
})

describe('discovery tool — search across both kinds', () => {
  test('matches by name and description substring, case-insensitive', async () => {
    const { dbPath, cleanup } = await tempDbPath()
    const discovery = createDiscoveryTool({ dbPath })
    try {
      await discovery({
        mode: 'create',
        kind: 'mcp-tool',
        name: 'weather',
        description: 'Get forecasts.',
        handle: 'u1',
      })
      await discovery({ mode: 'create', kind: 'skill', name: 'code-review', description: 'Review code.', handle: 'p1' })
      await discovery({
        mode: 'create',
        kind: 'mcp-tool',
        name: 'search',
        description: 'Web search tool.',
        handle: 'u2',
      })

      const byName = (await discovery({ mode: 'search', query: 'weath' })) as { rows: { name: string }[] }
      expect(byName.rows.map((r) => r.name)).toEqual(['weather'])

      const byDesc = (await discovery({ mode: 'search', query: 'code' })) as { rows: { name: string }[] }
      expect(byDesc.rows.map((r) => r.name)).toEqual(['code-review'])

      const caseInsensitive = (await discovery({ mode: 'search', query: 'REVIEW' })) as { rows: { name: string }[] }
      expect(caseInsensitive.rows.map((r) => r.name)).toEqual(['code-review'])
    } finally {
      await cleanup()
    }
  })

  test('kind filter restricts results to one kind', async () => {
    const { dbPath, cleanup } = await tempDbPath()
    const discovery = createDiscoveryTool({ dbPath })
    try {
      await discovery({ mode: 'create', kind: 'mcp-tool', name: 'search', description: 'find', handle: 'u1' })
      await discovery({ mode: 'create', kind: 'skill', name: 'search-skill', description: 'find', handle: 'p1' })

      const toolsOnly = (await discovery({ mode: 'search', query: 'search', kind: 'mcp-tool' })) as {
        rows: { kind: string }[]
      }
      expect(toolsOnly.rows).toHaveLength(1)
      expect(toolsOnly.rows[0]!.kind).toBe('mcp-tool')

      const skillsOnly = (await discovery({ mode: 'search', query: 'search', kind: 'skill' })) as {
        rows: { kind: string }[]
      }
      expect(skillsOnly.rows).toHaveLength(1)
      expect(skillsOnly.rows[0]!.kind).toBe('skill')
    } finally {
      await cleanup()
    }
  })

  test('no match returns an empty rows array', async () => {
    const { dbPath, cleanup } = await tempDbPath()
    const discovery = createDiscoveryTool({ dbPath })
    try {
      const result = (await discovery({ mode: 'search', query: 'zzz' })) as { rows: unknown[] }
      expect(result.rows).toEqual([])
    } finally {
      await cleanup()
    }
  })

  test('limit caps the result count', async () => {
    const { dbPath, cleanup } = await tempDbPath()
    const discovery = createDiscoveryTool({ dbPath })
    try {
      for (let i = 0; i < 5; i++) {
        await discovery({
          mode: 'create',
          kind: 'mcp-tool',
          name: `match-${i}`,
          description: 'common',
          handle: `u${i}`,
        })
      }
      const result = (await discovery({ mode: 'search', query: 'common', limit: 2 })) as { rows: unknown[] }
      expect(result.rows).toHaveLength(2)
    } finally {
      await cleanup()
    }
  })

  test('an empty query matches all rows (tier-1 catalog)', async () => {
    const { dbPath, cleanup } = await tempDbPath()
    const discovery = createDiscoveryTool({ dbPath })
    try {
      await discovery({ mode: 'create', kind: 'mcp-tool', name: 'a', description: 'd', handle: 'u1' })
      await discovery({ mode: 'create', kind: 'skill', name: 'b', description: 'd', handle: 'p1' })
      const result = (await discovery({ mode: 'search', query: '' })) as { rows: { name: string }[] }
      expect(result.rows.map((r) => r.name).sort()).toEqual(['a', 'b'])
    } finally {
      await cleanup()
    }
  })
})
