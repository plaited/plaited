#!/usr/bin/env bun

import { join } from 'node:path'

type PromptInput = string | string[]

type SeedReviewMetadata = {
  patternFamily?: string | null
  sourceLikelyPatternFamily?: string | null
  sourceLikelyStructure?: string | null
  generatedModernTitle?: string | null
  generatedPromptInput?: string | null
  generatedPromptHint?: string | null
  generatedScale?: string | null
  generatedScaleValue?: number | null
  generatedScaleLabel?: string | null
  sourceScaleEstimate?: number | null
  sourceScaleEstimateLabel?: string | null
  generatedLikelyPatternFamily?: string | null
  generatedLikelyStructure?: string | null
}

type SourceRecord = {
  title?: string
  description?: string
  coreUserJob?: string | null
  whyRelevant?: string | null
  mss?: {
    structure?: string | null
    scale?: number | null
  }
}

type PromptRow = {
  id: string
  input: PromptInput
  hint?: string | null
  metadata?: SeedReviewMetadata & Record<string, unknown>
  _source?: SourceRecord
  title?: string
  description?: string
  coreUserJob?: string | null
  whyRelevant?: string | null
  likelyPatternFamily?: string | null
  likelyStructure?: string | null
}

type HandcraftedPromptRow = {
  id: string
  input: string
  hint?: string | null
  metadata?: SeedReviewMetadata & {
    judge?: {
      requiredConcepts?: unknown
      alignmentSignals?: unknown
      structureSignals?: unknown
      dynamicSignals?: unknown
    }
  }
}

type HandcraftedSeedAnchor = {
  id: string
  family: string
  scale: 'S1' | 'S2' | 'S3'
  subjectStyle: string
  mechanism: string
  anchorTerms: string
  structure?: string
  structureSignal?: string
  subjectKeywordTokens?: string
  alignmentSignals?: ReadonlyArray<string>
  structureSignals?: ReadonlyArray<string>
  dynamicSignals?: ReadonlyArray<string>
  targetShapeHint?: string
}

type FamilyRoleVariant = {
  role: string
  affordances: ReadonlyArray<string>
  mechanics: ReadonlyArray<string>
}

type DerivedSeedContext = {
  sourceId: string
  rewrittenTitle: string
  rewrittenInput: string
  rewrittenHint: string
  sourceTitle: string
  sourceDescription: string
  sourceFamily: string
  sourceStructure: string
  sourceScale: number
  sourceScaleLabel: string
  sourceCoreUserJob: string
  sourceWhyRelevant: string
  sourceMechanics: string
  operationalLoop: string
  reusableActions: string
  sourceAnchors: string
  sourceGroundingAnchors: string
  sourceRoleVariants: string
  approvedParentAnchor: string
  approvedParentFamily: string
  approvedParentScale: string
  approvedParentMechanism: string
  approvedParentSubject: string
  handcraftedAnchorIds: string
  handcraftedAnchorTerms: string
  handcraftedAnchorMechanics: string
  chainImmediateParentScaleLabel: string
  chainImmediateParentPromptId: string
  chainImmediateParentMechanics: string
  chainImmediateParentReusableActions: string
  chainImmediateParentOperationalLoop: string
  chainImmediateParentShape: string
  chainImmediateParentRole?: string
  chainImmediateParentRoleAffordances?: string
  chainImmediateParentRoleCapability?: string
  chainImmediateParentShapeCapability: string
  precursorRoleVariant: string
  precursorRoleAffordances: string
  targetShapeTransferSignals: string
  targetShapeTransferMechanics: string
  targetShapeTransferStructureSignals: string
  targetShapeTransferDynamicSignals: string
  targetShapeTransferManifest: string
  targetShapeTransferTerms: string
  sourceShape?: string
  contributesToParentCapability?: string
}

type DerivedPrompt = {
  id: string
  sourceId: string
  targetScale: 'S1' | 'S2' | 'S3'
  input: string
  hint: string
  seedContext: DerivedSeedContext
  chain: {
    rootSourceId: string
    immediateParentPromptId: string
    expectedParentPromptId: string
    parentScaleLabel: string
    parentFamily: string
    parentMechanism: string
    parentSubject: string
    immediateParentMechanics: string
    immediateParentReusableActions: string
    immediateParentOperationalLoop: string
    immediateParentShape: string
    immediateParentRole: string
    immediateParentRoleAffordances: string
    chainImmediateParentCapability: string
    chainImmediateParentRole: string
    chainImmediateParentRoleAffordances: string
    chainImmediateParentRoleCapability: string
    chainImmediateParentShapeCapability: string
    chainPath: string[]
  }
}

type PrecursorShapeTemplate = {
  id: string
  label: string
  noun: string
  hintHint: string
  role?: string
  affordances?: ReadonlyArray<string>
}

const DEFAULT_INPUT = join(import.meta.dir, '..', 'dev-research', 'modnet', 'catalog', 'modnet-training-prompts.jsonl')
const DEFAULT_HANDCRAFTED_INPUT = join(
  import.meta.dir,
  '..',
  'dev-research',
  'modnet',
  'catalog',
  'modnet-training-prompts-handcrafted.jsonl',
)

const APPROVED_ANCHORS = [
  {
    id: 'hypercard_archimedes-discovering-pi',
    patternFamily: 'creative-tool',
    targetScale: 'S1' as const,
    subjectStyle: 'interactive demonstration object',
    mechanism: 'derive',
  },
  {
    id: 'hypercard_klingondictionary',
    patternFamily: 'reference-browser',
    targetScale: 'S2' as const,
    subjectStyle: 'lookup entry',
    mechanism: 'lookup',
  },
  {
    id: 'hypercard_1st-law-of-thermodynamics',
    patternFamily: 'educational-interactive',
    targetScale: 'S3' as const,
    subjectStyle: 'lesson sequence',
    mechanism: 'sequence',
  },
]

const STOP_WORDS = new Set([
  'the',
  'and',
  'for',
  'with',
  'that',
  'this',
  'from',
  'have',
  'their',
  'where',
  'when',
  'about',
  'which',
  'there',
  'also',
  'only',
  'into',
  'your',
  'its',
  'it',
  'they',
  'them',
  'can',
  'let',
  'lets',
  'just',
  'justs',
])

const FAMILY_ANCHORS: Record<string, string[]> = {
  'creative-tool': ['interactive', 'create', 'compose', 'edit', 'artifact'],
  'reference-browser': ['lookup', 'browse', 'reference', 'entry', 'search'],
  'educational-interactive': ['lesson', 'learn', 'quiz', 'practice', 'assessment'],
  'developer-utility': ['analyze', 'inspect', 'tool', 'workflow', 'action'],
  'personal-data-manager': ['record', 'history', 'profile', 'task', 'note'],
  communication: ['message', 'reply', 'thread', 'conversation', 'contact'],
  'business-process': ['workflow', 'status', 'task', 'schedule', 'project', 'coordination'],
  'instrument-control': ['input', 'control', 'session', 'log', 'instrument'],
  'multimedia-presentation': ['slide', 'screen', 'media', 'gallery'],
  'game-simulation': ['play', 'simulate', 'score', 'challenge', 'state'],
  unknown: ['module'],
}

const SHAPES_BY_SCALE: Record<DerivedPrompt['targetScale'], ReadonlyArray<PrecursorShapeTemplate>> = {
  S1: [
    {
      id: 'atom-card',
      label: 'Atom Card',
      noun: 'single card',
      hintHint: 'single reusable object focus',
    },
    {
      id: 'action-tile',
      label: 'Action Tile',
      noun: 'action tile',
      hintHint: 'small reusable action surface',
    },
  ],
  S2: [
    {
      id: 'index-list',
      label: 'Index List',
      noun: 'bounded list',
      hintHint: 'list, filter, and open detail',
    },
    {
      id: 'section-board',
      label: 'Section Board',
      noun: 'section board',
      hintHint: 'grouped module board',
    },
  ],
  S3: [
    {
      id: 'composition-stack',
      label: 'Composition Stack',
      noun: 'composition stack',
      hintHint: 'one progression edge and reusable composition',
    },
    {
      id: 'pipeline-board',
      label: 'Pipeline Board',
      noun: 'pipeline board',
      hintHint: 'bounded staged module flow',
    },
  ],
}

const FAMILY_SHAPES: Record<
  string,
  Partial<Record<DerivedPrompt['targetScale'], ReadonlyArray<PrecursorShapeTemplate>>>
