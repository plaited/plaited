import { StoriesData, Story } from './types.ts'
import { TemplateProps } from '../islandly/mod.ts'
import { relative } from '../deps.ts'

export const getStoriesData = async (
  stories: string[],
): Promise<StoriesData> => {
  const data: StoriesData = await Promise.all(stories.map(async (path) => {
    const data = []
    const { default: config, ...rest } = await import(path)
    const title = config.title
    if (!/^[a-zA-Z][a-zA-Z\/0-9]*$/.test(title)) {
      console.error(
        `Invalid title "${title}", must only include alphanumeric characters delineated by a "\"`,
      )
    }
    for (const name in rest) {
      if (!/^[a-zA-Z][a-zA-Z\_0-9]*$/.test(name)) {
        console.error(
          `Invalid title "${name}", must only include alphanumeric characters delineated by a "_"`,
        )
      }
      const props = rest[name] as Story<TemplateProps>
      data.push({
        ...props,
        name,
      })
    }
    return [{ path: relative(Deno.cwd(), path), ...config }, data]
  }))
  const collator = new Intl.Collator()
  data.sort(([{ title: a }], [{ title: b }]) => collator.compare(a, b))
  const titles = data.map(([{ title }]) => title)
  const normalizedTitles = data.map(([{ title }]) => title.toLowerCase())
  const dedupe = new Set(normalizedTitles)
  if (normalizedTitles.length !== dedupe.size) {
    titles.forEach((title, i) => {
      const normalized = title.toLowerCase()
      if (dedupe.has(normalized)) {
        dedupe.delete(normalized)
        return
      }
      console.error(
        `Rename StoryConfigs: [ ${title} ] title already in use`,
      )
      data.splice(i)
    })
  }
  return data
}
