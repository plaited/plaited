import { describe, expect, test } from 'bun:test'
import { resolve } from 'node:path'

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
  test('--help exits 0 and describes thread input, replay, explore, and verify', async () => {
    const { exitCode, stderr } = await runCli(null, '--help')

    expect(exitCode).toBe(0)
    expect(stderr).toContain('Thread input options')
    expect(stderr).toContain('Replay/explore/verify options')
    expect(stderr).toContain('strategy')
    expect(stderr).toContain('threads')
  })

  test('replay with thread paths loads threads and replays snapshot messages to the frontier', async () => {
    const threadPath = resolve(import.meta.dir, 'fixtures/threads.ts')
    const { exitCode, stdout } = await runCli({
      mode: 'replay',
      threads: [threadPath],
      snapshotMessages: [{ kind: 'selection', step: 0, selected: { type: 'tick' } }],
    })

    expect(exitCode).toBe(0)
    const output = JSON.parse(stdout)
    expect(output.mode).toBe('replay')
    // tick completes, worker (start) remains pending
    expect(output.frontier.status).toBe('ready')
    expect(output.frontier.candidates).toHaveLength(1)
    expect(output.frontier.candidates[0]!.type).toBe('start')
  })

  test('verify on a page file discovers threads via extractThreads and runs', async () => {
    const pagePath = resolve(import.meta.dir, 'fixtures/page.ts')
    const { exitCode, stdout, stderr } = await runCli({
      mode: 'verify',
      threads: [pagePath],
      snapshotMessages: [{ kind: 'selection', step: 0, selected: { type: 'tick' } }],
    })

    expect(exitCode).toBe(0)
    expect(stderr).not.toContain('No behavioral thread exports found')
    const output = JSON.parse(stdout)
    expect(output.mode).toBe('verify')
    expect(output.status).toBe('verified')
  })
})