> = {
  'creative-tool': {
    S1: [
      {
        id: 'playfield-cell',
        label: 'Playfield Cell',
        noun: 'playfield cell',
        hintHint: 'bounded creative unit',
      },
      {
        id: 'artifact-tile',
        label: 'Artifact Tile',
        noun: 'artifact tile',
        hintHint: 'one reusable creative artifact',
      },
    ],
    S2: [
      {
        id: 'collection-canvas',
        label: 'Collection Canvas',
        noun: 'collection canvas',
        hintHint: 'grouped creative entries with action hooks',
      },
      {
        id: 'playfield-registry',
        label: 'Playfield Registry',
        noun: 'entry registry',
        hintHint: 'list and inspect creative entries',
      },
    ],
    S3: [
      {
        id: 'experiment-stage',
        label: 'Experiment Stage',
        noun: 'experiment stage',
        hintHint: 'bounded composition and progression',
      },
      {
        id: 'proof-flow',
        label: 'Proof Flow',
        noun: 'proof flow',
        hintHint: 'ordered composition chain',
      },
    ],
  },
  'reference-browser': {
    S1: [
      {
        id: 'entry-chip',
        label: 'Entry Chip',
        noun: 'entry chip',
        hintHint: 'single lookup entry',
      },
      {
        id: 'definition-tile',
        label: 'Definition Tile',
        noun: 'definition tile',
        hintHint: 'compact referential object',
      },
    ],
    S2: [
      {
        id: 'entry-directory',
        label: 'Entry Directory',
        noun: 'entry directory',
        hintHint: 'bounded index and open detail',
      },
      {
        id: 'lookup-grid',
        label: 'Lookup Grid',
        noun: 'lookup grid',
        hintHint: 'searchable browsable collection',
      },
    ],
    S3: [
      {
        id: 'reference-map',
        label: 'Reference Map',
        noun: 'reference map',
        hintHint: 'cross-reference composition surface',
      },
      {
        id: 'dictionary-cluster',
        label: 'Dictionary Cluster',
        noun: 'dictionary cluster',
        hintHint: 'themed grouped references',
      },
    ],
  },
  'educational-interactive': {
    S1: [
      {
        id: 'lesson-surface',
        label: 'Lesson Surface',
        noun: 'lesson surface',
        hintHint: 'focused learning object',
      },
      {
        id: 'practice-card',
        label: 'Practice Card',
        noun: 'practice card',
        hintHint: 'task-level practice object',
      },
    ],
    S2: [
      {
        id: 'module-index',
        label: 'Module Index',
        noun: 'module index',
        hintHint: 'list of reusable learning steps',
      },
      {
        id: 'scenario-board',
        label: 'Scenario Board',
        noun: 'scenario board',
        hintHint: 'bounded scenario sequence list',
      },
    ],
    S3: [
      {
        id: 'learning-journey',
        label: 'Learning Journey',
        noun: 'learning journey',
        hintHint: 'bounded pedagogical stack',
      },
      {
        id: 'assessment-flow',
        label: 'Assessment Flow',
        noun: 'assessment flow',
        hintHint: 'multi-step learning composition',
      },
    ],
  },
}

const FAMILY_ROLE_AFFORDANCES: Record<string, ReadonlyArray<FamilyRoleVariant>> = {
  'creative-tool': [
    {
      role: 'object',
      affordances: ['create', 'edit', 'open', 'share'],
      mechanics: ['create', 'edit', 'open', 'share'],
    },
    {
      role: 'list',
      affordances: ['search', 'explore', 'browse', 'open'],
      mechanics: ['search', 'open', 'select'],
    },
    {
      role: 'board',
      affordances: ['compose', 'filter', 'open', 'track'],
      mechanics: ['compose', 'filter', 'open', 'track'],
    },
    {
      role: 'queue',
      affordances: ['prioritize', 'sort', 'track', 'open'],
      mechanics: ['track', 'sort', 'open', 'filter'],
    },
    {
      role: 'session',
      affordances: ['start', 'save', 'resume', 'share'],
      mechanics: ['create', 'open', 'update', 'share'],
    },
    {
      role: 'draft',
      affordances: ['draft', 'compose', 'review', 'open'],
      mechanics: ['create', 'compose', 'review', 'open'],
    },
  ],
  'reference-browser': [
    {
      role: 'lookup',
      affordances: ['lookup', 'open', 'filter', 'browse'],
      mechanics: ['search', 'open', 'select'],
    },
    {
      role: 'entry',
      affordances: ['organize', 'annotate', 'open', 'tag'],
      mechanics: ['organize', 'create', 'open', 'tag'],
    },
    {
      role: 'list',
      affordances: ['filter', 'sort', 'select', 'open'],
      mechanics: ['filter', 'sort', 'select', 'open'],
    },
    {
      role: 'session',
      affordances: ['organize', 'annotate', 'tag', 'share'],
      mechanics: ['open', 'share', 'track', 'organize'],
    },
    {
      role: 'board',
      affordances: ['compose', 'group', 'filter', 'open'],
      mechanics: ['compose', 'filter', 'open', 'track'],
    },
  ],
  'educational-interactive': [
    {
      role: 'teacher',
      affordances: ['explain', 'sequence', 'assess', 'share'],
      mechanics: ['sequence', 'review', 'open', 'track'],
    },
    {
      role: 'board',
      affordances: ['practice', 'review', 'repeat', 'quiz'],
      mechanics: ['practice', 'filter', 'open', 'review'],
    },
    {
      role: 'queue',
      affordances: ['prioritize', 'track', 'review', 'open'],
      mechanics: ['track', 'open', 'select', 'sort'],
    },
    {
      role: 'session',
      affordances: ['lesson', 'sequence', 'assess', 'save'],
      mechanics: ['sequence', 'review', 'save', 'open'],
    },
  ],
}

const DEFAULT_ROLE_AFFORDANCES: ReadonlyArray<FamilyRoleVariant> = [
  {
    role: 'object',
    affordances: ['create', 'open', 'update', 'share'],
    mechanics: ['create', 'open', 'update'],
  },
  {
    role: 'list',
    affordances: ['browse', 'filter', 'open', 'select'],
    mechanics: ['browse', 'filter', 'open'],
  },
  {
    role: 'board',
    affordances: ['compose', 'filter', 'track', 'open'],
    mechanics: ['compose', 'filter', 'open', 'track'],
  },
  {
    role: 'queue',
    affordances: ['filter', 'sort', 'open', 'select'],
    mechanics: ['filter', 'sort', 'open', 'select'],
  },
  {
    role: 'session',
    affordances: ['start', 'save', 'resume', 'share'],
    mechanics: ['start', 'save', 'open', 'share'],
  },
  {
    role: 'lookup',
    affordances: ['lookup', 'search', 'open', 'filter'],
    mechanics: ['search', 'open', 'select'],
  },
  {
    role: 'draft',
    affordances: ['draft', 'compose', 'review', 'open'],
    mechanics: ['create', 'compose', 'review', 'open'],
  },
]

const MECHANIC_VERBS = [
  'add',
  'add-to',
  'calculate',
  'check',
  'compose',
  'create',
  'delete',
  'edit',
  'filter',
  'generate',
  'list',
  'mark',
  'open',
  'play',
  'record',
  'review',
  'save',
  'search',
  'select',
  'share',
  'simulate',
  'sort',
  'track',
  'update',
  'view',
  'watch',
] as const

const MECHANIC_REPLACEMENTS = new Map([
  ['generate', 'create'],
  ['make', 'create'],
  ['build', 'create'],
  ['compose', 'create'],
  ['edit', 'update'],
  ['watch', 'view'],
  ['zoom', 'view'],
  ['check', 'validate'],
]) as Map<string, string>

const OPERATIONAL_LOOP_MARKERS = ['for each', 'one by one', 'while', 'until', 'repeat', 'step', 'loop']

const SCALE_PREFERRED_SHAPE_TOKENS: Record<DerivedPrompt['targetScale'], ReadonlyArray<string>> = {
  S1: ['card', 'tile', 'chip', 'surface', 'item', 'entry', 'object', 'unit'],
  S2: ['list', 'directory', 'index', 'board', 'grid', 'collection', 'registry', 'entries'],
  S3: ['stack', 'pipeline', 'journey', 'flow', 'stage', 'board', 'collection'],
}

const STRUCTURE_TO_SHAPE_HINT: Record<string, Record<DerivedPrompt['targetScale'], string>> = {
  object: {
    S1: 'card',
    S2: 'board',
    S3: 'stack',
  },
  list: {
    S1: 'card',
    S2: 'list',
    S3: 'board',
  },
  collection: {
    S1: 'board',
    S2: 'board',
    S3: 'stack',
  },
  entry: {
    S1: 'chip',
    S2: 'directory',
    S3: 'stack',
  },
  steps: {
    S1: 'tile',
    S2: 'board',
    S3: 'flow',
  },
  block: {
    S1: 'surface',
    S2: 'board',
    S3: 'pipeline',
  },
  wall: {
    S1: 'tile',
    S2: 'list',
    S3: 'wall',
  },
  hierarchy: {
    S1: 'card',
    S2: 'index',
    S3: 'pipeline',
  },
  unknown: {
    S1: 'card',
    S2: 'list',
    S3: 'stack',
  },
}

const normalizeShapeWord = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/(^-|-$)/g, '')

