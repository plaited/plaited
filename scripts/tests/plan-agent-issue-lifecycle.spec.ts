import { describe, expect, test } from 'bun:test'
import { dirname } from 'node:path'
import {
  PlanAgentIssueLifecycleInputSchema,
  PlanAgentIssueLifecycleOutputSchema,
  planAgentIssueLifecycle,
} from '../plan-agent-issue-lifecycle.ts'

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
    expect(schema.properties).toHaveProperty('labelsToAdd')
    expect(schema.properties).toHaveProperty('labelsToRemove')
    expect(schema.properties).toHaveProperty('comment')
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
        issue: 123,
        transition: 'plan-started',
      },
      dryRun: true,
    })
  })

  test('--human renders concise text', async () => {
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
    expect(output).toContain('Labels to add: agent-blocked, agent-needs-human')
    expect(output).toContain('Comment preview:')
    expect(output).toContain('Need maintainer scope decision')
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
})

describe('transition planning', () => {
  test('plan-started adds agent-active and removes needs-triage', async () => {
    const output = await planAgentIssueLifecycle({
      issue: 123,
      transition: 'plan-started',
      currentLabels: ['agent-ready', 'agent-planning', 'needs-triage'],
    })

    expect(output.labelsToAdd).toEqual(['agent-active'])
    expect(output.labelsToRemove).toEqual(['needs-triage'])
    expect(output.willMutate).toBe(false)
  })

  test('pr-opened adds agent-pr-open and agent-active', async () => {
    const output = await planAgentIssueLifecycle({
      issue: 123,
      transition: 'pr-opened',
      currentLabels: ['agent-ready', 'agent-planning', 'needs-triage'],
      prUrl: 'https://github.com/plaited/plaited/pull/999',
    })

    expect(output.labelsToAdd).toEqual(['agent-active', 'agent-pr-open'])
    expect(output.labelsToRemove).toEqual(['needs-triage'])
    expect(output.comment).toContain('Refs #123')
  })

  test('blocked adds agent-needs-human and agent-blocked', async () => {
    const output = await planAgentIssueLifecycle({
      issue: 123,
      transition: 'blocked',
      currentLabels: ['agent-ready', 'agent-active'],
      reason: 'Needs maintainer decision on scope',
    })

    expect(output.labelsToAdd).toEqual(['agent-blocked', 'agent-needs-human'])
    expect(output.labelsToRemove).toEqual([])
    expect(output.comment).toContain('Needs maintainer decision on scope')
  })

  test('completed fully-resolved adds agent-done, removes active/pr/blocker labels, and sets wouldCloseIssue=true', async () => {
    const output = await planAgentIssueLifecycle({
      issue: 123,
      transition: 'completed',
      currentLabels: ['agent-ready', 'agent-active', 'agent-pr-open', 'agent-blocked', 'agent-needs-human'],
      resolution: 'fully-resolved',
      prUrl: 'https://github.com/plaited/plaited/pull/999',
    })

    expect(output.labelsToAdd).toEqual(['agent-done'])
    expect(output.labelsToRemove).toEqual(['agent-active', 'agent-blocked', 'agent-needs-human', 'agent-pr-open'])
    expect(output.wouldCloseIssue).toBe(true)
    expect(output.closeIssue).toBe(false)
  })

  test('completed partial does not add agent-done, adds agent-needs-human, and does not close', async () => {
    const output = await planAgentIssueLifecycle({
      issue: 123,
      transition: 'completed',
      currentLabels: ['agent-ready', 'agent-active', 'agent-pr-open'],
      resolution: 'partial',
    })

    expect(output.labelsToAdd).toEqual(['agent-needs-human'])
    expect(output.labelsToAdd).not.toContain('agent-done')
    expect(output.labelsToRemove).toEqual(['agent-active', 'agent-pr-open'])
    expect(output.wouldCloseIssue).toBe(false)
    expect(output.closeIssue).toBe(false)
  })

  test('completed unknown requests maintainer decision', async () => {
    const output = await planAgentIssueLifecycle({
      issue: 123,
      transition: 'completed',
      currentLabels: ['agent-ready', 'agent-active'],
      resolution: 'unknown',
    })

    expect(output.labelsToAdd).toEqual(['agent-needs-human'])
    expect(output.wouldCloseIssue).toBe(false)
    expect(output.comment).toContain('Maintainer decision is required')
  })

  test('abandoned removes active/pr-open and adds agent-needs-human', async () => {
    const output = await planAgentIssueLifecycle({
      issue: 123,
      transition: 'abandoned',
      currentLabels: ['agent-ready', 'agent-active', 'agent-pr-open'],
      reason: 'Kanban attempt discarded after review',
    })

    expect(output.labelsToAdd).toEqual(['agent-needs-human'])
    expect(output.labelsToRemove).toEqual(['agent-active', 'agent-pr-open'])
  })
})

describe('label conflict handling', () => {
  test('add/remove labels are deduped', async () => {
    const output = await planAgentIssueLifecycle({
      issue: 123,
      transition: 'plan-started',
      currentLabels: ['agent-ready', 'agent-ready', 'needs-triage', 'needs-triage'],
    })

    expect(output.labelsToAdd).toEqual(['agent-active'])
    expect(output.labelsToRemove).toEqual(['needs-triage'])
    expect(new Set(output.labelsToAdd).size).toBe(output.labelsToAdd.length)
    expect(new Set(output.labelsToRemove).size).toBe(output.labelsToRemove.length)
  })

  test('no label appears in both add/remove', async () => {
    const output = await planAgentIssueLifecycle({
      issue: 123,
      transition: 'completed',
      currentLabels: ['agent-ready', 'agent-active', 'agent-pr-open'],
      resolution: 'partial',
    })

    for (const label of output.labelsToAdd) {
      expect(output.labelsToRemove.includes(label)).toBe(false)
    }
  })

  test('card/* labels are never removed', async () => {
    const output = await planAgentIssueLifecycle({
      issue: 123,
      transition: 'completed',
      currentLabels: ['agent-ready', 'agent-active', 'card/tooling', 'card/cleanup'],
      resolution: 'fully-resolved',
      prUrl: 'https://github.com/plaited/plaited/pull/999',
    })

    expect(output.labelsToRemove.includes('card/tooling')).toBe(false)
    expect(output.labelsToRemove.includes('card/cleanup')).toBe(false)
  })

  test('cline-review is never proposed', async () => {
    const output = await planAgentIssueLifecycle({
      issue: 123,
      transition: 'completed',
      currentLabels: ['agent-ready', 'agent-active', 'cline-review'],
      resolution: 'fully-resolved',
      prUrl: 'https://github.com/plaited/plaited/pull/999',
    })

    expect(output.labelsToAdd.includes('cline-review')).toBe(false)
    expect(output.labelsToRemove.includes('cline-review')).toBe(false)
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
        resolution: 'fully-resolved',
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
    }
  })
})
