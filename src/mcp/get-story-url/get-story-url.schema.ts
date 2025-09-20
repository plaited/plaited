import * as z from 'zod'

export const GetStoryUrlOutputSchema = z.object({
  url: z.string(),
})
