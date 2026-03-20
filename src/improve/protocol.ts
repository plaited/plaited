export type ImprovementAttemptDecision = 'keep' | 'revise' | 'discard'

export type ImprovementValidationResult = {
  passed: boolean
  notes: string
  command: string[]
}

export type ImprovementScopeCheckResult = {
  passed: boolean
  notes: string
  allowedPaths: string[]
}

export type ImprovementStageLogEntry = {
  at: string
  stage: string
  message: string
}

export type ImprovementProgramDocument = {
  path: string
  text: string
}

export type ImprovementSliceDocument = {
  id: string
  path: string
  text: string
  scopePaths: string[]
}

export type ImprovementProtocolContext = {
  program: ImprovementProgramDocument
  slice: ImprovementSliceDocument
  prompt: string
  allowedPaths: string[]
}

const timestamp = (): string => new Date().toISOString()

const normalizePath = (path: string): string => path.replace(/\\/g, '/')

const getSliceDirectory = (slicePath: string): string => {
  const normalized = normalizePath(slicePath)
  const index = normalized.lastIndexOf('/')
  return index === -1 ? '.' : normalized.slice(0, index)
}

export const resolveProgramPath = (slicePath: string, explicitProgramPath?: string): string =>
  explicitProgramPath ?? `${getSliceDirectory(slicePath)}/program.md`

export const requireMarkdown = async (path: string, headings: string[]): Promise<string> => {
  const file = Bun.file(path)
  if (!(await file.exists())) throw new Error(`Missing file: ${path}`)
  const text = await file.text()
  for (const heading of headings) {
    if (!text.includes(heading)) throw new Error(`Missing heading "${heading}" in ${path}`)
  }
  return text
}

export const parseSliceScope = (slice: string): string[] => {
  const match = slice.match(/## Scope\s*\n([\s\S]*?)(?:\n## |\s*$)/)
  if (!match) return []
  const section = match[1]
  if (!section) return []

  return section
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim())
    .flatMap((line) => {
      const spans = [...line.matchAll(/`([^`]+\/[^`]*)`/g)].map((span) => span[1] ?? '')
      if (spans.length > 0) return spans
      return line.includes('/') ? [line.replace(/`/g, '')] : []
    })
    .filter((line) => line.includes('/'))
    .map((line) => line.replace(/\*+$/, ''))
    .map((line) => line.replace(/^\.\//, ''))
    .map(normalizePath)
    .filter(Boolean)
}

export const checkImproveScope = (changedFiles: string[], allowedPaths: string[]): ImprovementScopeCheckResult => {
  if (changedFiles.length === 0) {
    return {
      passed: false,
      notes: 'No files changed',
      allowedPaths,
    }
  }

  const invalid = changedFiles.filter((file) => !allowedPaths.some((prefix) => file.startsWith(prefix)))
  if (invalid.length > 0) {
    return {
      passed: false,
      notes: `Out-of-scope files changed: ${invalid.join(', ')}`,
      allowedPaths,
    }
  }

  return {
    passed: true,
    notes: `${changedFiles.length} in-scope file(s) changed`,
    allowedPaths,
  }
}

export const buildImprovePrompt = (program: string, slice: string): string =>
  [
    'Execution mode:',
    '- Use an autoresearch-style workflow for this bounded development slice.',
    '- The architecture is already decided by the program and slice files below.',
    '- Make one bounded attempt, run validation, and state whether the result should be kept or revised.',
    '',
    'Program:',
    program,
    '',
    'Slice:',
    slice,
  ].join('\n')

export const loadImprovementProtocolContext = async ({
  defaultAllowedPaths,
  programPath,
  slicePath,
}: {
  defaultAllowedPaths: string[]
  programPath: string
  slicePath: string
}): Promise<ImprovementProtocolContext> => {
  const program = await requireMarkdown(programPath, [
    '## Mission',
    '## Fixed Architecture',
    '## Runtime Taxonomy',
    '## Validation',
  ])
  const slice = await requireMarkdown(slicePath, ['# Slice', '## Target', '## Acceptance Criteria'])
  const scopePaths = parseSliceScope(slice)

  return {
    program: {
      path: programPath,
      text: program,
    },
    slice: {
      id: basenameWithoutExt(slicePath),
      path: slicePath,
      text: slice,
      scopePaths,
    },
    prompt: buildImprovePrompt(program, slice),
    allowedPaths: scopePaths.length > 0 ? scopePaths : defaultAllowedPaths,
  }
}

export const createStageLogger = (quiet: boolean, stageLog: ImprovementStageLogEntry[]) => {
  return (stage: string, message: string) => {
    stageLog.push({
      at: timestamp(),
      stage,
      message,
    })
    if (quiet) return
    console.log(`[${stageLog.at(-1)?.at ?? timestamp()}] ${stage} ${message}`)
  }
}

const basename = (path: string): string => {
  const normalized = normalizePath(path)
  const index = normalized.lastIndexOf('/')
  return index === -1 ? normalized : normalized.slice(index + 1)
}

const basenameWithoutExt = (path: string): string => basename(path).replace(/\.[^.]+$/, '')
