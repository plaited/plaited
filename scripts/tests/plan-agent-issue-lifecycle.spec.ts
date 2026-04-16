import { describe, expect, test } from 'bun:test'
import { dirname } from 'node:path'
import {
  PlanAgentIssueLifecycleInputSchema,
  PlanAgentIssueLifecycleOutputSchema,
  planAgentIssueLifecycle,
} from '../plan-agent-issue-lifecycle.ts'

type MockRunCommandOptions = {
  issueLabels?: string[]
  failCommand?: (command: string[]) => boolean
}

const createMockRunCommand = ({
  issueLabels = ['agent-ready', 'needs-triage'],
  failCommand,
}: MockRunCommandOptions = {}) => {
  const commands: string[][] = []

  const runCommand = async (command: string[]) => {
    commands.push(command)

    if (failCommand?.(command)) {
      return {
        exitCode: 1,
        stdout: '',
        stderr: 'forced command failure',
      }
    }

    if (command[0] !== 'gh') {
      return {
        exitCode: 1,
        stdout: '',
        stderr: `unexpected command: ${command.join(' ')}`,
      }
    }

    if (command[1] === 'auth' && command[2] === 'status') {
      return {
        exitCode: 0,
        stdout: 'ok',
        stderr: '',
      }
    }

    if (command[1] === 'repo' && command[2] === 'view') {
      return {
        exitCode: 0,
        stdout: 'plaited/plaited\n',
        stderr: '',
      }
    }

    if (command[1] === 'issue' && command[2] === 'view') {
      return {
        exitCode: 0,
        stdout: JSON.stringify({ labels: issueLabels.map((name) => ({ name })) }),
        stderr: '',
      }
    }

    if (command[1] === 'issue' && (command[2] === 'edit' || command[2] === 'comment')) {
      return {
        exitCode: 0,
        stdout: '',
        stderr: '',
      }
    }

    return {
      exitCode: 1,
      stdout: '',
      stderr: `unsupported gh command: ${command.join(' ')}`,
    }
  }

  return {
    runCommand,
    commands,
  }
}

const whichGh = (): string => '/usr/bin/gh'

describe('plan-agent-issue-lifecycle CLI (subprocess)', () => {
  test('--schema input emits schema', async () => {
    const proc = Bun.spawn(['bun', 'scripts/plan-agent-issue-lifecycle.ts', '--schema', 'input'], {
      cwd: process.cwd(),
      stdout: 'pipe',
      stderr: 'pipe',
    })

    expect(await proc.exited).toBe(0)
    const schema = JSON.parse(await new Response(proc.stdout).text())
    expect(schema.type).toBe('object')
    expect(schema.properties).toHaveProperty('apply')
    expect(schema.properties).toHaveProperty('issue')
    expect(schema.properties).toHaveProperty('transition')
  })

  test('--schema output emits schema', async () => {
    const proc = Bun.spawn(['bun', 'scripts/plan-agent-issue-lifecycle.ts', '--schema', 'output'], {
      cwd: process.cwd(),
      stdout: 'pipe',
      stderr: 'pipe',
    })

    expect(await proc.exited).toBe(0)
    const schema = JSON.parse(await new Response(proc.stdout).text())
    expect(schema.type).toBe('object')
    expect(schema.properties).toHaveProperty('willMutate')
    expect(schema.properties).toHaveProperty('didMutate')
    expect(schema.properties).toHaveProperty('proposedLabelsToAdd')
    expect(schema.properties).toHaveProperty('proposedLabelsToRemove')
    expect(schema.properties).toHaveProperty('proposedComment')
    expect(schema.properties).toHaveProperty('wouldCloseIssue')
  })

  test('--dry-run preserves shared semantics and skips lifecycle planning', async () => {
    const proc = Bun.spawn(
      ['bun', 'scripts/plan-agent-issue-lifecycle.ts', '{"issue":123,"transition":"plan-started"}', '--dry-run'],
      {
        cwd: process.cwd(),
        env: {
          ...process.env,
          PATH: dirname(process.execPath),
        },
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )

    expect(await proc.exited).toBe(0)
    const output = JSON.parse(await new Response(proc.stdout).text())
    expect(output).toEqual({
      command: 'agent:issues:lifecycle',
      input: {
        apply: false,
        issue: 123,
        transition: 'plan-started',
      },
      dryRun: true,
    })
  })

  test('--human renders apply and mutation summary', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        'scripts/plan-agent-issue-lifecycle.ts',
        '{"issue":123,"transition":"blocked","currentLabels":["agent-ready","agent-active"],"reason":"Need maintainer scope decision"}',
        '--human',
      ],
      {
        cwd: process.cwd(),
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )

    expect(await proc.exited).toBe(0)
    const output = await new Response(proc.stdout).text()
    expect(output).toContain('Issue: #123')
    expect(output).toContain('Transition: blocked')
    expect(output).toContain('Apply mode: no')
    expect(output).toContain('Did mutate: no')
    expect(output).toContain('Comment will be applied: yes')
  })

  test('--human includes close-deferred details for completed/full', async () => {
    const proc = Bun.spawn(
      [
        'bun',
        'scripts/plan-agent-issue-lifecycle.ts',
        '{"issue":123,"transition":"completed","currentLabels":["agent-ready","agent-active","agent-pr-open","agent-blocked","agent-needs-human","needs-triage"],"resolution":"full"}',
        '--human',
      ],
      {
        cwd: process.cwd(),
        stdout: 'pipe',
        stderr: 'pipe',
      },
    )

    expect(await proc.exited).toBe(0)
    const output = await new Response(proc.stdout).text()
    expect(output).toContain('Would close issue: yes')
    expect(output).toContain('Close deferred: yes')
    expect(output).toContain('issue closing is deferred; close manually after reviewing the applied lifecycle comment')
  })
})