const FALLBACK_ANCHORS: Record<string, HandcraftedSeedAnchor[]> = {
  'creative-tool': [
    {
      id: 'hypercard_archimedes-discovering-pi',
      family: 'creative-tool',
      scale: 'S1',
      subjectStyle: 'interactive demonstration object',
      mechanism: 'derive',
      anchorTerms: 'derive interactive geometry',
    },
  ],
  'reference-browser': [
    {
      id: 'hypercard_klingondictionary',
      family: 'reference-browser',
      scale: 'S2',
      subjectStyle: 'lookup entry',
      mechanism: 'lookup',
      anchorTerms: 'dictionary lookup transliteration',
    },
  ],
  'educational-interactive': [
    {
      id: 'hypercard_1st-law-of-thermodynamics',
      family: 'educational-interactive',
      scale: 'S3',
      subjectStyle: 'lesson sequence',
      mechanism: 'sequence',
      anchorTerms: 'lesson sequence lesson module',
    },
  ],
  unknown: [
    {
      id: 'hypercard_archimedes-discovering-pi',
      family: 'creative-tool',
      scale: 'S1',
      subjectStyle: 'bounded modular card',
      mechanism: 'create',
      anchorTerms: 'bounded module task item',
    },
  ],
}

const readRows = async (path: string): Promise<PromptRow[]> => {
  const text = await Bun.file(path).text()
  return text
    .trim()
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as PromptRow)
}

const asString = (value: unknown): string => (typeof value === 'string' ? value : '')

const asNumber = (value: unknown): number | null => (typeof value === 'number' && Number.isFinite(value) ? value : null)

const asOptionalString = (value: unknown): string | undefined => {
  const sanitized = asString(value).trim()
  return sanitized.length > 0 ? sanitized : undefined
}

const asStringArray = (value: unknown): ReadonlyArray<string> => {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.length > 0)
}

const flattenInput = (value: PromptInput): string => (Array.isArray(value) ? value.join(' ') : value)

const normalizeText = (value: string): string =>
  value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const parseScaleFromRaw = (value: string | null | undefined): number | null => {
  if (!value) return null
  const match = /(?:^|[^\w])(?:scale[-_ ]*)?s?([1-8])(?:[^\w]|$)/i.exec(value)
  return match ? Number(match[1]!) : null
}

const getRequiredConceptScale = (concepts: unknown): number | null => {
  if (!Array.isArray(concepts)) return null
  for (const value of concepts) {
    if (typeof value !== 'string') continue
    const match = /^scale-S([1-8])$/i.exec(value)
    if (match) return Number(match[1]!)
  }
  return null
}

const pickScaleFromRow = (row: PromptRow): number | null => {
  const metadata = row.metadata ?? {}
  const concepts = getRequiredConceptScale(
    asRecord(metadata).judge ? asRecord((metadata as { judge?: unknown }).judge).requiredConcepts : [],
  )

  if (concepts !== null) return concepts

  const metadataScale =
    parseScaleFromRaw(metadata.generatedScale) ??
    parseScaleFromRaw(metadata.generatedScaleLabel) ??
    parseScaleFromRaw(metadata.sourceScaleEstimateLabel)
  if (metadataScale !== null) return metadataScale

  const numericScale =
    asNumber(metadata.generatedScaleValue) ??
    asNumber(metadata.sourceScaleEstimate) ??
    asNumber(row._source?.mss?.scale)
  if (numericScale !== null) return Math.max(1, Math.min(8, Math.round(numericScale)))

  return null
}

const pickScaleFromHandcraftedRow = (row: HandcraftedPromptRow): number | null => {
  const judgeConcepts = row.metadata?.judge ? asRecord(row.metadata.judge).requiredConcepts : undefined
  const conceptScale = getRequiredConceptScale(judgeConcepts)
  if (conceptScale !== null && conceptScale >= 1 && conceptScale <= 3) return conceptScale
  const idMatch = /-s([1-3])(?:\b|[-_])/.exec(row.id)
  if (idMatch) return Number(idMatch[1]!)
  return null
}

const inferSeedStructure = (row: HandcraftedPromptRow): string => {
  const rawJudgeConcepts = asRecord(row.metadata?.judge).requiredConcepts
  const judgeConcepts = Array.isArray(rawJudgeConcepts) ? (rawJudgeConcepts as unknown[]) : []
  const structure = judgeConcepts.find(
    (value): value is string => typeof value === 'string' && /^structure-/.test(value),
  )
  return structure !== undefined ? structure.replace('structure-', '').toLowerCase() : 'unknown'
}

const renderTargetShapeTransferManifest = (anchors: HandcraftedSeedAnchor[]): string => {
  if (anchors.length === 0) return ''
  return anchors
    .map(
      (anchor) =>
        `id:${anchor.id}|family:${anchor.family}|scale:${anchor.scale}|mechanism:${anchor.mechanism}|subject:${anchor.subjectStyle}|signals:${(
          anchor.alignmentSignals ?? []
        ).join(';')}`,
    )
    .join(' | ')
}

const collectSignalsText = (
  anchors: HandcraftedSeedAnchor[],
  field: 'alignmentSignals' | 'structureSignals' | 'dynamicSignals',
): string =>
  anchors
    .flatMap((anchor) => {
      const values = anchor[field]
      return Array.isArray(values) ? values.filter((value): value is string => value.length > 0) : []
    })
    .filter(Boolean)
    .slice(0, 24)
    .join(', ')

const buildTargetShapeTransferContext = (
  _targetScale: DerivedPrompt['targetScale'],
  anchors: HandcraftedSeedAnchor[],
) => {
  const transferable = anchors.slice(0, 3)
  const targetShapeTransferSignals = collectSignalsText(transferable, 'alignmentSignals')
  const targetShapeTransferMechanics = transferable
    .map((anchor) => anchor.mechanism)
    .filter(Boolean)
    .join(', ')
  const targetShapeTransferStructureSignals = collectSignalsText(transferable, 'structureSignals')
  const targetShapeTransferDynamicSignals = collectSignalsText(transferable, 'dynamicSignals')
  const targetShapeTransferManifest = renderTargetShapeTransferManifest(transferable)
  const targetShapeTransferTerms = transferable
    .map((anchor) => collectAnchorTerms(anchor.anchorTerms, anchor.subjectStyle, anchor.structureSignal ?? ''))
    .join(' ')

  return {
    targetShapeTransferSignals: dedupe(targetShapeTransferSignals.split(',').map((value) => value.trim())).join(', '),
    targetShapeTransferMechanics: dedupe(targetShapeTransferMechanics.split(',').map((value) => value.trim())).join(
      ', ',
    ),
    targetShapeTransferStructureSignals: dedupe(
      targetShapeTransferStructureSignals.split(',').map((value) => value.trim()),
    ).join(', '),
    targetShapeTransferDynamicSignals: dedupe(
      targetShapeTransferDynamicSignals.split(',').map((value) => value.trim()),
    ).join(', '),
    targetShapeTransferManifest: targetShapeTransferManifest,
    targetShapeTransferTerms: dedupe(targetShapeTransferTerms.split(' ').map((value) => value.trim())).join(' '),
  }
}

const collectAnchorTermTokens = (value: string): string[] =>
  normalizeText(value)
    .split(' ')
    .map((term) => term.trim())
    .filter((term) => term.length >= 4 && !STOP_WORDS.has(term))

const shapeHintTokenFromAnchor = (anchor: HandcraftedSeedAnchor, targetScale: DerivedPrompt['targetScale']): string => {
  const preferredShapeTokens = SCALE_PREFERRED_SHAPE_TOKENS[targetScale]
  const structure = anchor.structure ?? 'unknown'
  const structureHint = STRUCTURE_TO_SHAPE_HINT[structure]?.[targetScale]
  const termTokens = collectAnchorTermTokens(`${anchor.subjectStyle} ${anchor.anchorTerms}`)

  const preferredTerm = termTokens.find((term) => preferredShapeTokens.includes(term))
  const fallbackTerm =
    preferredTerm ??
    structureHint ??
    preferredShapeTokens[Math.min(preferredShapeTokens.length - 1, termTokens.length % preferredShapeTokens.length)] ??
    'module'

  return fallbackTerm
}

const seedShapeFromAnchor = (
  anchor: HandcraftedSeedAnchor,
  targetScale: DerivedPrompt['targetScale'],
): PrecursorShapeTemplate => {
  const shapePrefix = shapeHintTokenFromAnchor(anchor, targetScale)
  const slugParts = normalizeShapeWord(`${anchor.subjectStyle} ${anchor.family}`)
    .split('-')
    .filter((value) => value.length > 0)
    .slice(0, 3)
  const subjectShapeSlug =
    slugParts.length > 0 ? slugParts.join('-') : normalizeShapeWord(anchor.subjectStyle).slice(0, 24)
  const subjectNounTokens = collectAnchorTermTokens(anchor.subjectStyle).slice(0, 2)
  const shapeNounSuffix = subjectNounTokens.length > 0 ? subjectNounTokens.join(' ') : anchor.family
  const noun = `${shapePrefix} ${shapeNounSuffix}`.trim()

  return {
    id: normalizeShapeWord(`${targetScale.toLowerCase()}-${shapePrefix}-${subjectShapeSlug}`),
    label: `Seeded ${shapePrefix} for ${anchor.family}`,
    noun: noun.length > 0 ? noun : shapePrefix,
    hintHint: `handcrafted low-scale reference (${anchor.id})`,
    role: 'seeded',
    affordances: ['create', 'open', 'update', 'share'],
  }
}

