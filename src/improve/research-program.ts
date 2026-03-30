export type ResearchDecision = 'keep' | 'revise' | 'discard'

export type ResearchValidationResult = {
  passed: boolean
  notes: string
  command: string[]
}

export type ResearchScopeCheckResult = {
  passed: boolean
  notes: string
  allowedPaths: string[]
}

export type ResearchStageLogEntry = {
  at: string
  stage: string
  message: string
}

export type ResearchProgramDocument = {
  path: string
  text: string
  scopePaths: string[]
}

export type ResearchProgramContext = {
  program: ResearchProgramDocument
  prompt: string
  allowedPaths: string[]
}

const timestamp = (): string => new Date().toISOString()

const normalizePath = (path: string): string => path.replace(/\\/g, '/')

export const requireMarkdown = async (path: string, headings: string[]): Promise<string> => {
  const file = Bun.file(path)
  if (!(await file.exists())) throw new Error(`Missing file: ${path}`)
  const text = await file.text()
  for (const heading of headings) {
    if (!text.includes(heading)) throw new Error(`Missing heading "${heading}" in ${path}`)
  }
  return text
}

export const parseProgramScope = (program: string): string[] => {
  const match = program.match(/## (?:Scope|Writable Roots)\s*\n([\s\S]*?)(?:\n## |\s*$)/)
  if (!match) return []
  const section = match[1]
  if (!section) return []

  return section
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.startsWith('- '))
    .map((line) => line.slice(2).trim())
    .flatMap((line) => {
      const spans = [...line.matchAll(/`([^`]+)`/g)].map((span) => span[1] ?? '')
      if (spans.length > 0) return spans
      const cleaned = line.replace(/`/g, '')
      return /^[A-Za-z0-9._/-]+\.(md|ts|tsx|js|jsx|json)$/.test(cleaned) || cleaned.endsWith('/') ? [cleaned] : []
    })
    .map((line) => line.replace(/\*+$/u, ''))
    .map((line) => line.replace(/^\.\//u, ''))
    .map(normalizePath)
    .filter(Boolean)
}

export const checkResearchScope = (changedFiles: string[], allowedPaths: string[]): ResearchScopeCheckResult => {
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

export const buildResearchPrompt = (program: string): string =>
  [
    'Execution mode:',
    '- Use an autoresearch-style workflow for this bounded development program.',
    '- The architecture is decided by the program file below.',
    '- Make one bounded attempt, run validation, and state whether the result should be kept or revised.',
    '',
    'Program:',
    program,
  ].join('\n')

export const loadResearchProgramContext = async ({
  defaultAllowedPaths,
  programPath,
}: {
  defaultAllowedPaths: string[]
  programPath: string
}): Promise<ResearchProgramContext> => {
  const program = await requireMarkdown(programPath, ['## Mission', '## Fixed Architecture', '## Validation'])
  const scopePaths = parseProgramScope(program)

  return {
    program: {
      path: programPath,
      text: program,
      scopePaths,
    },
    prompt: buildResearchPrompt(program),
    allowedPaths: scopePaths.length > 0 ? scopePaths : defaultAllowedPaths,
  }
}

export const createStageLogger = (quiet: boolean, stageLog: ResearchStageLogEntry[]) => {
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
