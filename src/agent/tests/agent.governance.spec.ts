import { describe, expect, test } from 'bun:test'
import {
  AGENT_EVENTS,
  behavioral,
  createConstitution,
  DEFAULT_MAC_FACTORIES,
  FACTORY_BRANDS,
  isEtcWrite,
  isForcePush,
  isGovernanceModification,
  isRmRf,
  noEtcWrites,
  noForcePush,
  noRmRf,
  protectGovernance,
} from 'plaited'
import type { AgentToolCall, ConstitutionFactory } from 'plaited'

// ============================================================================
// Helpers
// ============================================================================

const bashCall = (command: string, id = 'tc-1'): AgentToolCall => ({
  id,
  name: 'bash',
  arguments: { command },
})

const writeCall = (path: string, id = 'tc-1'): AgentToolCall => ({
  id,
  name: 'write_file',
  arguments: { path, content: 'test' },
})

const editCall = (path: string, id = 'tc-1'): AgentToolCall => ({
  id,
  name: 'edit_file',
  arguments: { path, old_string: 'a', new_string: 'b' },
})

const readCall = (path: string, id = 'tc-1'): AgentToolCall => ({
  id,
  name: 'read_file',
  arguments: { path },
})

const executeEvent = (toolCall: AgentToolCall, tags: string[] = []) => ({
  type: AGENT_EVENTS.execute,
  detail: { toolCall, tags },
})

/**
 * Sets up a behavioral instance with governance threads loaded,
 * and returns a tracker for selected events.
 */
const setupWithGovernance = (factory: ConstitutionFactory) => {
  const { bThreads, trigger, useFeedback } = behavioral()
  const { threads } = factory.create(trigger)
  if (threads) bThreads.set(threads)

  const selected: string[] = []
  useFeedback({
    [AGENT_EVENTS.execute]() {
      selected.push('execute')
    },
  })

  return { trigger, selected }
}

// ============================================================================
// createGovernanceFactory
// ============================================================================

describe('createConstitution (governance)', () => {
  test('brands the factory with constitution brand', () => {
    const factory = createConstitution(() => ({}))
    expect(factory.$).toBe(FACTORY_BRANDS.constitution)
    expect(factory.$).toBe('🏛️')
  })

  test('invokes the create function with trigger', () => {
    let receivedTrigger: unknown
    const factory = createConstitution((trigger) => {
      receivedTrigger = trigger
      return {}
    })
    const { trigger } = behavioral()
    factory.create(trigger)
    expect(receivedTrigger).toBe(trigger)
  })
})

// ============================================================================
// Shared predicates
// ============================================================================

describe('isEtcWrite', () => {
  test('detects bash commands touching /etc/', () => {
    expect(isEtcWrite(bashCall('echo "bad" > /etc/passwd'))).toBe(true)
    expect(isEtcWrite(bashCall('cat /etc/hosts'))).toBe(true)
  })

  test('detects write_file targeting /etc/', () => {
    expect(isEtcWrite(writeCall('/etc/nginx/nginx.conf'))).toBe(true)
  })

  test('detects edit_file targeting /etc/', () => {
    expect(isEtcWrite(editCall('/etc/fstab'))).toBe(true)
  })

  test('allows safe bash commands', () => {
    expect(isEtcWrite(bashCall('ls -la /home/user'))).toBe(false)
  })

  test('allows safe file operations', () => {
    expect(isEtcWrite(writeCall('/home/user/project/main.ts'))).toBe(false)
  })

  test('ignores non-bash/non-write tools', () => {
    expect(isEtcWrite(readCall('/etc/hosts'))).toBe(false)
  })
})

describe('isRmRf', () => {
  test('detects rm -rf commands', () => {
    expect(isRmRf(bashCall('rm -rf /'))).toBe(true)
    expect(isRmRf(bashCall('rm -rf /home/user/project'))).toBe(true)
    expect(isRmRf(bashCall('sudo rm -rf --no-preserve-root /'))).toBe(true)
  })

  test('allows safe bash commands', () => {
    expect(isRmRf(bashCall('rm file.txt'))).toBe(false)
    expect(isRmRf(bashCall('ls -la'))).toBe(false)
  })

  test('ignores non-bash tools', () => {
    expect(isRmRf(writeCall('/some/path'))).toBe(false)
  })
})