const selectRoleProfiles = (family: string): ReadonlyArray<FamilyRoleVariant> =>
  FAMILY_ROLE_AFFORDANCES[family] ?? DEFAULT_ROLE_AFFORDANCES

const selectRoleProfilesForScale = (family: string, roleContextTokens: string[]): ReadonlyArray<FamilyRoleVariant> => {
  const roles = [...selectRoleProfiles(family)]
  if (roleContextTokens.length === 0) {
    return roles
  }

  const tokenSet = new Set(roleContextTokens.map((value) => normalizeShapeWord(value)))
  const prioritized = roles.filter((role) => tokenSet.has(normalizeShapeWord(role.role)))
  const rest = roles.filter((role) => !tokenSet.has(normalizeShapeWord(role.role)))
  return [...prioritized, ...rest]
}

const resolveRoleProfile = (family: string, role: string): FamilyRoleVariant | undefined =>
  selectRoleProfiles(family).find((entry) => normalizeShapeWord(entry.role) === normalizeShapeWord(role))

const deriveRoleAwareShapesForScale = (
  family: string,
  targetScale: DerivedPrompt['targetScale'],
  roleContextTokens: string[],
  handcraftedAnchorsByFamily: Map<string, HandcraftedSeedAnchor[]>,
): PrecursorShapeTemplate[] => {
  const roles = selectRoleProfilesForScale(family, roleContextTokens)
  const baseTemplatePool = FAMILY_SHAPES[family]?.[targetScale] ?? SHAPES_BY_SCALE[targetScale]

  const seedAnchors =
    handcraftedAnchorsByFamily.get(family) ??
    handcraftedAnchorsByFamily.get('unknown') ??
    FALLBACK_ANCHORS.unknown ??
    []
  const fallbackAnchor = seedAnchors[0]
  const seedHint = fallbackAnchor === undefined ? 'bounded module' : seedAnchors[0]!.anchorTerms
  const seedToken = collectAnchorTermTokens(seedHint)[0] ?? normalizeText(family).split(' ')[0] ?? 'module'
  const targetScaleValue = Number(targetScale.replace('S', ''))

  const templates: PrecursorShapeTemplate[] = []
  for (const role of roles.slice(0, 2)) {
    const roleToken = normalizeShapeWord(role.role)
    for (const base of baseTemplatePool.slice(0, 2)) {
      const nounAffix = roleContextTokens.length > 0 && targetScaleValue === 1 ? roleContextTokens[0]! : seedToken
      const roleShape: PrecursorShapeTemplate = {
        id: normalizeShapeWord(
          `${targetScale.toLowerCase()}-${roleToken}-${normalizeShapeWord(base.id)}-${nounAffix.slice(0, 12)}`,
        ),
        label: `${base.label} (${role.role})`,
        noun: `${roleToken} ${base.noun}`,
        hintHint: `role variant ${role.role} from ${role.affordances.join(' + ')}`,
        role: role.role,
        affordances: role.affordances,
      }
      templates.push(roleShape)
    }
  }

  return templates
}

const deriveHandcraftedShapesForScale = (
  family: string,
  targetScale: DerivedPrompt['targetScale'],
  byFamily: Map<string, HandcraftedSeedAnchor[]>,
): PrecursorShapeTemplate[] => {
  const anchors = byFamily.get(family) ?? byFamily.get('unknown') ?? FALLBACK_ANCHORS.unknown ?? []

  const targetScaleValue = Number(targetScale.replace('S', ''))
  const templateById = new Map<string, PrecursorShapeTemplate>()
  const prioritizedAnchors = [...anchors]
    .map((anchor, index) => ({ anchor, index }))
    .filter(({ anchor }) => {
      const anchorScaleValue = Number(anchor.scale.replace('S', ''))
      return anchorScaleValue <= targetScaleValue
    })
    .sort((left, right) => {
      const leftScaleDistance = targetScaleValue - Number(left.anchor.scale.replace('S', ''))
      const rightScaleDistance = targetScaleValue - Number(right.anchor.scale.replace('S', ''))
      if (leftScaleDistance !== rightScaleDistance) return leftScaleDistance - rightScaleDistance
      return left.index - right.index
    })
    .map(({ anchor }) => anchor)

  for (const anchor of prioritizedAnchors) {
    const anchorScaleValue = Number(anchor.scale.replace('S', ''))
    if (anchorScaleValue > targetScaleValue) continue
    const template = seedShapeFromAnchor(anchor, targetScale)
    templateById.set(template.id, template)
  }

  if (templateById.size === 0) {
    for (const anchor of FALLBACK_ANCHORS[family] ?? FALLBACK_ANCHORS.unknown ?? []) {
      templateById.set(
        normalizeShapeWord(seedShapeFromAnchor(anchor, targetScale).id),
        seedShapeFromAnchor(anchor, targetScale),
      )
    }
  }

  return [...templateById.values()]
}

const inferSeedMechanismFromText = (value: string): string => {
  const mechanism = asMechanicTokens(value)[0]
  return mechanism === undefined ? 'create' : mechanism
}

const inferSubjectStyleFromText = (value: string, fallback: string): string => {
  const normalized = normalizeText(value)
  const terms = normalized.split(' ').filter((term) => term.length >= 4 && !STOP_WORDS.has(term))
  if (terms.length > 0) return terms[0]!
  return fallback
}

const asHandcraftedAnchorRecord = (row: HandcraftedPromptRow): HandcraftedSeedAnchor | null => {
  const family = asString(row.metadata?.patternFamily)
  const scale = pickScaleFromHandcraftedRow(row)
  if (!family || !scale) return null

  const input = asString(row.input)
  const hint = asString(row.hint)
  const structure = inferSeedStructure(row)
  const structureSignal = collectAnchorTerms(structure, row.id).split(',')[0] ?? 'unknown'
  const judge = asRecord(row.metadata?.judge)
  const alignmentSignals = asStringArray(judge.alignmentSignals)
  const structureSignals = asStringArray(judge.structureSignals)
  const dynamicSignals = asStringArray(judge.dynamicSignals)
  const rawTargetShapeHint = asString(judge.targetShapeHint)
  const anchorTerms = collectAnchorTerms(input, hint).replace(/, /g, ' ')
  const subjectKeywordTokens = collectAnchorTermTokens(`${anchorTerms} ${structureSignal}`).slice(0, 12).join(' ')
  return {
    id: row.id,
    family,
    scale: `S${scale}` as HandcraftedSeedAnchor['scale'],
    subjectStyle: inferSubjectStyleFromText(`${input} ${hint}`, family),
    mechanism: inferSeedMechanismFromText(`${input} ${hint}`),
    anchorTerms,
    structure,
    structureSignal,
    alignmentSignals,
    structureSignals,
    dynamicSignals,
    targetShapeHint: rawTargetShapeHint.length > 0 ? rawTargetShapeHint : structure,
    subjectKeywordTokens,
  }
}

const loadHandcraftedAnchors = async (path: string): Promise<Map<string, HandcraftedSeedAnchor[]>> => {
  const text = await Bun.file(path).text()
  const rows = text
    .trim()
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => JSON.parse(line) as HandcraftedPromptRow)
    .map(asHandcraftedAnchorRecord)
    .filter((record): record is HandcraftedSeedAnchor => record !== null)

  const grouped = new Map<string, HandcraftedSeedAnchor[]>()
  for (const record of rows) {
    const existing = grouped.get(record.family) ?? []
    existing.push(record)
    grouped.set(record.family, existing)
  }

  for (const list of grouped.values()) {
    list.sort((left, right) => {
      const leftScale = Number(left.scale.replace('S', ''))
      const rightScale = Number(right.scale.replace('S', ''))
      return leftScale - rightScale
    })
  }

  return grouped
}

const asRecord = (value: unknown): Record<string, unknown> =>
  value && typeof value === 'object' ? (value as Record<string, unknown>) : {}

const stripSeedNoise = (value: string): string =>
  value
    .replace(/^build\s+me\s+/i, '')
    .replace(/^create\s+(me|a|an|one)\s+/i, '')
    .replace(/^generate\s+(me|a|an|one)\s+/i, '')
    .trim()

const dedupe = (values: string[]): string[] => {
  const seen = new Set<string>()
  return values.filter((value) => {
    if (seen.has(value)) return false
    seen.add(value)
    return true
  })
}

const asMechanicTokens = (value: string): string[] => {
  const normalized = normalizeText(value)
  if (!normalized) return []

  return dedupe(
    normalized
      .split(/\s+/)
      .filter((word) => word.length >= 3)
      .map((word) => MECHANIC_REPLACEMENTS.get(word) ?? word)
      .filter((word) => MECHANIC_VERBS.includes(word as (typeof MECHANIC_VERBS)[number])),
  )
}

const parseReusableActions = (value: string): string[] => asMechanicTokens(value)

const extractOperationalLoop = (value: string): string => {
  const normalized = normalizeText(value)
  return OPERATIONAL_LOOP_MARKERS.find((marker) => normalized.includes(marker)) ?? ''
}

