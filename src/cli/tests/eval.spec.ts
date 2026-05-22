import { describe, expect, test } from 'bun:test'

const runCli = async (input: unknown, ...extraArgs: string[]) => {
  const hasInput = input !== null
  const inputJson = hasInput ? JSON.stringify(input) : undefined
  const args = [
    ...(inputJson === undefined ? [] : [JSON.stringify(inputJson)]),
    ...extraArgs.map((a) => JSON.stringify(a)),
  ]
  const proc = Bun.spawn(
    ['bun', '-e', ["import { evalCli } from '../eval.ts'", `await evalCli.eval([${args.join(',')}])`].join(';\n')],
    { stdout: 'pipe', stderr: 'pipe', cwd: import.meta.dir },
  )
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { stdout, stderr, exitCode }
}

describe('evalCli', () => {
  test('--help exits 0 and describes grade, compare, calibrate modes', async () => {
    const { exitCode, stderr } = await runCli(null, '--help')

    expect(exitCode).toBe(0)
    expect(stderr).toContain('Usage: plaited eval')
    expect(stderr).toContain('--schema')
    expect(stderr).toContain('--dry-run')
  })
})
