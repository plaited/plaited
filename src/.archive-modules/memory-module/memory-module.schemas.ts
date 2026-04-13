import * as z from 'zod'

export const MemoryObservationSchema = z.object({
  kind: z.string().min(1),
  summary: z.string().min(1),
  timestamp: z.number().int().nonnegative(),
})
export type MemoryObservation = z.infer<typeof MemoryObservationSchema>

export const WorkingMemorySchema = z.array(MemoryObservationSchema)

export const MemoryEpisodeSchema = z.object({
  title: z.string().min(1),
  observationKinds: z.array(z.string()),
  summary: z.string().min(1),
  timestamp: z.number().int().nonnegative(),
})
export type MemoryEpisode = z.infer<typeof MemoryEpisodeSchema>

export const MemoryEpisodesSchema = z.array(MemoryEpisodeSchema)