const extractMechanics = (context: DerivedSeedContext): string[] => {
  const allText = [
    context.rewrittenTitle,
    context.rewrittenInput,
    context.rewrittenHint,
    context.sourceTitle,
    context.sourceDescription,
    context.sourceCoreUserJob,
    context.sourceWhyRelevant,
  ].join(' ')
  const mechanics = asMechanicTokens(allText)
  return mechanics.length > 0 ? mechanics : ['create']
}

const renderMechanics = (mechanics: string[]): string => mechanics.slice(0, 5).join(', ')

const describeReusableActionFlow = (context: DerivedSeedContext): string => {
  const candidateFlow = parseReusableActions(context.reusableActions)
  if (candidateFlow.length > 0) {
    return candidateFlow.slice(0, 4).join(' → ')
  }

  const fallbackFlow = parseReusableActions(context.sourceMechanics)
  if (fallbackFlow.length > 0) {
    return fallbackFlow.slice(0, 4).join(' → ')
  }

  return 'add → open → update'
}

const composeActionShape = (context: DerivedSeedContext, mechanismArg: string): string =>
  `${mechanismArg} and continue through reusable actions ${describeReusableActionFlow(context)}`

const reusableActionSignature = (mechanics: string[]): string =>
  mechanics.length > 0 ? mechanics.slice(0, 3).join(' → ') : 'create → view → update'

const collectAnchorTerms = (...values: string[]): string => {
  const terms = values
    .flatMap((value) => normalizeText(value).split(' '))
    .filter((value) => value.length >= 4 && !STOP_WORDS.has(value))

  const seen = new Set<string>()
  return terms
    .filter((term) => {
      if (seen.has(term)) return false
      seen.add(term)
      return true
    })
    .slice(0, 10)
    .join(', ')
}

const collectSeedAnchors = (seedContext: {
  rewrittenTitle: string
  rewrittenInput: string
  rewrittenHint: string
}): string => {
  return collectAnchorTerms(seedContext.rewrittenTitle, seedContext.rewrittenInput, seedContext.rewrittenHint)
}

const collectSourceAnchors = (seedContext: {
  sourceTitle: string
  sourceDescription: string
  sourceCoreUserJob: string
  sourceWhyRelevant: string
  sourceStructure: string
  sourceFamily: string
}): string => {
  return collectAnchorTerms(
    seedContext.sourceTitle,
    seedContext.sourceDescription,
    seedContext.sourceCoreUserJob,
    seedContext.sourceWhyRelevant,
    seedContext.sourceStructure,
    seedContext.sourceFamily,
  )
}

const selectLowScaleExemplars = (
  family: string,
  targetScale: 'S1' | 'S2' | 'S3',
  byFamily: Map<string, HandcraftedSeedAnchor[]>,
) => {
  const fallbackAnchors: HandcraftedSeedAnchor[] = FALLBACK_ANCHORS.unknown ?? []
  const familyFallback: HandcraftedSeedAnchor[] = FALLBACK_ANCHORS[family] ?? []
  const anchors: HandcraftedSeedAnchor[] = byFamily.get(family) ?? familyFallback ?? fallbackAnchors

  const targetScaleValue = Number(targetScale.replace('S', ''))
  const candidate = anchors.filter((anchor) => {
    const anchorScaleValue = Number(anchor.scale.replace('S', ''))
    return anchorScaleValue <= targetScaleValue
  })

  return candidate.length > 0 ? candidate.slice(0, 3) : anchors.slice(0, 3)
}

const buildApprovedAnchorContext = ({
  sourceId,
  family,
  sourceScale,
  mechanism,
  subject,
}: {
  sourceId: string
  family: string
  sourceScale: number
  mechanism: string
  subject: string
}) => {
  const normalizedMechanism = mechanism.trim().length > 0 ? mechanism : 'build'
  const normalizedSubject = subject.trim().length > 0 ? subject : 'bounded module'

  if (sourceId.trim().length > 0) {
    return {
      approvedParentAnchor: sourceId,
      approvedParentFamily: family,
      approvedParentScale: `S${Math.max(1, Math.min(8, Math.round(sourceScale)))}`,
      approvedParentMechanism: normalizedMechanism,
      approvedParentSubject: normalizedSubject,
    }
  }

  const approved = APPROVED_ANCHORS.find((entry) => entry.id === sourceId)
  if (approved) {
    return {
      approvedParentAnchor: approved.id,
      approvedParentFamily: approved.patternFamily,
      approvedParentScale: approved.targetScale,
      approvedParentMechanism: approved.mechanism,
      approvedParentSubject: approved.subjectStyle,
    }
  }

  const familyFallback = APPROVED_ANCHORS.find((entry) => entry.patternFamily === family)
  if (familyFallback) {
    return {
      approvedParentAnchor: familyFallback.id,
      approvedParentFamily: familyFallback.patternFamily,
      approvedParentScale: familyFallback.targetScale,
      approvedParentMechanism: familyFallback.mechanism,
      approvedParentSubject: familyFallback.subjectStyle,
    }
  }

  return {
    approvedParentAnchor: APPROVED_ANCHORS[0]!.id,
    approvedParentFamily: family,
    approvedParentScale: 'S1',
    approvedParentMechanism: 'build',
    approvedParentSubject: 'bounded module',
  }
}

const renderHandcraftedAnchorContext = (anchors: HandcraftedSeedAnchor[]) =>
  anchors.map((anchor) => `${anchor.id} (${anchor.scale})`).join(',')

const renderHandcraftedAnchorMechanics = (anchors: HandcraftedSeedAnchor[]) =>
  anchors.map((anchor) => anchor.mechanism).join(',')

const renderHandcraftedAnchorTerms = (anchors: HandcraftedSeedAnchor[]) =>
  anchors.map((anchor) => anchor.anchorTerms).join(' ')

const renderRoleVariants = (variants: ReadonlyArray<FamilyRoleVariant>) => variants.map((entry) => entry.role).join(',')

const renderRoleAffordances = (variants: ReadonlyArray<FamilyRoleVariant>) =>
  variants
    .flatMap((entry) => entry.affordances)
    .slice(0, 6)
    .join(',')

const getAnchorFromFamily = (family: string, fallback: string): string => {
  const anchors = FAMILY_ANCHORS[family] ?? FAMILY_ANCHORS.unknown
  return anchors && anchors.length > 0 ? anchors[0]! : fallback
}

const selectPrecursorShapes = (
  family: string,
  targetScale: DerivedPrompt['targetScale'],
  handcraftedAnchorsByFamily: Map<string, HandcraftedSeedAnchor[]>,
  roleContextTokens: string[] = [],
): ReadonlyArray<PrecursorShapeTemplate> => {
  const handcrafted = deriveHandcraftedShapesForScale(family, targetScale, handcraftedAnchorsByFamily)
  const familyShapes = FAMILY_SHAPES[family]?.[targetScale]
  const fallback = SHAPES_BY_SCALE[targetScale]
  const roleAware = deriveRoleAwareShapesForScale(family, targetScale, roleContextTokens, handcraftedAnchorsByFamily)
  const deduped = new Map<string, PrecursorShapeTemplate>()
  const dedupeById = (templates: ReadonlyArray<PrecursorShapeTemplate>) => {
    for (const template of templates) {
      if (!template.id) continue
      deduped.set(template.id, template)
    }
  }

  dedupeById(handcrafted)
  dedupeById(roleAware)
  dedupeById(familyShapes ?? [])
  dedupeById(fallback)

  return [...deduped.values()].slice(0, 4)
}

const buildS1Input = (context: DerivedSeedContext, mechanism: string, subject: string, shapeNoun: string): string => {
  const familyAnchor = getAnchorFromFamily(context.sourceFamily, 'object')
  return `Build one ${shapeNoun} ${subject} for ${context.rewrittenTitle} in the ${familyAnchor} family that ${composeActionShape(
    context,
    mechanism,
  )} on one bounded item.`
}

const buildS2Input = (context: DerivedSeedContext, mechanism: string, subject: string, shapeNoun: string): string => {
  const structure = context.sourceStructure.length > 0 ? context.sourceStructure : 'collection'
  const loopHint = context.operationalLoop.length > 0 ? ` with ${context.operationalLoop}` : ''
  return `Create a ${shapeNoun} ${structure} for ${context.rewrittenTitle} where many ${subject} entries are listed so users can ${composeActionShape(
    context,
    mechanism,
  )} and open a bounded detail view${loopHint}.`
}

const buildS3Input = (context: DerivedSeedContext, mechanism: string, subject: string, shapeNoun: string): string => {
  const loopHint = context.operationalLoop.length > 0 ? ` with ${context.operationalLoop} composition` : ''
  return `Build a grouped ${shapeNoun} ${context.sourceFamily} work surface for ${context.rewrittenTitle} that composes ${subject} modules into one reusable stage. ${composeActionShape(
    context,
    mechanism,
  )}${loopHint}.`
}

const contributionForTarget = (
  context: DerivedSeedContext,
  targetScale: DerivedPrompt['targetScale'],
  mechanism: string,
): string => {
  const approvedParentSubject = context.approvedParentSubject || context.sourceFamily || 'module'
  const familyMechanism = mechanism || context.approvedParentMechanism || 'compose'

  if (targetScale === 'S1') {
    return `Provides one reusable ${approvedParentSubject} primitive that the parent can open, inspect, and act on through ${familyMechanism}.`
  }
  if (targetScale === 'S2') {
    return `Provides a bounded ${approvedParentSubject} directory used by the parent to filter, browse, and open concrete items.`
  }
  return `Provides one reusable ${approvedParentSubject} stage for parent-level sequencing and reuse.`
}

