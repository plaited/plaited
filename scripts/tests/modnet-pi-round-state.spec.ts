import { describe, expect, test } from 'bun:test'
import {
  buildBlockedPromptIds,
  buildCompletedPromptIds,
  isRoundActionTerminal,
  pickReadyManifest,
  type RoundManifest,
} from '../modnet-pi-round-state.ts'

const sourcePrompt = {
  id: 'launchfile-xcmd',
  title: 'launchfile-xcmd',
  prompt: 'Build a bounded launcher.',
  hint: null,
  source: 'catalog' as const,
  patternFamily: null,
  scale: null,
}

describe('modnet Pi round state', () => {
  test('buildCompletedPromptIds includes accepted and rejected winners', () => {
    const completed = buildCompletedPromptIds([
      { id: 'a', action: 'keep' },
      { id: 'b', action: 'accept-winner' },
      { id: 'c', action: 'reject-winner' },
      { id: 'd', action: 'refine-again' },
    ])

    expect(completed.has('a')).toBe(true)
    expect(completed.has('b')).toBe(true)
    expect(completed.has('c')).toBe(true)
    expect(completed.has('d')).toBe(false)
  })

  test('buildBlockedPromptIds includes running and completed-unresolved rounds', () => {
    const manifests: RoundManifest[] = [
      {
        queuePromptId: 'a',
        promptId: 'a',
        promptTitle: 'a',
        mode: 'refine',
        feedback: 'x',
        roundNumber: 1,
        sourcePrompt,
        createdAt: '2026-03-25T10:00:00.000Z',
        status: 'running',
      },
      {
        queuePromptId: 'b',
        promptId: 'b',
        promptTitle: 'b',
        mode: 'derive',
        feedback: 'x',
        roundNumber: 1,
        sourcePrompt,
        createdAt: '2026-03-25T10:00:00.000Z',
        completedAt: '2026-03-25T10:01:00.000Z',
        status: 'completed',
      },
      {
        queuePromptId: 'c',
        promptId: 'c',
        promptTitle: 'c',
        mode: 'refine',
        feedback: 'x',
        roundNumber: 1,
        sourcePrompt,
        createdAt: '2026-03-25T10:00:00.000Z',
        completedAt: '2026-03-25T10:01:00.000Z',
        resolvedAt: '2026-03-25T10:02:00.000Z',
        status: 'accepted',
      },
    ]

    const blocked = buildBlockedPromptIds(manifests)
    expect(blocked.has('a')).toBe(true)
    expect(blocked.has('b')).toBe(true)
    expect(blocked.has('c')).toBe(false)
  })

  test('pickReadyManifest selects earliest completed unresolved round', () => {
    const earliest: RoundManifest = {
      queuePromptId: 'a',
      promptId: 'a',
      promptTitle: 'a',
      mode: 'refine',
      feedback: 'x',
      roundNumber: 1,
      sourcePrompt,
      createdAt: '2026-03-25T10:00:00.000Z',
      completedAt: '2026-03-25T10:01:00.000Z',
      status: 'completed',
    }
    const later: RoundManifest = {
      ...earliest,
      queuePromptId: 'b',
      promptId: 'b',
      promptTitle: 'b',
      completedAt: '2026-03-25T10:02:00.000Z',
    }

    expect(isRoundActionTerminal('accepted')).toBe(true)
    expect(isRoundActionTerminal('running')).toBe(false)
    expect(pickReadyManifest([later, earliest])?.queuePromptId).toBe('a')
  })
})