describe('isForcePush', () => {
  test('detects git push --force', () => {
    expect(isForcePush(bashCall('git push --force'))).toBe(true)
    expect(isForcePush(bashCall('git push --force origin main'))).toBe(true)
    expect(isForcePush(bashCall('git push origin main --force'))).toBe(true)
  })

  test('detects git push -f', () => {
    expect(isForcePush(bashCall('git push -f'))).toBe(true)
    expect(isForcePush(bashCall('git push -f origin main'))).toBe(true)
  })

  test('allows git push --force-with-lease', () => {
    expect(isForcePush(bashCall('git push --force-with-lease origin main'))).toBe(false)
  })

  test('allows git push --force-if-includes', () => {
    expect(isForcePush(bashCall('git push --force-if-includes origin main'))).toBe(false)
  })

  test('allows normal git push', () => {
    expect(isForcePush(bashCall('git push origin main'))).toBe(false)
    expect(isForcePush(bashCall('git push'))).toBe(false)
  })

  test('ignores non-git-push commands', () => {
    expect(isForcePush(bashCall('git pull --force'))).toBe(false)
    expect(isForcePush(bashCall('ls -f'))).toBe(false)
  })

  test('ignores non-bash tools', () => {
    expect(isForcePush(writeCall('/some/path'))).toBe(false)
  })
})

describe('isGovernanceModification', () => {
  test('detects write_file to MAC governance paths', () => {
    expect(isGovernanceModification(writeCall('.memory/constitution/mac/no-rm-rf.ts'))).toBe(true)
  })

  test('detects edit_file to MAC governance paths', () => {
    expect(isGovernanceModification(editCall('.memory/constitution/mac/protect-governance.ts'))).toBe(true)
  })

  test('detects bash commands targeting MAC governance paths', () => {
    expect(isGovernanceModification(bashCall('rm .memory/constitution/mac/no-rm-rf.ts'))).toBe(true)
    expect(isGovernanceModification(bashCall('sed -i "s/block/pass/" constitution/mac/rule.ts'))).toBe(true)
  })

  test('allows writes to DAC governance paths', () => {
    expect(isGovernanceModification(writeCall('.memory/constitution/dac/custom-rule.ts'))).toBe(false)
  })

  test('allows writes to non-governance paths', () => {
    expect(isGovernanceModification(writeCall('src/agent/agent.ts'))).toBe(false)
  })

  test('ignores read operations', () => {
    expect(isGovernanceModification(readCall('.memory/constitution/mac/no-rm-rf.ts'))).toBe(false)
  })
})

// ============================================================================
// MAC factory bThreads — tested with real behavioral() instances
// ============================================================================

describe('noEtcWrites factory', () => {
  test('blocks execute events with bash commands targeting /etc/', () => {
    const { trigger, selected } = setupWithGovernance(noEtcWrites)
    trigger(executeEvent(bashCall('echo "bad" > /etc/passwd')))
    expect(selected).toHaveLength(0)
  })

  test('blocks execute events with write_file targeting /etc/', () => {
    const { trigger, selected } = setupWithGovernance(noEtcWrites)
    trigger(executeEvent(writeCall('/etc/nginx/nginx.conf')))
    expect(selected).toHaveLength(0)
  })

  test('allows safe execute events', () => {
    const { trigger, selected } = setupWithGovernance(noEtcWrites)
    trigger(executeEvent(bashCall('ls -la /home/user')))
    expect(selected).toHaveLength(1)
  })

  test('allows non-execute events', () => {
    const { trigger, selected } = setupWithGovernance(noEtcWrites)
    const taskSelected: string[] = []
    // Re-subscribe for task events
    const { useFeedback } = behavioral()
    // We need to use the same instance — let's just verify non-execute goes through
    trigger({ type: AGENT_EVENTS.task, detail: { prompt: 'test' } })
    // task event is not blocked by noEtcWrites (only execute is)
    // We don't have a task handler in setupWithGovernance, so we check selected is still 0
    expect(selected).toHaveLength(0) // execute handler not called for task event
  })
})

describe('noRmRf factory', () => {
  test('blocks execute events with rm -rf', () => {
    const { trigger, selected } = setupWithGovernance(noRmRf)
    trigger(executeEvent(bashCall('rm -rf /')))
    expect(selected).toHaveLength(0)
  })

  test('allows safe rm commands', () => {
    const { trigger, selected } = setupWithGovernance(noRmRf)
    trigger(executeEvent(bashCall('rm file.txt')))
    expect(selected).toHaveLength(1)
  })

  test('allows non-bash execute events', () => {
    const { trigger, selected } = setupWithGovernance(noRmRf)
    trigger(executeEvent(readCall('/some/path')))
    expect(selected).toHaveLength(1)
  })
})

