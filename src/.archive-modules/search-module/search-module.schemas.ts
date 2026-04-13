import * as z from 'zod'

/**
 * Search classes supported by the initial search module.
 *
 * @public
 */
export const SearchClassSchema = z.enum(['auto', 'skills', 'modules', 'tools', 'files'])

/** @public */
export type SearchClass = z.infer<typeof SearchClassSchema>

/**
 * Search request payload.
 *
 * @public
 */
export const SearchRequestDetailSchema = z.object({
  query: z.string().min(1),
  searchClass: SearchClassSchema.default('auto').optional(),
  limit: z.number().int().positive().max(50).optional(),
})

/** @public */
export type SearchRequestDetail = z.infer<typeof SearchRequestDetailSchema>

/**
 * A compact search hit.
 *
 * @public
 */
export const SearchResultEntrySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  sourceClass: z.string().min(1),
  path: z.string().min(1).optional(),
  score: z.number(),
})

/** @public */
export type SearchResultEntry = z.infer<typeof SearchResultEntrySchema>

/**
 * Latest retained search result set.
 *
 * @public
 */
export const SearchResultsSchema = z.object({
  query: z.string().min(1),
  searchClass: SearchClassSchema,
  results: z.array(SearchResultEntrySchema),
})

/** @public */
export type SearchResults = z.infer<typeof SearchResultsSchema>