const buildHintsByScale = (
  context: DerivedSeedContext,
  shape: PrecursorShapeTemplate,
  subject: string,
  targetScale: DerivedPrompt['targetScale'],
) => {
  const roleLabel = shape.role ?? 'builder'
  const roleAffordances = (shape.affordances ?? ['create', 'open', 'update']).join(', ')
  const seedAnchors = context.sourceAnchors
  const groundingAnchors = context.sourceGroundingAnchors
  const reusableActionFlow = describeReusableActionFlow(context)
  const shapeHint = `Precursor shape: ${shape.label} (${shape.hintHint}).`
  const approvedSignal = `approved parent=${context.approvedParentAnchor} (${context.approvedParentFamily}/${context.approvedParentScale}); approved mechanism=${context.approvedParentMechanism}; subject=${context.approvedParentSubject}`
  const contributesToParentCapability = context.contributesToParentCapability ?? ''
  const shapeTransferHints = [
    context.targetShapeTransferSignals.length > 0
      ? `target shape transfer signals: ${context.targetShapeTransferSignals}`
      : '',
    context.targetShapeTransferMechanics.length > 0
      ? `target shape mechanics: ${context.targetShapeTransferMechanics}`
      : '',
    context.targetShapeTransferStructureSignals.length > 0
      ? `target structure signals: ${context.targetShapeTransferStructureSignals}`
      : '',
    context.targetShapeTransferDynamicSignals.length > 0
      ? `target dynamic signals: ${context.targetShapeTransferDynamicSignals}`
      : '',
    context.targetShapeTransferTerms.length > 0 ? `target-shape vocabulary: ${context.targetShapeTransferTerms}` : '',
    context.targetShapeTransferManifest.length > 0
      ? `target-shape transfer capsule: ${context.targetShapeTransferManifest}`
      : '',
    'Do not copy exemplar prose; transfer reusable structure/mechanics and target-shape intent only.',
  ].filter(Boolean)
  const shapeTransferHintText = shapeTransferHints.length > 0 ? `${shapeTransferHints.join('. ')}.` : ''
  const anchorSuffix = [
    seedAnchors.length > 0 ? `rewritten seed anchors: ${seedAnchors}` : '',
    groundingAnchors.length > 0 ? `source-grounding anchors: ${groundingAnchors}` : '',
    context.handcraftedAnchorIds.length > 0 ? `low-scale exemplars: ${context.handcraftedAnchorIds}` : '',
    context.handcraftedAnchorMechanics.length > 0 ? `low-scale mechanics: ${context.handcraftedAnchorMechanics}` : '',
    `reusable-action flow: ${reusableActionFlow}`,
    context.operationalLoop.length > 0 ? `source loop: ${context.operationalLoop}` : '',
    approvedSignal.length > 0 ? approvedSignal : '',
    context.chainImmediateParentScaleLabel.length > 0
      ? `immediate parent scale: ${context.chainImmediateParentScaleLabel}`
      : '',
    context.chainImmediateParentMechanics.length > 0
      ? `immediate parent mechanics: ${context.chainImmediateParentMechanics}`
      : '',
    context.chainImmediateParentReusableActions.length > 0
      ? `immediate parent reusable actions: ${context.chainImmediateParentReusableActions}`
      : '',
    roleLabel.length > 0 ? `precursor role: ${roleLabel}` : '',
    roleAffordances.length > 0 ? `precursor affordances: ${roleAffordances}` : '',
    context.precursorRoleVariant.length > 0 ? `row role variant: ${context.precursorRoleVariant}` : '',
    context.precursorRoleAffordances.length > 0 ? `row role affordances: ${context.precursorRoleAffordances}` : '',
    contributesToParentCapability.length > 0
      ? `contributes to parent capability: ${contributesToParentCapability}`
      : '',
  ]
    .filter(Boolean)
    .join(' ')
  const anchorSuffixText = anchorSuffix.length > 0 ? ` ${anchorSuffix}.` : ''

  if (targetScale === 'S1') {
    return `Derived S1 precursor for "${context.rewrittenTitle}". Anchor to ${subject} as a single ${
      context.sourceFamily
    } primitive. Use ${context.approvedParentSubject} mechanics and keep this bounded, concrete, and source-grounded. ${shapeTransferHintText} ${shapeHint}${anchorSuffixText}`.trim()
  }
  if (targetScale === 'S2') {
    return `Derived S2 precursor for "${context.rewrittenTitle}". Keep list/group behavior explicit, preserve parent mechanics (${context.approvedParentMechanism}), keep source intent explicit, and avoid module-shell abstractions. ${shapeTransferHintText} ${shapeHint}${anchorSuffixText}`.trim()
  }
  return `Derived S3 precursor for "${context.rewrittenTitle}". Keep composition bounded and reusable as the lower-scale shell for ${context.approvedParentAnchor}. ${shapeTransferHintText} ${shapeHint}${anchorSuffixText}`.trim()
}

const chooseSubject = (context: DerivedSeedContext): string => {
  const exemplarTerms = normalizeText(context.handcraftedAnchorTerms)
    .split(' ')
    .filter((term) => term.length >= 4 && !STOP_WORDS.has(term))
  const titleTerms = normalizeText(context.rewrittenTitle)
    .split(' ')
    .filter((term) => term.length >= 4 && !STOP_WORDS.has(term))

  if (exemplarTerms.length > 0) return exemplarTerms[0]!
  if (titleTerms.length > 0) return titleTerms[0]!

  return context.approvedParentSubject || 'module item'
}

const canonicalShapeId = (shape: PrecursorShapeTemplate): string => {
  return shape.id.replace(/[^a-z0-9]+/gi, '-').toLowerCase()
}

