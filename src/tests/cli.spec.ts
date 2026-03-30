import { describe, expect, test } from 'bun:test'
import * as z from 'zod'
import { parseCli } from '../cli.ts'

// ============================================================================
// parseCli — in-process (success path only, no process.exit)
// ============================================================================

const TestSchema = z.object({
  name: z.string(),
  value: z.number(),
})

describe('parseCli', () => {
  test('parses valid JSON positional arg', async () => {
    const result = await parseCli(['{"name":"test","value":42}'], TestSchema, { name: 'test-tool' })
    expect(result).toEqual({ name: 'test', value: 42 })
  })

  test('parses JSON with extra whitespace', async () => {
    const result = await parseCli(['  {"name":"hello","value":1}  '], TestSchema, { name: 'test-tool' })
    expect(result).toEqual({ name: 'hello', value: 1 })
  })
})

// ============================================================================
// parseCli — subprocess (process.exit paths)
// ============================================================================

describe('parseCli (subprocess)', () => {
  test('--help exits with code 0', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        `import { parseCli } from './src/cli.ts'; import * as z from 'zod'; await parseCli(['--help'], z.object({}), { name: 'test' })`,
      ],
      { stdout: 'pipe', stderr: 'pipe' },
    )
    expect(await proc.exited).toBe(0)
  })

  test('-h exits with code 0', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        `import { parseCli } from './src/cli.ts'; import * as z from 'zod'; await parseCli(['-h'], z.object({}), { name: 'test' })`,
      ],
      { stdout: 'pipe', stderr: 'pipe' },
    )
    expect(await proc.exited).toBe(0)
  })

  test('--schema input emits JSON Schema and exits 0', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        `import { parseCli } from './src/cli.ts'; import * as z from 'zod'; await parseCli(['--schema', 'input'], z.object({ name: z.string() }), { name: 'test' })`,
      ],
      { stdout: 'pipe', stderr: 'pipe' },
    )
    expect(await proc.exited).toBe(0)
    const output = await new Response(proc.stdout).text()
    const schema = JSON.parse(output)
    expect(schema.type).toBe('object')
    expect(schema.properties).toHaveProperty('name')
  })

  test('--schema output emits output schema when provided', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        `import { parseCli } from './src/cli.ts'; import * as z from 'zod'; await parseCli(['--schema', 'output'], z.object({ input: z.string() }), { name: 'test', outputSchema: z.object({ result: z.number() }) })`,
      ],
      { stdout: 'pipe', stderr: 'pipe' },
    )
    expect(await proc.exited).toBe(0)
    const output = await new Response(proc.stdout).text()
    const schema = JSON.parse(output)
    expect(schema.properties).toHaveProperty('result')
  })

  test('exits 2 on invalid JSON', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        `import { parseCli } from './src/cli.ts'; import * as z from 'zod'; await parseCli(['not-json'], z.object({}), { name: 'test' })`,
      ],
      { stdout: 'pipe', stderr: 'pipe' },
    )
    expect(await proc.exited).toBe(2)
  })

  test('exits 2 on Zod validation failure', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        `import { parseCli } from './src/cli.ts'; import * as z from 'zod'; await parseCli(['{"bad":true}'], z.object({ name: z.string() }), { name: 'test' })`,
      ],
      { stdout: 'pipe', stderr: 'pipe' },
    )
    expect(await proc.exited).toBe(2)
  })

  test('exits 2 when no input provided', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        `import { parseCli } from './src/cli.ts'; import * as z from 'zod'; await parseCli([], z.object({}), { name: 'test' })`,
      ],
      { stdout: 'pipe', stderr: 'pipe' },
    )
    expect(await proc.exited).toBe(2)
  })
})

// ============================================================================
// makeCli — execution context extraction
// ============================================================================

describe('makeCli', () => {
  test('passes cwd as workspace to handler', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        `import { makeCli } from './src/cli.ts'; import * as z from 'zod';
        const handler = async (_args, ctx) => ({ workspace: ctx.workspace });
        const cli = makeCli(handler, z.object({ value: z.string() }), 'test');
        await cli(['{"value":"hi","cwd":"/tmp/test-workspace"}'])`,
      ],
      { stdout: 'pipe', stderr: 'pipe' },
    )
    expect(await proc.exited).toBe(0)
    const output = JSON.parse(await new Response(proc.stdout).text())
    expect(output.workspace).toBe('/tmp/test-workspace')
  })

  test('defaults workspace to process.cwd() when cwd omitted', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        `import { makeCli } from './src/cli.ts'; import * as z from 'zod';
        const handler = async (_args, ctx) => ({ workspace: ctx.workspace });
        const cli = makeCli(handler, z.object({ value: z.string() }), 'test');
        await cli(['{"value":"hi"}'])`,
      ],
      { stdout: 'pipe', stderr: 'pipe' },
    )
    expect(await proc.exited).toBe(0)
    const output = JSON.parse(await new Response(proc.stdout).text())
    expect(output.workspace).toBe(process.cwd())
  })

  test('passes custom timeout to AbortSignal', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        `import { makeCli } from './src/cli.ts'; import * as z from 'zod';
        const handler = async (_args, ctx) => ({ aborted: ctx.signal.aborted });
        const cli = makeCli(handler, z.object({ value: z.string() }), 'test');
        await cli(['{"value":"hi","timeout":60000}'])`,
      ],
      { stdout: 'pipe', stderr: 'pipe' },
    )
    expect(await proc.exited).toBe(0)
    const output = JSON.parse(await new Response(proc.stdout).text())
    expect(output.aborted).toBe(false)
  })

  test('strips cwd and timeout before passing args to handler', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        `import { makeCli } from './src/cli.ts'; import * as z from 'zod';
        const handler = async (args, _ctx) => args;
        const cli = makeCli(handler, z.object({ value: z.string() }), 'test');
        await cli(['{"value":"hi","cwd":"/tmp","timeout":60000}'])`,
      ],
      { stdout: 'pipe', stderr: 'pipe' },
    )
    expect(await proc.exited).toBe(0)
    const output = JSON.parse(await new Response(proc.stdout).text())
    expect(output).toEqual({ value: 'hi' })
  })

  test('--schema input includes cwd and timeout properties', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        `import { makeCli } from './src/cli.ts'; import * as z from 'zod';
        const handler = async (args, _ctx) => args;
        const cli = makeCli(handler, z.object({ value: z.string() }), 'test');
        await cli(['--schema', 'input'])`,
      ],
      { stdout: 'pipe', stderr: 'pipe' },
    )
    expect(await proc.exited).toBe(0)
    const output = await new Response(proc.stdout).text()
    const schema = JSON.parse(output)
    expect(schema.properties).toHaveProperty('value')
    expect(schema.properties).toHaveProperty('cwd')
    expect(schema.properties).toHaveProperty('timeout')
    expect(schema.properties.cwd.type).toBe('string')
    expect(schema.properties.timeout.type).toBe('number')
  })

  test('--help documents cwd and timeout', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        `import { makeCli } from './src/cli.ts'; import * as z from 'zod';
        const handler = async (args, _ctx) => args;
        const cli = makeCli(handler, z.object({ value: z.string() }), 'test');
        await cli(['--help'])`,
      ],
      { stdout: 'pipe', stderr: 'pipe' },
    )
    expect(await proc.exited).toBe(0)
    const stderr = await new Response(proc.stderr).text()
    expect(stderr).toContain('cwd')
    expect(stderr).toContain('timeout')
    expect(stderr).toContain('--schema')
  })
})
