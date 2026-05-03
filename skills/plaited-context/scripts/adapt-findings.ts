import * as z from 'zod'
import { makeCli } from '../../../src/cli.ts'

const FindingKindSchema = z
  .enum(['pattern', 'anti-pattern', 'stale-doc', 'boundary-rule', 'question'])
  .describe('Classification for a recorded finding.')

const FindingStatusSchema = z
  .enum(['candidate', 'validated', 'retired'])
  .describe('Lifecycle status for a recorded finding.')

const FindingEvidenceSchema = z
  .object({
    path: z.string().min(1).describe('Source file path supporting the finding.'),
    line: z.number().int().positive().optional().describe('1-based line number for the evidence location.'),
    symbol: z.string().min(1).optional().describe('Optional symbol name tied to the evidence.'),
    excerpt: z.string().min(1).optional().describe('Optional short source excerpt for review context.'),
  })
  .describe('Source-grounded evidence attached to a finding.')

const FindingInputSchema = z
  .object({
    kind: FindingKindSchema.describe('Finding category.'),
    status: FindingStatusSchema.describe('Lifecycle status.'),
    summary: z.string().min(1).describe('Short reviewer-facing finding statement.'),
    details: z.string().optional().describe('Optional longer rationale or context.'),
    evidence: z.array(FindingEvidenceSchema).default([]).describe('Evidence entries supporting the finding.'),
  })
  .describe('Canonical finding candidate produced by adapt-findings.')

type FindingInput = z.infer<typeof FindingInputSchema>

export const AdaptFindingsInputSchema = z
  .object({
    source: z.string().min(1).default('unknown').describe('Producer identifier for provenance/debug context.'),
    input: z.unknown().describe('Arbitrary producer output to adapt into canonical finding candidates.'),
  })
  .strict()
  .describe('Input contract for best-effort adaptation into canonical finding candidates.')

export const AdaptFindingsOutputSchema = z
  .object({
    ok: z.literal(true).describe('Indicates adaptation completed.'),
    findings: z.array(FindingInputSchema).describe('Best-effort adapted canonical findings.'),
    warnings: z.array(z.string()).describe('Non-fatal adaptation warnings for dropped or malformed rows.'),
  })
  .strict()
  .describe('Output contract for best-effort finding adaptation.')

export type AdaptFindingsInput = z.input<typeof AdaptFindingsInputSchema>
export type AdaptFindingsOutput = z.infer<typeof AdaptFindingsOutputSchema>

type FindingKind = FindingInput['kind']
type FindingStatus = FindingInput['status']

const FINDING_KINDS: FindingKind[] = ['pattern', 'anti-pattern', 'stale-doc', 'boundary-rule', 'question']
const FINDING_STATUSES: FindingStatus[] = ['candidate', 'validated', 'retired']

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const readString = (value: unknown): string | undefined => {
  if (typeof value !== 'string') return
  const trimmed = value.trim()
  return trimmed.length > 0 ? trimmed : undefined
}

const toKind = (value: unknown): FindingKind | undefined => {
  const normalized = readString(value)?.toLowerCase()
  if (!normalized) return
  if (FINDING_KINDS.includes(normalized as FindingKind)) {
    return normalized as FindingKind
  }
  return
}

const toStatus = (value: unknown): FindingStatus | undefined => {
  const normalized = readString(value)?.toLowerCase()
  if (!normalized) return
  if (FINDING_STATUSES.includes(normalized as FindingStatus)) {
    return normalized as FindingStatus
  }
  return
}

const toEvidence = (value: unknown): FindingInput['evidence'] => {
  if (!Array.isArray(value)) return []

  const evidence: FindingInput['evidence'] = []
  for (const row of value) {
    if (!isRecord(row)) continue
    const path = readString(row.path)
    if (!path) continue

    const line =
      typeof row.line === 'number' && Number.isInteger(row.line) && row.line > 0 ? (row.line as number) : undefined
    const symbol = readString(row.symbol)
    const excerpt = readString(row.excerpt)

    evidence.push({
      path,
      ...(line === undefined ? {} : { line }),
      ...(symbol === undefined ? {} : { symbol }),
      ...(excerpt === undefined ? {} : { excerpt }),
    })
  }

  return evidence
}

const collectCandidates = (input: unknown): unknown[] => {
  if (Array.isArray(input)) return input
  if (!isRecord(input)) return []

  const nested = input.findings
  if (Array.isArray(nested)) return nested
  return [input]
}

const toFinding = (candidate: unknown): FindingInput | null => {
  if (!isRecord(candidate)) return null

  const summary = readString(candidate.summary) ?? readString(candidate.text) ?? readString(candidate.message)
  if (!summary) return null

  const kind = toKind(candidate.kind) ?? toKind(candidate.category) ?? 'pattern'
  const status = toStatus(candidate.status) ?? 'candidate'
  const details = readString(candidate.details) ?? readString(candidate.description) ?? readString(candidate.reason)
  const evidence = toEvidence(candidate.evidence)

  return FindingInputSchema.parse({
    kind,
    status,
    summary,
    ...(details === undefined ? {} : { details }),
    evidence,
  })
}

export const adaptFindings = async (input: AdaptFindingsInput): Promise<AdaptFindingsOutput> => {
  const parsed = AdaptFindingsInputSchema.parse(input)
  const findings: FindingInput[] = []
  const warnings: string[] = []
  const candidates = collectCandidates(parsed.input)

  for (const [index, candidate] of candidates.entries()) {
    try {
      const finding = toFinding(candidate)
      if (!finding) {
        warnings.push(`[${parsed.source}] Skipped entry ${index}: missing finding summary/text/message.`)
        continue
      }

      if (finding.status !== 'candidate' && finding.evidence.length === 0) {
        warnings.push(
          `[${parsed.source}] Downgraded entry ${index} from ${finding.status} to candidate: non-candidate findings require evidence.`,
        )
        findings.push({
          ...finding,
          status: 'candidate',
        })
        continue
      }

      findings.push(finding)
    } catch (error) {
      warnings.push(
        `[${parsed.source}] Skipped entry ${index}: ${error instanceof Error ? error.message : String(error)}`,
      )
    }
  }

  if (findings.length === 0) {
    warnings.push(`[${parsed.source}] No adaptable finding-like entries were produced.`)
  }

  return {
    ok: true,
    findings,
    warnings,
  }
}

export const adaptFindingsCli = makeCli({
  name: 'skills/plaited-context/scripts/adapt-findings.ts',
  inputSchema: AdaptFindingsInputSchema,
  outputSchema: AdaptFindingsOutputSchema,
  help: [
    'Examples:',
    `  bun skills/plaited-context/scripts/adapt-findings.ts '{"source":"plaited wiki","input":{"findings":[{"kind":"stale-doc","summary":"Doc states command that no longer exists."}]}}'`,
    `  bun skills/plaited-context/scripts/adapt-findings.ts --schema output`,
  ].join('\n'),
  run: adaptFindings,
})

if (import.meta.main) {
  await adaptFindingsCli(Bun.argv.slice(2))
}