describe('input validation', () => {
  test('pr-opened requires prUrl', () => {
    const parsed = PlanAgentIssueLifecycleInputSchema.safeParse({
      issue: 123,
      transition: 'pr-opened',
      currentLabels: ['agent-ready'],
    })

    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.path.join('.') === 'prUrl')).toBe(true)
    }
  })

  test('blocked requires reason', () => {
    const parsed = PlanAgentIssueLifecycleInputSchema.safeParse({
      issue: 123,
      transition: 'blocked',
      currentLabels: ['agent-ready'],
    })

    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.path.join('.') === 'reason')).toBe(true)
    }
  })

  test('abandoned requires reason', () => {
    const parsed = PlanAgentIssueLifecycleInputSchema.safeParse({
      issue: 123,
      transition: 'abandoned',
      currentLabels: ['agent-ready'],
    })

    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.path.join('.') === 'reason')).toBe(true)
    }
  })

  test('completed rejects legacy full-resolution alias', () => {
    const legacyAlias = 'fully-' + 'resolved'
    const parsed = PlanAgentIssueLifecycleInputSchema.safeParse({
      issue: 123,
      transition: 'completed',
      currentLabels: ['agent-ready'],
      resolution: legacyAlias,
    })

    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.path.join('.') === 'resolution')).toBe(true)
    }
  })

  test('apply=true requires repo', () => {
    const parsed = PlanAgentIssueLifecycleInputSchema.safeParse({
      issue: 123,
      transition: 'plan-started',
      apply: true,
      currentLabels: ['agent-ready'],
    })

    expect(parsed.success).toBe(false)
    if (!parsed.success) {
      expect(parsed.error.issues.some((issue) => issue.path.join('.') === 'repo')).toBe(true)
    }
  })
})

