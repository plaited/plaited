import { describe, expect, test } from 'bun:test'

const runCli = async (input: unknown, ...extraArgs: string[]) => {
  const hasInput = input !== null
  const inputJson = hasInput ? JSON.stringify(input) : undefined
  const args = [
    ...(inputJson === undefined ? [] : [JSON.stringify(inputJson)]),
    ...extraArgs.map((a) => JSON.stringify(a)),
  ]
  const proc = Bun.spawn(
    [
      'bun',
      '-e',
      [
        "import { frontierAnalysisCli } from '../frontier-analysis.ts'",
        `await frontierAnalysisCli['frontier-analysis']([${args.join(',')}])`,
      ].join(';\n'),
    ],
    { stdout: 'pipe', stderr: 'pipe', cwd: import.meta.dir },
  )
  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(proc.stdout).text(),
    new Response(proc.stderr).text(),
    proc.exited,
  ])
  return { stdout, stderr, exitCode }
}

describe('frontierAnalysisCli', () => {
  test('--help exits 0 and describes three modes', async () => {
    const { exitCode, stderr } = await runCli(null, '--help')

    expect(exitCode).toBe(0)
    expect(stderr).toContain('Spec input options')
    expect(stderr).toContain('Replay/explore/verify')
    expect(stderr).toContain('strategy')
  })
})