const buildSeedContext = (
  row: PromptRow,
  handcraftedAnchorsByFamily: Map<string, HandcraftedSeedAnchor[]>,
): DerivedSeedContext => {
  const metadata = row.metadata ?? {}
  const source = row._source ?? {}
  const rawSourceScale = pickScaleFromRow(row)
  const sourceScale = rawSourceScale !== null ? rawSourceScale : 1

  const sourceTitle = asString(source.title) || asString(row.title) || row.id
  const sourceDescription = asString(source.description) || asString(row.description)
  const sourceFamily =
    asString(metadata.patternFamily) ||
    asString(metadata.sourceLikelyPatternFamily) ||
    asString(row.likelyPatternFamily) ||
    'unknown'
  const sourceStructure =
    asString(metadata.sourceLikelyStructure) ||
    asString(metadata.generatedLikelyStructure) ||
    asString(row.likelyStructure) ||
    asString(source.mss?.structure) ||
    'module'

  const rewrittenTitle =
    asOptionalString(metadata.generatedModernTitle) ??
    asOptionalString(sourceTitle) ??
    asOptionalString(stripSeedNoise(flattenInput(row.input))) ??
    sourceTitle
  const rewrittenInput =
    asOptionalString(metadata.generatedPromptInput) ??
    asOptionalString(sourceDescription) ??
    asOptionalString(stripSeedNoise(flattenInput(row.input))) ??
    sourceTitle
  const rewrittenHint =
    asOptionalString(metadata.generatedPromptHint) ?? asOptionalString(row.hint) ?? `${sourceFamily} precursor`

  const provisionalCoreUserJob = asString(source.coreUserJob) || asString(row.coreUserJob)
  const provisionalWhyRelevant = asString(source.whyRelevant) || asString(row.whyRelevant)
  const provisionalContext = {
    sourceId: row.id,
    rewrittenTitle,
    rewrittenInput,
    rewrittenHint,
    sourceTitle,
    sourceDescription,
    sourceFamily,
    sourceStructure,
    sourceScale,
    sourceCoreUserJob: provisionalCoreUserJob,
    sourceWhyRelevant: provisionalWhyRelevant,
  }
  const mechanics = asMechanicTokens(
    `${provisionalContext.rewrittenTitle} ${provisionalContext.rewrittenInput} ${provisionalContext.rewrittenHint} ${provisionalContext.sourceTitle} ${provisionalContext.sourceDescription} ${provisionalContext.sourceCoreUserJob} ${provisionalContext.sourceWhyRelevant}`,
  )
  const sourceMechanics = renderMechanics(mechanics)
  const operationalLoop = extractOperationalLoop(
    `${provisionalContext.rewrittenInput} ${provisionalContext.rewrittenHint} ${provisionalContext.sourceDescription}`,
  )
  const reusableActions = reusableActionSignature(mechanics)
  const approvedParentContext = buildApprovedAnchorContext({
    sourceId: row.id,
    family: provisionalContext.sourceFamily,
    sourceScale,
    mechanism: sourceMechanics,
    subject: rewrittenTitle,
  })
  const handcraftedAnchors = selectLowScaleExemplars(
    provisionalContext.sourceFamily,
    `S${Math.min(3, sourceScale)}` as 'S1' | 'S2' | 'S3',
    handcraftedAnchorsByFamily,
  )
  const handcraftedAnchorIds = renderHandcraftedAnchorContext(handcraftedAnchors)
  const handcraftedAnchorTerms = renderHandcraftedAnchorTerms(handcraftedAnchors)
  const handcraftedAnchorMechanics = renderHandcraftedAnchorMechanics(handcraftedAnchors)
  const roleVariants = selectRoleProfiles(provisionalContext.sourceFamily)
  const rowRoleVariants = renderRoleVariants(roleVariants)
  const rowRoleAffordances = renderRoleAffordances(roleVariants)
  const baseShapeTransferContext = buildTargetShapeTransferContext('S3', handcraftedAnchors)

  const provisional: DerivedSeedContext = {
    sourceId: provisionalContext.sourceId,
    rewrittenTitle: provisionalContext.rewrittenTitle,
    rewrittenInput: provisionalContext.rewrittenInput,
    rewrittenHint: provisionalContext.rewrittenHint,
    sourceTitle: provisionalContext.sourceTitle,
    sourceDescription: provisionalContext.sourceDescription,
    sourceFamily: provisionalContext.sourceFamily,
    sourceStructure: provisionalContext.sourceStructure,
    sourceScale: provisionalContext.sourceScale,
    sourceCoreUserJob: provisionalContext.sourceCoreUserJob,
    sourceWhyRelevant: provisionalContext.sourceWhyRelevant,
    sourceMechanics,
    operationalLoop,
    reusableActions,
    approvedParentAnchor: approvedParentContext.approvedParentAnchor,
    approvedParentFamily: approvedParentContext.approvedParentFamily,
    approvedParentScale: approvedParentContext.approvedParentScale,
    approvedParentMechanism: approvedParentContext.approvedParentMechanism,
    approvedParentSubject: approvedParentContext.approvedParentSubject,
    handcraftedAnchorIds,
    handcraftedAnchorTerms,
    handcraftedAnchorMechanics,
    sourceScaleLabel: `S${Math.max(1, Math.min(8, sourceScale))}`,
    sourceAnchors: collectSeedAnchors({
      rewrittenTitle: provisionalContext.rewrittenTitle,
      rewrittenInput: provisionalContext.rewrittenInput,
      rewrittenHint: provisionalContext.rewrittenHint,
    }),
    sourceGroundingAnchors: collectSourceAnchors({
      sourceTitle: provisionalContext.sourceTitle,
      sourceDescription: provisionalContext.sourceDescription,
      sourceCoreUserJob: provisionalCoreUserJob,
      sourceWhyRelevant: provisionalWhyRelevant,
      sourceStructure: provisionalContext.sourceStructure,
      sourceFamily: provisionalContext.sourceFamily,
    }),
    sourceRoleVariants: rowRoleVariants,
    ...baseShapeTransferContext,
    chainImmediateParentScaleLabel: '',
    chainImmediateParentPromptId: '',
    chainImmediateParentMechanics: '',
    chainImmediateParentReusableActions: '',
    chainImmediateParentOperationalLoop: '',
    chainImmediateParentShape: '',
    chainImmediateParentRole: '',
    chainImmediateParentRoleAffordances: '',
    chainImmediateParentRoleCapability: '',
    chainImmediateParentShapeCapability: '',
    precursorRoleVariant: rowRoleVariants.split(',')[0] ?? '',
    precursorRoleAffordances: rowRoleAffordances,
    targetShapeTransferSignals: '',
    targetShapeTransferMechanics: '',
    targetShapeTransferStructureSignals: '',
    targetShapeTransferDynamicSignals: '',
    targetShapeTransferManifest: '',
    targetShapeTransferTerms: '',
  }

  return provisional
}

const getTargetChainParent = (
  context: DerivedSeedContext,
  rowId: string,
  targetScale: DerivedPrompt['targetScale'],
  handcraftedAnchorsByFamily: Map<string, HandcraftedSeedAnchor[]>,
  immediateParentRole = context.precursorRoleVariant,
  immediateParentRoleAffordances: ReadonlyArray<string> = [],
): {
  immediateParentPromptId: string
  parentScaleLabel: string
  parentFamily: string
  parentMechanism: string
  parentSubject: string
  immediateParentMechanics: string
  immediateParentReusableActions: string
  immediateParentOperationalLoop: string
  immediateParentShape: string
  immediateParentRole: string
  immediateParentRoleAffordances: string
  chainImmediateParentCapability: string
  chainImmediateParentRole: string
  chainImmediateParentRoleAffordances: string
  chainImmediateParentRoleCapability: string
  chainImmediateParentShapeCapability: string
  chainPath: string[]
} => {
  const mechanismSignal =
    context.approvedParentMechanism || context.sourceMechanics || context.reusableActions || 'create'
  const roleToken = immediateParentRole.trim() || context.sourceRoleVariants.split(',')[0] || 'builder'
  const roleProfile = resolveRoleProfile(context.sourceFamily, roleToken)
  const resolvedAffordances =
    immediateParentRoleAffordances.length > 0
      ? immediateParentRoleAffordances
      : (roleProfile?.affordances ?? context.precursorRoleAffordances.split(',').filter(Boolean))
  const roleAffordances = resolvedAffordances.filter((value) => value.length > 0)
  const roleAffordanceText = roleAffordances.length > 0 ? roleAffordances.join(',') : 'create,open,update'
  const roleMechanics = dedupe([
    mechanismSignal,
    ...asMechanicTokens(`${roleAffordanceText} ${context.sourceMechanics}`),
    ...(roleProfile?.mechanics ?? []),
  ]).join(', ')
  const roleActions = dedupe([...asMechanicTokens(context.reusableActions), ...asMechanicTokens(roleAffordanceText)])
    .slice(0, 6)
    .join(' ')
  const roleLoop =
    context.operationalLoop.length > 0
      ? context.operationalLoop
      : asString(`${mechanismSignal} ${roleMechanics}`).replace(/\s+/g, ' ').trim()
  const roleContribution = `${contributionForTarget(context, targetScale, mechanismSignal)} as ${roleToken} role`
  const capabilityFromShape = asMechanicTokens(
    `${mechanismSignal} ${roleAffordanceText} ${context.sourceMechanics} ${context.reusableActions}`,
  )
    .slice(0, 6)
    .join(', ')

  if (targetScale === 'S3') {
    return {
      immediateParentPromptId: rowId,
      parentScaleLabel: context.sourceScaleLabel,
      parentFamily: context.sourceFamily,
      parentMechanism: context.sourceMechanics || context.approvedParentMechanism || 'create',
      parentSubject: context.approvedParentSubject || context.sourceFamily,
      immediateParentMechanics: roleMechanics,
      immediateParentReusableActions: roleActions,
      immediateParentOperationalLoop: roleLoop,
      immediateParentShape: context.sourceStructure || 'source-container',
      immediateParentRole: roleToken,
      immediateParentRoleAffordances: roleAffordanceText,
      chainImmediateParentCapability: roleContribution,
      chainImmediateParentRole: roleToken,
      chainImmediateParentRoleAffordances: roleAffordanceText,
      chainImmediateParentRoleCapability: roleContribution,
      chainImmediateParentShapeCapability: capabilityFromShape,
      chainPath: [context.sourceScaleLabel, targetScale],
    }
  }

  if (targetScale === 'S2') {
    const parentShapes = selectPrecursorShapes(
      context.sourceFamily,
      'S3',
      handcraftedAnchorsByFamily,
      context.sourceRoleVariants.split(',').slice(0, 4),
    )
    const parentShape = parentShapes[0]?.id ?? 'composition-stack'
    const parentMechanics = asMechanicTokens(`${context.sourceMechanics} ${context.reusableActions} compose open`)
      .slice(0, 5)
      .join(', ')
    return {
      immediateParentPromptId: `${rowId}-derived-s3`,
      parentScaleLabel: 'S3',
      parentFamily: context.sourceFamily,
      parentMechanism: context.approvedParentMechanism || context.sourceMechanics || 'create',
      parentSubject: context.approvedParentSubject || context.sourceFamily,
      immediateParentMechanics: `${parentMechanics}, ${roleMechanics}`,
      immediateParentReusableActions: roleActions,
      immediateParentOperationalLoop: roleLoop,
      immediateParentShape: parentShape,
      immediateParentRole: roleToken,
      immediateParentRoleAffordances: roleAffordanceText,
      chainImmediateParentCapability: roleContribution,
      chainImmediateParentRole: roleToken,
      chainImmediateParentRoleAffordances: roleAffordanceText,
      chainImmediateParentRoleCapability: roleContribution,
      chainImmediateParentShapeCapability: parentMechanics || capabilityFromShape,
      chainPath: [context.sourceScaleLabel, 'S3', targetScale],
    }
  }

  const parentShapes = selectPrecursorShapes(
    context.sourceFamily,
    'S2',
    handcraftedAnchorsByFamily,
    context.sourceRoleVariants.split(',').slice(0, 4),
  )
  const parentShape = parentShapes[0]?.id ?? 'index-list'
  const parentMechanics = asMechanicTokens(`${context.reusableActions} filter open list`).slice(0, 5).join(', ')
  return {
    immediateParentPromptId: `${rowId}-derived-s2`,
    parentScaleLabel: 'S2',
    parentFamily: context.sourceFamily,
    parentMechanism: context.approvedParentMechanism || context.reusableActions || 'create',
    parentSubject: context.approvedParentSubject || context.sourceFamily,
    immediateParentMechanics: `${parentMechanics}, ${roleMechanics}`,
    immediateParentReusableActions: roleActions,
    immediateParentOperationalLoop: roleLoop,
    immediateParentShape: parentShape,
    immediateParentRole: roleToken,
    immediateParentRoleAffordances: roleAffordanceText,
    chainImmediateParentCapability: roleContribution,
    chainImmediateParentRole: roleToken,
    chainImmediateParentRoleAffordances: roleAffordanceText,
    chainImmediateParentRoleCapability: roleContribution,
    chainImmediateParentShapeCapability: parentMechanics || capabilityFromShape,
    chainPath: [context.sourceScaleLabel, 'S3', 'S2', targetScale],
  }
}

