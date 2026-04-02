import { join } from 'node:path'

export type PromptRow = {
  id: string
  prompt: string
}

export type PromptIssue = 'legacy-surface' | 'non-module-job' | 'node-boundary-confusion' | 'weak-scale-signal'

export type ScaleGuess = 'S1' | 'S2' | 'S3' | 'S4+' | 'rel'

export type PromptJudgment = {
  id: string
  bucket: string
  prompt: string
  scores: {
    currentness: number
    moduleFit: number
    nodeBoundaryFit: number
    scaleClarity: number
    total: number
  }
  scaleGuess: ScaleGuess
  issues: PromptIssue[]
  notes: string[]
}

export type BucketJudgment = {
  bucket: string
  rows: number
  averageTotal: number
  flagged: PromptJudgment[]
}

const BUCKETS_DIR = join(import.meta.dir, '..', 'dev-research', 'training-prompts', 'catalog', 'buckets')
const SUMMARY_PATH = join(BUCKETS_DIR, 'judge-summary.json')

const legacyPatterns = [
  /\bcassette(s)?\b/i,
  /\bvhs\b/i,
  /\bmini\s?dv\b/i,
  /\bdvd(s)?\b/i,
  /\bcd(s)?\b/i,
  /\bquicktime\b/i,
  /\bprint[- ]friendly\b/i,
]

const moduleSurfacePatterns = [
  /\bmodule\b/i,
  /\bworkspace\b/i,
  /\btool\b/i,
  /\beditor\b/i,
  /\bmanager\b/i,
  /\btracker\b/i,
  /\bbrowser\b/i,
  /\bcatalog\b/i,
  /\bdashboard\b/i,
  /\bpanel\b/i,
  /\bcard\b/i,
  /\bview\b/i,
  /\bform\b/i,
  /\blist\b/i,
  /\bboard\b/i,
  /\balbum\b/i,
  /\bwall\b/i,
  /\bspace\b/i,
  /\bhome screen\b/i,
  /\bquiz\b/i,
  /\blesson\b/i,
  /\bcourse\b/i,
  /\bplayer\b/i,
  /\bexplorer\b/i,
  /\btimer\b/i,
  /\bcalculator\b/i,
  /\bdialog\b/i,
  /\btoggle\b/i,
  /\bswitcher\b/i,
  /\bheatmap\b/i,
  /\bsummary\b/i,
  /\bwatcher\b/i,
  /\bmessenger\b/i,
  /\bclient\b/i,
  /\brecorder\b/i,
  /\bvisualizer\b/i,
  /\bgame\b/i,
  /\bguide\b/i,
  /\btimeline\b/i,
  /\bfeed\b/i,
]

const planningOnlyPatterns = [
  /\bgive me a migration plan\b/i,
  /\bshow me a plan\b/i,
  /\bcompare staying local\b/i,
  /\bwhat I should change\b/i,
]

const nodeBoundaryRiskPatterns = [/\bconnectable nodes\b/i, /\bconnect modules\b/i, /\bshare modules\b/i]

const scalePatterns: Array<{ scale: ScaleGuess; patterns: RegExp[] }> = [
  {
    scale: 'S1',
    patterns: [/\bitem\b/i, /\bentry\b/i, /\bcard\b/i, /\brow\b/i, /\bdetail view\b/i, /\bdialog\b/i],
  },
  {
    scale: 'S2',
    patterns: [
      /\blist\b/i,
      /\btable\b/i,
      /\bgrid\b/i,
      /\bpicker\b/i,
      /\beditor\b/i,
      /\bform\b/i,
      /\bquiz\b/i,
      /\btimer\b/i,
      /\bcalculator\b/i,
    ],
  },
  {
    scale: 'S3',
    patterns: [
      /\bdashboard\b/i,
      /\bworkspace\b/i,
      /\bcatalog\b/i,
      /\barchive\b/i,
      /\btracker\b/i,
      /\balbum\b/i,
      /\bwall\b/i,
      /\bguide\b/i,
      /\bexplorer\b/i,
      /\bcourse\b/i,
      /\bplayer\b/i,
      /\bvisualizer\b/i,
    ],
  },
  {
    scale: 'S4+',
    patterns: [/\bmeeting-room\b/i, /\bnetwork\b/i, /\bnode\b/i, /\bplatform\b/i, /\blow-code builder\b/i],
  },
  {
    scale: 'rel',
    patterns: [/\boverlay\b/i, /\bbridge\b/i, /\bcross-post\b/i, /\bconnect\b/i],
  },
]

