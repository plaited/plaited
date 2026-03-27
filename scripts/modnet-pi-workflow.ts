import { join } from 'node:path'

export type ReviewPrompt = {
  id: string
  title: string
  prompt: string
  hint: string | null
  source: 'catalog'
  patternFamily: string | null
  scale: string | null
}

export type PiPlan = {
  rewriteBrief: string
  rationale: string
  strategyLabel: string
}

export type CandidateMss = {
  contentType: string
  structure: string
  mechanics: string[]
  boundary: string
  scale: number
}

export type GeneratedCandidate = {
  title: string
  prompt: string
  mss: CandidateMss
  note: string
}

export type ContextDocument = {
  path: string
  content: string
}

export type ContextBundle = {
  documents: ContextDocument[]
}

export type WorkflowMode = 'refine' | 'derive'

export const DEFAULT_CONTEXT_PATHS = [
  join('dev-research', 'training-prompts', 'program.md'),
  join('docs', 'MODNET-HUMAN-CLI-SPEC.md'),
  join('skills', 'modnet-modules', 'SKILL.md'),
  join('skills', 'mss-vocabulary', 'SKILL.md'),
  join('skills', 'mss-vocabulary', 'references', 'modnet-standards-distilled.md'),
  join('skills', 'mss-vocabulary', 'references', 'structural-ia-distilled.md'),
  join('skills', 'mss-vocabulary', 'references', 'valid-combinations.md'),
] as const

export const loadContextBundle = async (paths: readonly string[] = DEFAULT_CONTEXT_PATHS): Promise<ContextBundle> => {
  const documents: ContextDocument[] = []

  for (const path of paths) {
    const file = Bun.file(path)
    if (!(await file.exists())) {
      continue
    }

    const content = (await file.text()).trim()
    if (!content) {
      continue
    }

    documents.push({
      path,
      content,
    })
  }

  return { documents }
}

export const renderContextBundle = (bundle: ContextBundle): string =>
  bundle.documents
    .map(
      (document) => `FILE: ${document.path}
${document.content}`,
    )
    .join('\n\n')

export const buildPiPlanPrompt = ({
  mode,
  context,
  prompt,
  feedback,
  strategyNote,
  workerIndex,
  attemptIndex,
}: {
  mode: WorkflowMode
  context: ContextBundle
  prompt: ReviewPrompt
  feedback: string
  strategyNote: string
  workerIndex: number
  attemptIndex: number
}) => `Use the shared modnet context below to create a strategy brief for a generator model.

You are not generating the final prompt.
You are producing a variation brief that will be passed to a downstream generator.

SHARED CONTEXT
${renderContextBundle(context)}

SOURCE PROMPT
- id: ${prompt.id}
- title: ${prompt.title}
- prompt: ${prompt.prompt}

WORK MODE
- mode: ${mode}
- expectation: ${mode === 'derive' ? 'create a smaller-scale standalone child prompt' : 'rewrite or improve the source prompt'}

HUMAN FEEDBACK
${feedback || 'None'}

SEARCH CONTEXT
- worker: ${workerIndex}
- attempt: ${attemptIndex}
- strategy note: ${strategyNote}

Return a single JSON object with:
- rewriteBrief: one concise brief for the generator
- rationale: one short sentence about what this attempt is optimizing
- strategyLabel: a short label for this attempt

Output rules:
- Return the JSON only once
- Wrap it exactly in <json> and </json>
- Do not include markdown fences
- Do not include any text before <json> or after </json>

Example:
<json>
{"rewriteBrief":"...","rationale":"...","strategyLabel":"..."}
</json>`

export const buildGeneratorPrompt = ({
  mode,
  context,
  prompt,
  feedback,
  plan,
}: {
  mode: WorkflowMode
  context: ContextBundle
  prompt: ReviewPrompt
  feedback: string
  plan: PiPlan
}) => `Generate a single ${mode === 'derive' ? 'lower-scale derived' : 'improved'} modnet training prompt.

SHARED CONTEXT
${renderContextBundle(context)}

SOURCE PROMPT
- id: ${prompt.id}
- title: ${prompt.title}
- prompt: ${prompt.prompt}

HUMAN FEEDBACK
${feedback || 'None'}

PI STRATEGY BRIEF
- strategyLabel: ${plan.strategyLabel}
- rationale: ${plan.rationale}
- rewriteBrief: ${plan.rewriteBrief}

${
  mode === 'derive'
    ? `Derive a smaller-scale standalone training prompt from the source prompt. Keep clear family continuity, but make the result independently useful without needing parent lineage. The MSS scale should be plausibly lower than the parent prompt.`
    : `Return a single JSON object for a revised training prompt. Keep it standalone, concrete, and suitable for direct human review.`
}`

export const buildJudgePrompt = ({
  mode,
  context,
  prompt,
  feedback,
  candidate,
}: {
  mode: WorkflowMode
  context: ContextBundle
  prompt: ReviewPrompt
  feedback: string
  candidate: GeneratedCandidate
}) => `Judge this candidate modnet training prompt against the shared context and source prompt.

SHARED CONTEXT
${renderContextBundle(context)}

SOURCE PROMPT
- id: ${prompt.id}
- title: ${prompt.title}
- prompt: ${prompt.prompt}

HUMAN FEEDBACK
${feedback || 'None'}

CANDIDATE
- title: ${candidate.title}
- prompt: ${candidate.prompt}
- note: ${candidate.note}
- mss.contentType: ${candidate.mss.contentType}
- mss.structure: ${candidate.mss.structure}
- mss.mechanics: ${candidate.mss.mechanics.join(', ')}
- mss.boundary: ${candidate.mss.boundary}
- mss.scale: ${candidate.mss.scale}

Use this fixed rubric:
- prompt usefulness as a standalone training example
- coherence with the shared modnet/MSS context
- fit to the source prompt and human feedback
- clarity and boundedness of the MSS tags
${mode === 'derive' ? '- plausibility as a lower-scale building block of the source prompt' : ''}

Return a JSON object with:
- pass: boolean
- score: number in [0,1]
- rationale: short explanation`