describe('transition planning', () => {
  test('default remains read-only with no mutation commands', async () => {
    const output = await planAgentIssueLifecycle({
      issue: 123,
      transition: 'plan-started',
      currentLabels: ['agent-ready', 'needs-triage'],
    })

    expect(output.willMutate).toBe(false)
    expect(output.didMutate).toBe(false)
    expect(output.requiresApply).toBe(true)
    expect(output.mutationCommands).toBeUndefined()
    expect(output.appliedLabelsToAdd).toBeUndefined()
    expect(output.appliedLabelsToRemove).toBeUndefined()
    expect(output.appliedComment).toBeUndefined()
  })

  test('apply=true fetches live labels with gh issue view even when currentLabels is provided', async () => {
    const { runCommand, commands } = createMockRunCommand({
      issueLabels: ['agent-ready', 'needs-triage'],
    })

    const output = await planAgentIssueLifecycle(
      {
        issue: 123,
        transition: 'plan-started',
        apply: true,
        repo: 'plaited/plaited',
        currentLabels: ['agent-ready'],
      },
      {
        runCommand,
        which: whichGh,
      },
    )

    expect(commands.some((command) => command[0] === 'gh' && command[1] === 'issue' && command[2] === 'view')).toBe(
      true,
    )
    expect(output.warnings).toContain(
      'apply=true ignored provided currentLabels and fetched labels from gh issue view for plaited/plaited#123',
    )
    expect(output.proposedLabelsToRemove).toEqual(['needs-triage'])
  })

  test('apply=true runs label add/remove commands for plan-started', async () => {
    const { runCommand, commands } = createMockRunCommand({
      issueLabels: ['agent-ready', 'needs-triage'],
    })

    const output = await planAgentIssueLifecycle(
      {
        issue: 123,
        transition: 'plan-started',
        apply: true,
        repo: 'plaited/plaited',
      },
      {
        runCommand,
        which: whichGh,
      },
    )

    expect(output.willMutate).toBe(true)
    expect(output.didMutate).toBe(true)
    expect(output.appliedLabelsToAdd).toEqual(['agent-active'])
    expect(output.appliedLabelsToRemove).toEqual(['needs-triage'])
    expect(output.mutationCommands).toEqual([
      ['gh', 'issue', 'edit', '123', '--repo', 'plaited/plaited', '--add-label', 'agent-active'],
      ['gh', 'issue', 'edit', '123', '--repo', 'plaited/plaited', '--remove-label', 'needs-triage'],
      ['gh', 'issue', 'comment', '123', '--repo', 'plaited/plaited', '--body', output.proposedComment],
    ])
    expect(
      commands.some(
        (command) =>
          command[0] === 'gh' && command[1] === 'issue' && command[2] === 'edit' && command.includes('--add-label'),
      ),
    ).toBe(true)
    expect(
      commands.some(
        (command) =>
          command[0] === 'gh' && command[1] === 'issue' && command[2] === 'edit' && command.includes('--remove-label'),
      ),
    ).toBe(true)
  })

  test('apply=true runs comment command when proposed comment exists', async () => {
    const { runCommand, commands } = createMockRunCommand({
      issueLabels: ['agent-ready', 'agent-active'],
    })

    const output = await planAgentIssueLifecycle(
      {
        issue: 123,
        transition: 'blocked',
        apply: true,
        repo: 'plaited/plaited',
        reason: 'Needs maintainer decision on scope',
      },
      {
        runCommand,
        which: whichGh,
      },
    )

    expect(output.appliedComment).toBe(output.proposedComment)
    expect(commands.some((command) => command[0] === 'gh' && command[1] === 'issue' && command[2] === 'comment')).toBe(
      true,
    )
  })

  test('completed/full sets wouldCloseIssue=true but does not run gh issue close', async () => {
    const { runCommand, commands } = createMockRunCommand({
      issueLabels: [
        'agent-ready',
        'agent-active',
        'agent-pr-open',
        'agent-blocked',
        'agent-needs-human',
        'needs-triage',
      ],
    })

    const output = await planAgentIssueLifecycle(
      {
        issue: 123,
        transition: 'completed',
        apply: true,
        repo: 'plaited/plaited',
        resolution: 'full',
        prUrl: 'https://github.com/plaited/plaited/pull/999',
      },
      {
        runCommand,
        which: whichGh,
      },
    )

    expect(output.wouldCloseIssue).toBe(true)
    expect(output.warnings).toContain(
      'issue closing is deferred; close manually after reviewing the applied lifecycle comment',
    )
    expect(output.mutationCommands?.some((command) => command[0] === 'gh' && command[2] === 'close')).toBe(false)
    expect(commands.some((command) => command[0] === 'gh' && command[2] === 'close')).toBe(false)
  })

  test('command failure throws and does not finish mutation sequence', async () => {
    const { runCommand, commands } = createMockRunCommand({
      issueLabels: ['agent-ready', 'needs-triage'],
      failCommand: (command) => command.includes('--remove-label'),
    })

    await expect(
      planAgentIssueLifecycle(
        {
          issue: 123,
          transition: 'plan-started',
          apply: true,
          repo: 'plaited/plaited',
        },
        {
          runCommand,
          which: whichGh,
        },
      ),
    ).rejects.toThrow('gh issue edit 123 --repo plaited/plaited --remove-label needs-triage failed')

    expect(commands.some((command) => command[0] === 'gh' && command[2] === 'comment')).toBe(false)
  })

  test('guardrails still prevent removing protected labels', async () => {
    const output = await planAgentIssueLifecycle({
      issue: 123,
      transition: 'completed',
      currentLabels: ['agent-ready', 'agent-active', 'agent-planning', 'cline-review', 'card/tooling'],
      resolution: 'full',
      prUrl: 'https://github.com/plaited/plaited/pull/999',
    })

    expect(output.proposedLabelsToRemove.includes('agent-ready')).toBe(false)
    expect(output.proposedLabelsToRemove.includes('agent-planning')).toBe(false)
    expect(output.proposedLabelsToRemove.includes('cline-review')).toBe(false)
    expect(output.proposedLabelsToRemove.includes('card/tooling')).toBe(false)
  })
})

