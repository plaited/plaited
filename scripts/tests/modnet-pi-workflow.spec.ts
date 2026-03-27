import { describe, expect, test } from 'bun:test'
import {
  buildGeneratorPrompt,
  buildJudgePrompt,
  buildPiPlanPrompt,
  type ContextBundle,
  type GeneratedCandidate,
  type PiPlan,
  type ReviewPrompt,
  renderContextBundle,
} from '../modnet-pi-workflow.ts'

const context: ContextBundle = {
  documents: [
    {
      path: 'dev-research/training-prompts/program.md',
      content: 'Program context for modnet review.',
    },
    {
      path: 'docs/Structural-IA.md',
      content: 'Structural IA context.',
    },
  ],
}

const reviewPrompt: ReviewPrompt = {
  id: 'launchfile-xcmd',
  title: 'launchfile-xcmd',
  prompt: 'Build a bounded launcher for opening files with the system handler.',
  hint: null,
  source: 'catalog',
  patternFamily: null,
  scale: null,
}

const plan: PiPlan = {
  rewriteBrief: 'Emphasize bounded local file launch behavior.',
  rationale: 'Optimize for concrete utility.',
  strategyLabel: 'bounded-launch',
}

const candidate: GeneratedCandidate = {
  title: 'Local File Launcher',
  prompt: 'Build a bounded local utility for launching files with their system handler.',
  note: 'Focus on a single launch job.',
  mss: {
    contentType: 'file-launch-action',
    structure: 'steps',
    mechanics: ['launch'],
    boundary: 'none',
    scale: 1,
  },
}

describe('modnet Pi workflow prompts', () => {
  test('renderContextBundle includes file paths and content', () => {
    const rendered = renderContextBundle(context)

    expect(rendered).toContain('FILE: dev-research/training-prompts/program.md')
    expect(rendered).toContain('Program context for modnet review.')
    expect(rendered).toContain('FILE: docs/Structural-IA.md')
    expect(rendered).toContain('Structural IA context.')
  })

  test('buildPiPlanPrompt frames Pi as strategy-only', () => {
    const prompt = buildPiPlanPrompt({
      mode: 'refine',
      context,
      prompt: reviewPrompt,
      feedback: 'Make it more concrete.',
      strategyNote: 'favor bounded utility',
      workerIndex: 2,
      attemptIndex: 4,
    })

    expect(prompt).toContain('You are not generating the final prompt.')
    expect(prompt).toContain('strategy note: favor bounded utility')
    expect(prompt).toContain('Build a bounded launcher for opening files with the system handler.')
    expect(prompt).toContain('<json>')
    expect(prompt).toContain('</json>')
  })

  test('buildGeneratorPrompt includes shared context and Pi brief', () => {
    const prompt = buildGeneratorPrompt({
      mode: 'refine',
      context,
      prompt: reviewPrompt,
      feedback: 'Make it more concrete.',
      plan,
    })

    expect(prompt).toContain('SHARED CONTEXT')
    expect(prompt).toContain('Program context for modnet review.')
    expect(prompt).toContain('PI STRATEGY BRIEF')
    expect(prompt).toContain('bounded-launch')
    expect(prompt).toContain('Make it more concrete.')
  })

  test('buildJudgePrompt uses fixed rubric and excludes Pi strategy brief', () => {
    const prompt = buildJudgePrompt({
      mode: 'refine',
      context,
      prompt: reviewPrompt,
      feedback: 'Make it more concrete.',
      candidate,
    })

    expect(prompt).toContain('Use this fixed rubric:')
    expect(prompt).toContain('prompt usefulness as a standalone training example')
    expect(prompt).toContain('coherence with the shared modnet/MSS context')
    expect(prompt).toContain('fit to the source prompt and human feedback')
    expect(prompt).not.toContain('PI STRATEGY BRIEF')
    expect(prompt).not.toContain('bounded-launch')
  })

  test('derive mode asks for lower-scale child behavior', () => {
    const generatorPrompt = buildGeneratorPrompt({
      mode: 'derive',
      context,
      prompt: reviewPrompt,
      feedback: 'Break this into a smaller useful block.',
      plan,
    })
    const judgePrompt = buildJudgePrompt({
      mode: 'derive',
      context,
      prompt: reviewPrompt,
      feedback: 'Break this into a smaller useful block.',
      candidate,
    })

    expect(generatorPrompt).toContain('lower-scale derived')
    expect(generatorPrompt).toContain('Derive a smaller-scale standalone training prompt')
    expect(judgePrompt).toContain('plausibility as a lower-scale building block of the source prompt')
  })
})