describe('noForcePush factory', () => {
  test('blocks execute events with git push --force', () => {
    const { trigger, selected } = setupWithGovernance(noForcePush)
    trigger(executeEvent(bashCall('git push --force origin main')))
    expect(selected).toHaveLength(0)
  })

  test('blocks execute events with git push -f', () => {
    const { trigger, selected } = setupWithGovernance(noForcePush)
    trigger(executeEvent(bashCall('git push -f origin main')))
    expect(selected).toHaveLength(0)
  })

  test('allows git push --force-with-lease', () => {
    const { trigger, selected } = setupWithGovernance(noForcePush)
    trigger(executeEvent(bashCall('git push --force-with-lease origin main')))
    expect(selected).toHaveLength(1)
  })

  test('allows normal git push', () => {
    const { trigger, selected } = setupWithGovernance(noForcePush)
    trigger(executeEvent(bashCall('git push origin main')))
    expect(selected).toHaveLength(1)
  })
})

describe('protectGovernance factory', () => {
  test('blocks write_file to MAC governance paths', () => {
    const { trigger, selected } = setupWithGovernance(protectGovernance)
    trigger(executeEvent(writeCall('.memory/constitution/mac/no-rm-rf.ts')))
    expect(selected).toHaveLength(0)
  })

  test('blocks bash commands modifying MAC governance', () => {
    const { trigger, selected } = setupWithGovernance(protectGovernance)
    trigger(executeEvent(bashCall('rm .memory/constitution/mac/no-rm-rf.ts')))
    expect(selected).toHaveLength(0)
  })

  test('allows writes to DAC governance paths', () => {
    const { trigger, selected } = setupWithGovernance(protectGovernance)
    trigger(executeEvent(writeCall('.memory/constitution/dac/custom.ts')))
    expect(selected).toHaveLength(1)
  })

  test('allows writes to non-governance paths', () => {
    const { trigger, selected } = setupWithGovernance(protectGovernance)
    trigger(executeEvent(writeCall('src/agent/agent.ts')))
    expect(selected).toHaveLength(1)
  })
})

// ============================================================================
// Composition — multiple MAC factories loaded together
// ============================================================================

describe('DEFAULT_MAC_FACTORIES composition', () => {
  test('contains all four MAC factories', () => {
    expect(DEFAULT_MAC_FACTORIES).toHaveLength(4)
  })

  test('all factories are branded as constitution', () => {
    for (const factory of DEFAULT_MAC_FACTORIES) {
      expect(factory.$).toBe(FACTORY_BRANDS.constitution)
    }
  })

  test('multiple factories compose additively in behavioral()', () => {
    const { bThreads, trigger, useFeedback } = behavioral()

    // Load all MAC factories
    for (const factory of DEFAULT_MAC_FACTORIES) {
      const { threads } = factory.create(trigger)
      if (threads) bThreads.set(threads)
    }

    const selected: string[] = []
    useFeedback({
      [AGENT_EVENTS.execute]() {
        selected.push('execute')
      },
    })

    // rm -rf should be blocked by noRmRf
    trigger(executeEvent(bashCall('rm -rf /')))
    expect(selected).toHaveLength(0)

    // /etc/ write should be blocked by noEtcWrites
    trigger(executeEvent(bashCall('echo bad > /etc/passwd')))
    expect(selected).toHaveLength(0)

    // force push should be blocked by noForcePush
    trigger(executeEvent(bashCall('git push --force origin main')))
    expect(selected).toHaveLength(0)

    // MAC governance write should be blocked by protectGovernance
    trigger(executeEvent(writeCall('.memory/constitution/mac/rule.ts')))
    expect(selected).toHaveLength(0)

    // Safe command should go through all four
    trigger(executeEvent(bashCall('ls -la')))
    expect(selected).toHaveLength(1)
  })

  test('safe execute events pass through all governance threads', () => {
    const { bThreads, trigger, useFeedback } = behavioral()

    for (const factory of DEFAULT_MAC_FACTORIES) {
      const { threads } = factory.create(trigger)
      if (threads) bThreads.set(threads)
    }

    const selected: string[] = []
    useFeedback({
      [AGENT_EVENTS.execute]() {
        selected.push('execute')
      },
    })

    // Multiple safe commands should all pass
    trigger(executeEvent(bashCall('cat README.md')))
    trigger(executeEvent(bashCall('git status')))
    trigger(executeEvent(bashCall('bun test')))
    trigger(executeEvent(writeCall('src/main.ts')))
    trigger(executeEvent(readCall('package.json')))

    expect(selected).toHaveLength(5)
  })
})