export const inferScaleGuess = (prompt: string): ScaleGuess => {
  for (const entry of scalePatterns) {
    if (entry.patterns.some((pattern) => pattern.test(prompt))) {
      return entry.scale
    }
  }

  return 'S2'
}

export const judgePrompt = ({ bucket, row }: { bucket: string; row: PromptRow }): PromptJudgment => {
  const notes: string[] = []
  const issues: PromptIssue[] = []

  let currentness = 5
  const legacyMatches = legacyPatterns.filter((pattern) => pattern.test(row.prompt))
  const isBicycleCassetteContext = /\bchainring\b/i.test(row.prompt) && /\bcassette\b/i.test(row.prompt)
  if (legacyMatches.length > 0) {
    if (!isBicycleCassetteContext) {
      currentness -= Math.min(legacyMatches.length, 2)
      issues.push('legacy-surface')
      notes.push('Contains legacy media or era-specific surface language.')
    }
  }

  let moduleFit = 5
  const moduleSurfaceHits = moduleSurfacePatterns.filter((pattern) => pattern.test(row.prompt)).length
  const startsAsModuleRequest = /^(build|create|develop|generate|design)\b/i.test(row.prompt.trim())
  if (
    planningOnlyPatterns.some((pattern) => pattern.test(row.prompt)) ||
    (moduleSurfaceHits === 0 && !startsAsModuleRequest)
  ) {
    moduleFit -= 2
    issues.push('non-module-job')
    notes.push('Reads more like advice or a one-shot request than a bounded module surface.')
  }

  let nodeBoundaryFit = 5
  if (nodeBoundaryRiskPatterns.some((pattern) => pattern.test(row.prompt))) {
    nodeBoundaryFit -= 2
    issues.push('node-boundary-confusion')
    notes.push('May blur internal modules with external node capabilities.')
  }

  const scaleGuess = inferScaleGuess(row.prompt)
  let scaleClarity = 5
  if (
    !/\b(item|card|row|list|grid|form|editor|board|catalog|archive|workspace|dashboard|module|node|panel|view|album|wall|space|quiz|lesson|course|player|explorer|timer|calculator|dialog|toggle|switcher|guide|timeline|feed|game)\b/i.test(
      row.prompt,
    )
  ) {
    scaleClarity -= 2
    issues.push('weak-scale-signal')
    notes.push('Prompt does not strongly signal a likely module scale or structure.')
  }

  const total = Number(((currentness + moduleFit + nodeBoundaryFit + scaleClarity) / 4).toFixed(2))

  return {
    id: row.id,
    bucket,
    prompt: row.prompt,
    scores: {
      currentness,
      moduleFit,
      nodeBoundaryFit,
      scaleClarity,
      total,
    },
    scaleGuess,
    issues,
    notes,
  }
}

export const loadBucketRows = async (bucketPath: string) => {
  const text = await Bun.file(bucketPath).text()
  return text
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((line) => JSON.parse(line) as PromptRow)
}

export const judgeBuckets = async () => {
  const files = Array.fromAsync(new Bun.Glob('*.jsonl').scan({ cwd: BUCKETS_DIR }))
  const judgments: BucketJudgment[] = []

  for (const file of (await files).sort()) {
    const rows = await loadBucketRows(join(BUCKETS_DIR, file))
    const judged = rows.map((row) => judgePrompt({ bucket: file, row }))
    const flagged = judged.filter((judgment) => judgment.issues.length > 0)
    const averageTotal = Number(
      (judged.reduce((sum, judgment) => sum + judgment.scores.total, 0) / judged.length).toFixed(2),
    )

    judgments.push({
      bucket: file,
      rows: rows.length,
      averageTotal,
      flagged,
    })
  }

  return judgments
}

const run = async () => {
  const judgments = await judgeBuckets()
  const summary = {
    generatedAt: new Date().toISOString(),
    buckets: judgments,
    totals: {
      buckets: judgments.length,
      prompts: judgments.reduce((sum, bucket) => sum + bucket.rows, 0),
      flagged: judgments.reduce((sum, bucket) => sum + bucket.flagged.length, 0),
    },
  }

  await Bun.write(SUMMARY_PATH, `${JSON.stringify(summary, null, 2)}\n`)

  for (const bucket of judgments) {
    console.log(`${bucket.bucket}: rows=${bucket.rows} average=${bucket.averageTotal} flagged=${bucket.flagged.length}`)
  }

  console.log(`wrote ${SUMMARY_PATH}`)
}

if (import.meta.main) {
  await run()
}
