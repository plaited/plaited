#!/usr/bin/env bun
/**
 * Validate encoded symbolic artifacts against source markdown provenance.
 *
 * @remarks
 * This is a deterministic validator for skill/doc encodings. It does not infer
 * concepts itself; it checks that an encoded artifact covers required concepts
 * and that source path/heading references resolve against the real markdown
 * section surface.
 *
 * @public
 */

import { resolve } from 'node:path'
import * as z from 'zod'
import { RISK_TAG } from '../agent/agent.constants.ts'
import type { ToolDefinition } from '../agent/agent.schemas.ts'
import type { ToolHandler } from '../agent/agent.types.ts'
import { parseCli } from './cli.utils.ts'
import { buildSkillEncodingSurface } from './skill-links.ts'

export type EncodingValidationResult = {
  valid: boolean
  sourcePath: string
  encodedPath: string
  conceptCount: number
  relationCount: number
  missingConcepts: string[]
  errors: string[]
  warnings: string[]
}

const ProvenanceRefSchema = z.object({
  path: z.string(),
  heading: z.string().optional(),
})

const EncodedConceptSchema = z.object({
  id: z.string(),
  type: z.string().optional(),
  source: ProvenanceRefSchema.optional(),
})

const EncodedRelationSchema = z.object({
  from: z.string(),
  to: z.string(),
  type: z.string(),
  source: ProvenanceRefSchema.optional(),
})

const EncodedKnowledgeSchema = z.object({
  concepts: z.array(EncodedConceptSchema).default([]),
  relations: z.array(EncodedRelationSchema).default([]),
})

const ValidateEncodingInputSchema = z.object({
  sourcePath: z.string().describe('Path to SKILL.md or another markdown root'),
  encodedPath: z.string().describe('Path to encoded JSON artifact'),
  requiredConcepts: z.array(z.string()).optional().describe('Concept IDs that must be present'),
})

const ValidateEncodingOutputSchema = z.object({
  valid: z.boolean(),
  sourcePath: z.string(),
  encodedPath: z.string(),
  conceptCount: z.number(),
  relationCount: z.number(),
  missingConcepts: z.array(z.string()),
  errors: z.array(z.string()),
  warnings: z.array(z.string()),
})

export { ValidateEncodingInputSchema, ValidateEncodingOutputSchema, EncodedKnowledgeSchema }

const matchesHeading = (sectionHeadingPath: string[], heading: string) => {
  const normalized = heading.trim().toLowerCase()
  return (
    sectionHeadingPath.some((part) => part.trim().toLowerCase() === normalized) ||
    sectionHeadingPath.join(' / ').trim().toLowerCase() === normalized
  )
}