describe('output schema', () => {
  test('output schema validates all transition outputs', async () => {
    const outputs = await Promise.all([
      planAgentIssueLifecycle({
        issue: 123,
        transition: 'plan-started',
        currentLabels: ['agent-ready', 'needs-triage'],
      }),
      planAgentIssueLifecycle({
        issue: 123,
        transition: 'pr-opened',
        currentLabels: ['agent-ready', 'needs-triage'],
        prUrl: 'https://github.com/plaited/plaited/pull/999',
      }),
      planAgentIssueLifecycle({
        issue: 123,
        transition: 'blocked',
        currentLabels: ['agent-ready'],
        reason: 'Needs maintainer decision on scope',
      }),
      planAgentIssueLifecycle({
        issue: 123,
        transition: 'completed',
        currentLabels: ['agent-ready', 'agent-active', 'agent-pr-open', 'agent-blocked', 'agent-needs-human'],
        resolution: 'full',
        prUrl: 'https://github.com/plaited/plaited/pull/999',
      }),
      planAgentIssueLifecycle({
        issue: 123,
        transition: 'completed',
        currentLabels: ['agent-ready', 'agent-active', 'agent-pr-open'],
        resolution: 'partial',
      }),
      planAgentIssueLifecycle({
        issue: 123,
        transition: 'completed',
        currentLabels: ['agent-ready', 'agent-active'],
        resolution: 'unknown',
      }),
      planAgentIssueLifecycle({
        issue: 123,
        transition: 'abandoned',
        currentLabels: ['agent-ready', 'agent-active', 'agent-pr-open'],
        reason: 'Kanban attempt discarded after review',
      }),
    ])

    for (const output of outputs) {
      const parsed = PlanAgentIssueLifecycleOutputSchema.safeParse(output)
      expect(parsed.success).toBe(true)
      expect(typeof output.willMutate).toBe('boolean')
      expect(typeof output.didMutate).toBe('boolean')
      expect(typeof output.wouldCloseIssue).toBe('boolean')
      expect(output).toHaveProperty('proposedLabelsToAdd')
      expect(output).toHaveProperty('proposedLabelsToRemove')
      expect(output).toHaveProperty('proposedComment')
    }
  })
})
