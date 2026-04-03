import { describe, expect, test } from 'bun:test'
import * as z from 'zod'
import { parseCli, parseCliRequest } from '../cli.ts'

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

describe('parseCliRequest', () => {
  test('captures the dry-run flag alongside parsed input', async () => {
    const result = await parseCliRequest(['{"name":"test","value":42}', '--dry-run'], TestSchema, { name: 'test-tool' })

    expect(result.input).toEqual({ name: 'test', value: 42 })
    expect(result.flags).toEqual({ dryRun: true })
  })
})

describe('CLI parsing (subprocess)', () => {
  test('--help exits with code 0', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        `import { parseCli } from './src/utils/cli.ts'; import * as z from 'zod'; await parseCli(['--help'], z.object({}), { name: 'test' })`,
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
        `import { parseCli } from './src/utils/cli.ts'; import * as z from 'zod'; await parseCli(['--schema', 'input'], z.object({ name: z.string() }), { name: 'test' })`,
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
        `import { parseCli } from './src/utils/cli.ts'; import * as z from 'zod'; await parseCli(['--schema', 'output'], z.object({ input: z.string() }), { name: 'test', outputSchema: z.object({ result: z.number() }) })`,
      ],
      { stdout: 'pipe', stderr: 'pipe' },
    )

    expect(await proc.exited).toBe(0)
    const output = await new Response(proc.stdout).text()
    const schema = JSON.parse(output)
    expect(schema.properties).toHaveProperty('result')
  })

  test('exits 2 on invalid --schema target', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        `import { parseCli } from './src/utils/cli.ts'; import * as z from 'zod'; await parseCli(['--schema', 'bad'], z.object({}), { name: 'test' })`,
      ],
      { stdout: 'pipe', stderr: 'pipe' },
    )

    expect(await proc.exited).toBe(2)
  })

  test('exits 2 when output schema is unavailable', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        `import { parseCli } from './src/utils/cli.ts'; import * as z from 'zod'; await parseCli(['--schema', 'output'], z.object({}), { name: 'test' })`,
      ],
      { stdout: 'pipe', stderr: 'pipe' },
    )

    expect(await proc.exited).toBe(2)
  })

  test('exits 2 on invalid JSON', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        `import { parseCli } from './src/utils/cli.ts'; import * as z from 'zod'; await parseCli(['not-json'], z.object({}), { name: 'test' })`,
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
        `import { parseCli } from './src/utils/cli.ts'; import * as z from 'zod'; await parseCli(['{"bad":true}'], z.object({ name: z.string() }), { name: 'test' })`,
      ],
      { stdout: 'pipe', stderr: 'pipe' },
    )

    expect(await proc.exited).toBe(2)
  })

  test('exits 2 when no input is provided', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        `import { parseCli } from './src/utils/cli.ts'; import * as z from 'zod'; await parseCli([], z.object({}), { name: 'test' })`,
      ],
      { stdout: 'pipe', stderr: 'pipe' },
    )

    expect(await proc.exited).toBe(2)
  })
})

describe('makeCli', () => {
  test('runs the command with parsed input', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        `import { makeCli } from './src/utils/cli.ts'; import * as z from 'zod';
        const cli = makeCli({
          name: 'test',
          inputSchema: z.object({ value: z.string() }),
          outputSchema: z.object({ echoed: z.string() }),
          run: async (input) => ({ echoed: input.value }),
        });
        await cli(['{"value":"hi"}'])`,
      ],
      { stdout: 'pipe', stderr: 'pipe' },
    )

    expect(await proc.exited).toBe(0)
    const output = JSON.parse(await new Response(proc.stdout).text())
    expect(output).toEqual({ echoed: 'hi' })
  })

  test('shows request details for --dry-run without running the command', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        `import { makeCli } from './src/utils/cli.ts'; import * as z from 'zod';
        const cli = makeCli({
          name: 'test',
          inputSchema: z.object({ value: z.string() }),
          run: async () => { throw new Error('should not run') },
        });
        await cli(['{"value":"hi"}', '--dry-run'])`,
      ],
      { stdout: 'pipe', stderr: 'pipe' },
    )

    expect(await proc.exited).toBe(0)
    const output = JSON.parse(await new Response(proc.stdout).text())
    expect(output).toEqual({
      command: 'test',
      input: { value: 'hi' },
      dryRun: true,
    })
  })

  test('--schema input emits the input schema', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        `import { makeCli } from './src/utils/cli.ts'; import * as z from 'zod';
        const cli = makeCli({
          name: 'test',
          inputSchema: z.object({ value: z.string() }),
          run: async (input) => input,
        });
        await cli(['--schema', 'input'])`,
      ],
      { stdout: 'pipe', stderr: 'pipe' },
    )

    expect(await proc.exited).toBe(0)
    const output = JSON.parse(await new Response(proc.stdout).text())
    expect(output.properties).toHaveProperty('value')
  })

  test('--help prints the simple flag surface', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        '-e',
        `import { makeCli } from './src/utils/cli.ts'; import * as z from 'zod';
        const cli = makeCli({
          name: 'test',
          inputSchema: z.object({ value: z.string() }),
          run: async (input) => input,
        });
        await cli(['--help'])`,
      ],
      { stdout: 'pipe', stderr: 'pipe' },
    )

    expect(await proc.exited).toBe(0)
    const stderr = await new Response(proc.stderr).text()
    expect(stderr).toContain('--schema <input|output>')
    expect(stderr).toContain('--dry-run')
    expect(stderr).toContain('--help')
  })
})