export const validateEncodedKnowledge = async ({
  sourcePath,
  encodedPath,
  requiredConcepts = [],
}: {
  sourcePath: string
  encodedPath: string
  requiredConcepts?: string[]
}): Promise<EncodingValidationResult> => {
  const result: EncodingValidationResult = {
    valid: false,
    sourcePath,
    encodedPath,
    conceptCount: 0,
    relationCount: 0,
    missingConcepts: [],
    errors: [],
    warnings: [],
  }

  const encodedFile = Bun.file(encodedPath)
  if (!(await encodedFile.exists())) {
    result.errors.push(`Encoded file does not exist: ${encodedPath}`)
    return result
  }

  const sourceFile = Bun.file(sourcePath)
  if (!(await sourceFile.exists())) {
    result.errors.push(`Source file does not exist: ${sourcePath}`)
    return result
  }

  let encoded: z.infer<typeof EncodedKnowledgeSchema>
  try {
    encoded = EncodedKnowledgeSchema.parse(await encodedFile.json())
  } catch (error) {
    result.errors.push(
      `Encoded file failed schema validation: ${error instanceof Error ? error.message : String(error)}`,
    )
    return result
  }

  const surface = await buildSkillEncodingSurface(sourcePath)
  const documentsByPath = new Map(surface.documents.map((doc) => [doc.path, doc]))

  result.conceptCount = encoded.concepts.length
  result.relationCount = encoded.relations.length
  result.missingConcepts = requiredConcepts.filter(
    (requiredConcept) => !encoded.concepts.some((concept) => concept.id === requiredConcept),
  )

  for (const missingConcept of result.missingConcepts) {
    result.errors.push(`Missing required concept: ${missingConcept}`)
  }

  const validateSourceRef = (label: string, source: z.infer<typeof ProvenanceRefSchema> | undefined) => {
    if (!source) {
      result.warnings.push(`${label} has no provenance source`)
      return
    }

    const normalizedPath = source.path.startsWith('/') ? source.path : resolve(source.path)
    const document = documentsByPath.get(normalizedPath)
    if (!document) {
      result.errors.push(`${label} references missing source path: ${source.path}`)
      return
    }

    if (source.heading) {
      const hasHeading = document.sections.some((section) => matchesHeading(section.headingPath, source.heading!))
      if (!hasHeading) {
        result.errors.push(`${label} references missing heading "${source.heading}" in ${source.path}`)
      }
    }
  }

  for (const concept of encoded.concepts) {
    validateSourceRef(`concept ${concept.id}`, concept.source)
  }

  for (const relation of encoded.relations) {
    validateSourceRef(`relation ${relation.from} -> ${relation.to} (${relation.type})`, relation.source)
  }

  result.valid = result.errors.length === 0
  return result
}

export const validateEncoding: ToolHandler = async (args, ctx) => {
  const input = ValidateEncodingInputSchema.parse(args)
  const sourcePath = input.sourcePath.startsWith('/') ? input.sourcePath : resolve(ctx.workspace, input.sourcePath)
  const encodedPath = input.encodedPath.startsWith('/') ? input.encodedPath : resolve(ctx.workspace, input.encodedPath)
  return await validateEncodedKnowledge({
    sourcePath,
    encodedPath,
    requiredConcepts: input.requiredConcepts,
  })
}

export const validateEncodingRiskTags = [RISK_TAG.workspace]

export const validateEncodingToolDefinition: ToolDefinition = {
  type: 'function',
  function: {
    name: 'validate_encoding',
    description:
      'Validate an encoded skill/doc artifact against source markdown provenance and required concept coverage.',
    parameters: z.toJSONSchema(ValidateEncodingInputSchema) as ToolDefinition['function']['parameters'],
  },
}

export const validateEncodingCli = async (args: string[]) => {
  if (args.includes('--help') || args.includes('-h')) {
    // biome-ignore lint/suspicious/noConsole: CLI output
    console.log(`plaited validate-encoding
Validate encoded knowledge against source markdown provenance.

Usage: plaited validate-encoding '<json>' [options]
       echo '<json>' | plaited validate-encoding

Input (JSON):
  sourcePath         string     Path to SKILL.md or markdown root
  encodedPath        string     Path to encoded JSON artifact
  requiredConcepts   string[]   Optional concept IDs that must exist

Options:
  --schema <input|output>  Print JSON Schema and exit
  -h, --help               Show this help`)
    return
  }

  const input = await parseCli(args.length === 0 && process.stdin.isTTY ? ['{}'] : args, ValidateEncodingInputSchema, {
    name: 'validate-encoding',
    outputSchema: ValidateEncodingOutputSchema,
  })

  const result = await validateEncodedKnowledge({
    sourcePath: input.sourcePath.startsWith('/') ? input.sourcePath : resolve(process.cwd(), input.sourcePath),
    encodedPath: input.encodedPath.startsWith('/') ? input.encodedPath : resolve(process.cwd(), input.encodedPath),
    requiredConcepts: input.requiredConcepts,
  })
  // biome-ignore lint/suspicious/noConsole: CLI output
  console.log(JSON.stringify(result, null, 2))
  if (!result.valid) {
    process.exitCode = 1
  }
}

if (import.meta.main) {
  await validateEncodingCli(Bun.argv.slice(2))
}
