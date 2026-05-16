import * as z from 'zod'

import { TEMPLATE_OBJECT_IDENTIFIER } from './template.constants.ts'

/**
 * Validates the compiled template object produced by Plaited render utilities.
 *
 * @public
 */
export const TemplateObjectSchema = z.object({
  html: z.array(z.string()),
  stylesheets: z.array(z.string()),
  registry: z.array(z.string()),
  $: z.literal(TEMPLATE_OBJECT_IDENTIFIER),
})

/**
 * Compiled template object accepted at DB/import boundaries.
 *
 * @public
 */
export type ParsedTemplateObject = z.output<typeof TemplateObjectSchema>
