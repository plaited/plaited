import type { StoryObj } from './testing/plaited-fixture.types.js'

export const getStoriesFromfile = async (file: string) => {
  const { default: _, ...rest } = (await import(file)) as {
    [key: string]: StoryObj
  }
  return rest
}
