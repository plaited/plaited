import * as z from 'zod'

import { JsonObjectSchema } from '../behavioral.ts'
import { TemplateObjectSchema } from '../render/template.schemas.ts'

/**
 * Source files used to build a generated UI module from memory.
 *
 * @public
 */
export const GeneratedUiVirtualFilesSchema = z.record(z.string().min(1), z.string())

/**
 * Validates a generated TypeScript module that should export a FunctionTemplate.
 *
 * @public
 */
export const ValidateGeneratedUiTemplateModuleInputSchema = z.object({
  entrypoint: z.string().min(1),
  execution: z.literal('trusted-process-code'),
  files: GeneratedUiVirtualFilesSchema,
  exportName: z.string().min(1).default('default'),
  fixtureAttrs: JsonObjectSchema.default({}),
  typecheck: z.boolean().default(true),
})

/**
 * Input for generated UI FunctionTemplate admission.
 *
 * @public
 */
export type ValidateGeneratedUiTemplateModuleInput = z.input<typeof ValidateGeneratedUiTemplateModuleInputSchema>

/**
 * Parsed generated UI FunctionTemplate admission input.
 *
 * @public
 */
export type ParsedValidateGeneratedUiTemplateModuleInput = z.output<typeof ValidateGeneratedUiTemplateModuleInputSchema>

/**
 * Successful generated UI template admission result.
 *
 * @public
 */
export const GeneratedUiTemplateValidatedResultSchema = z.object({
  type: z.literal('ui.generated_template_validated'),
  detail: z.object({
    entrypoint: z.string(),
    exportName: z.string(),
    template: TemplateObjectSchema,
    logs: z.array(z.string()),
  }),
})

/**
 * Repairable generated UI template admission failure.
 *
 * @public
 */
export const GeneratedUiTemplateValidationFailedResultSchema = z.object({
  type: z.literal('ui.generated_template_validation_failed'),
  detail: z.object({
    entrypoint: z.string().optional(),
    exportName: z.string().optional(),
    repairable: z.literal(true),
    error: z.object({
      message: z.string(),
      logs: z.array(z.string()).optional(),
    }),
  }),
})

/**
 * Result produced when admitting generated UI FunctionTemplate source.
 *
 * @public
 */
export const GeneratedUiTemplateValidationResultSchema = z.discriminatedUnion('type', [
  GeneratedUiTemplateValidatedResultSchema,
  GeneratedUiTemplateValidationFailedResultSchema,
])

/**
 * Generated UI template admission result.
 *
 * @public
 */
export type GeneratedUiTemplateValidationResult = z.output<typeof GeneratedUiTemplateValidationResultSchema>