const deriveScaleCandidates = (
  row: PromptRow,
  handcraftedAnchorsByFamily: Map<string, HandcraftedSeedAnchor[]>,
): DerivedPrompt[] => {
  const context = buildSeedContext(row, handcraftedAnchorsByFamily)
  if (context.sourceScale <= 1) {
    return []
  }

  const mechanics = extractMechanics(context)
  const mechanism = mechanics[0] ?? 'create'
  const sourceScaleSignature = `${context.sourceScaleLabel} (${context.sourceFamily}/${context.sourceStructure})`
  const candidateMechanics = renderMechanics(mechanics)
  const targets: DerivedPrompt['targetScale'][] = ['S1', 'S2', 'S3'].filter(
    (targetScale) => Number(targetScale.replace('S', '')) < context.sourceScale,
  ) as DerivedPrompt['targetScale'][]

  return targets.flatMap((targetScale) => {
    const targetScaleAnchors = selectLowScaleExemplars(context.sourceFamily, targetScale, handcraftedAnchorsByFamily)
    const targetAnchorIds = renderHandcraftedAnchorContext(targetScaleAnchors)
    const targetAnchorTerms = renderHandcraftedAnchorTerms(targetScaleAnchors)
    const targetAnchorMechanics = renderHandcraftedAnchorMechanics(targetScaleAnchors)
    const targetShapeTransferContext = buildTargetShapeTransferContext(targetScale, targetScaleAnchors)
    const targetContext = {
      ...context,
      handcraftedAnchorIds: targetAnchorIds,
      handcraftedAnchorTerms: targetAnchorTerms,
      handcraftedAnchorMechanics: targetAnchorMechanics,
      ...targetShapeTransferContext,
    }
    const subject = stripSeedNoise(chooseSubject(targetContext))
    const roleTokens = context.sourceRoleVariants.split(',').slice(0, 4)
    const shapes = selectPrecursorShapes(context.sourceFamily, targetScale, handcraftedAnchorsByFamily, roleTokens)
    const buildInput = targetScale === 'S1' ? buildS1Input : targetScale === 'S2' ? buildS2Input : buildS3Input

    return shapes.map((shape) => {
      const selectedRole = shape.role ?? context.precursorRoleVariant
      const selectedRoleAffordances = shape.affordances ?? context.precursorRoleAffordances.split(',').filter(Boolean)
      const parentChain = getTargetChainParent(
        context,
        row.id,
        targetScale,
        handcraftedAnchorsByFamily,
        selectedRole,
        selectedRoleAffordances,
      )
      const contributesToParentCapability = parentChain.chainImmediateParentCapability
      const targetContextWithContribution = {
        ...targetContext,
        contributesToParentCapability,
      }
      const chain = {
        rootSourceId: row.id,
        immediateParentPromptId: parentChain.immediateParentPromptId,
        expectedParentPromptId: parentChain.immediateParentPromptId,
        parentScaleLabel: parentChain.parentScaleLabel,
        parentFamily: parentChain.parentFamily,
        parentMechanism: parentChain.parentMechanism,
        parentSubject: parentChain.parentSubject,
        immediateParentMechanics: parentChain.immediateParentMechanics,
        immediateParentReusableActions: parentChain.immediateParentReusableActions,
        immediateParentOperationalLoop: parentChain.immediateParentOperationalLoop,
        immediateParentShape: parentChain.immediateParentShape,
        immediateParentRole: selectedRole,
        immediateParentRoleAffordances: selectedRoleAffordances.join(','),
        chainImmediateParentRole: parentChain.chainImmediateParentRole,
        chainImmediateParentRoleAffordances: parentChain.chainImmediateParentRoleAffordances,
        chainImmediateParentRoleCapability: parentChain.chainImmediateParentRoleCapability,
        chainImmediateParentShapeCapability: parentChain.chainImmediateParentShapeCapability,
        chainImmediateParentCapability: contributesToParentCapability,
        chainPath: parentChain.chainPath,
      }
      const candidateShapeNoun = shape.noun
      const build = buildInput as (
        value: DerivedSeedContext,
        mechanismArg: string,
        subjectArg: string,
        shapeArg: string,
      ) => string

      return {
        id: `${row.id}-derived-${targetScale.toLowerCase()}-${canonicalShapeId(shape)}`,
        sourceId: row.id,
        targetScale,
        input: build(targetContextWithContribution, mechanism, subject, candidateShapeNoun),
        hint: `${buildHintsByScale(targetContextWithContribution, shape, subject, targetScale)} Calibrated from rewritten seed "${context.rewrittenTitle}" with source scale ${sourceScaleSignature}, source mechanics: ${candidateMechanics}, source loop: ${targetContext.operationalLoop || 'none'}, reusable actions: ${targetContext.reusableActions}, approved parent=${context.approvedParentAnchor} (${context.approvedParentFamily}/${context.approvedParentScale}), low-scale exemplar lane=${targetContext.handcraftedAnchorIds || 'none'}.`,
        seedContext: {
          ...targetContextWithContribution,
          sourceShape: shape.id,
          precursorRoleVariant: selectedRole,
          precursorRoleAffordances: selectedRoleAffordances.join(', '),
          chainImmediateParentScaleLabel: parentChain.parentScaleLabel,
          chainImmediateParentPromptId: parentChain.immediateParentPromptId,
          chainImmediateParentMechanics: parentChain.immediateParentMechanics,
          chainImmediateParentReusableActions: parentChain.immediateParentReusableActions,
          chainImmediateParentOperationalLoop: parentChain.immediateParentOperationalLoop,
          chainImmediateParentShape: parentChain.immediateParentShape,
          chainImmediateParentRole: parentChain.chainImmediateParentRole,
          chainImmediateParentRoleAffordances: parentChain.chainImmediateParentRoleAffordances,
          chainImmediateParentRoleCapability: parentChain.chainImmediateParentRoleCapability,
          chainImmediateParentShapeCapability: parentChain.chainImmediateParentShapeCapability,
          contributesToParentCapability,
        },
        chain,
      }
    })
  })
}

const hasScaleAtLeast = (row: PromptRow, minimumScale: number): boolean => {
  const sourceScale = pickScaleFromRow(row)
  return sourceScale !== null && sourceScale >= minimumScale
}

const parseArgs = () => {
  const args = Bun.argv.slice(2)
  let inputPath = DEFAULT_INPUT
  let limit = 20
  let outputPath: string | null = null
  let minSourceScale = 4

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index]

    if (arg === '--input' && args[index + 1]) {
      inputPath = args[index + 1]!
      index += 1
      continue
    }

    if (arg === '--limit' && args[index + 1]) {
      limit = Math.max(1, Number(args[index + 1]!))
      index += 1
      continue
    }

    if (arg === '--output' && args[index + 1]) {
      outputPath = args[index + 1]!
      index += 1
      continue
    }

    if (arg === '--min-source-scale' && args[index + 1]) {
      minSourceScale = Math.max(1, Math.min(8, Number(args[index + 1]!)))
      index += 1
    }
  }

  return { inputPath, limit, outputPath, minSourceScale }
}

const main = async () => {
  const { inputPath, limit, outputPath, minSourceScale } = parseArgs()
  const rows = await readRows(inputPath)
  const handcraftedByFamily = await loadHandcraftedAnchors(DEFAULT_HANDCRAFTED_INPUT).catch(
    () => new Map<string, HandcraftedSeedAnchor[]>(),
  )
  const qualified = rows.filter((row) => hasScaleAtLeast(row, minSourceScale)).slice(0, limit)
  const prompts = qualified.flatMap((row) => deriveScaleCandidates(row, handcraftedByFamily))
  const payload = {
    inputPath,
    minSourceScale,
    seedCount: qualified.length,
    derivedCount: prompts.length,
    prompts,
  }

  const serialized = `${JSON.stringify(payload, null, 2)}\n`
  if (outputPath === null) {
    console.log(serialized)
    return
  }

  await Bun.write(outputPath, serialized)
}

if (import.meta.main) {
  main().catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  })
}
