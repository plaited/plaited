import { describe, expect, test } from 'bun:test'
import { grade } from '../improve-native-model-validation-grader.ts'

describe('improve native-model validation grader', () => {
  test('accepts calibrated module-outline vocabulary variants', async () => {
    const result = await grade({
      input: 'ignored',
      output: [
        '## Overview',
        'This module records a daily journal check-in inside a sovereign personal node.',
        '## MSS Tags',
        '- module',
        '- mss',
        '## Repo Shape',
        'Keep runtime wiring local-first with provenance stored beside the journal artifacts.',
        '## Agent Guidance',
        'The agent guidance includes one behavioral program loop for check-in prompts and replies.',
        '## Runtime Wiring',
        'A bthread reacts to each event signal and persists local provenance for the agent node.',
      ].join('\n'),
      metadata: {
        themeId: 'mss-grounded-module-generation',
        taskType: 'module-outline',
        judge: {
          requiredConcepts: ['module', 'mss', 'agent', 'runtime', 'provenance'],
          alignmentSignals: [
            'behavioral|behavioral loop|behavioral program',
            'node|agent node|personal node',
            'journal|check-in|check in',
            'local-first|local first',
            'provenance|local provenance',
          ],
          structureSignals: ['overview', 'mss tags', 'repo shape', 'agent guidance', 'runtime wiring'],
          dynamicSignals: ['event', 'loop', 'signal|signals', 'thread|bthread'],
          discouragedSignals: ['react app'],
        },
      },
    })

    expect(result.pass).toBe(true)
    expect(result.outcome?.nativeModelJudge).toEqual(
      expect.objectContaining({
        retentionLabel: 'retain_for_review',
      }),
    )
  })
})
