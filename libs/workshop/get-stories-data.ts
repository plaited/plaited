import { StoriesData, Story, StoryData } from './types.ts'
import { TemplateProps } from '../islandly/mod.ts'
import { relative } from '../deps.ts'

export const getStoriesData = async (
  stories: string[],
): Promise<StoriesData> => {
  const storiesData: StoriesData = await Promise.all(
    stories.map(async (path) => {
      const data: StoryData[] = []
      const txt = await Deno.readTextFile(path)
      console.log(txt)
      const { default: config, ...rest } = await import(path)
      const title = config.title
      console.log({ title, path })
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
      const collator = new Intl.Collator()
      data.sort(({ name: a }, { name: b }) => collator.compare(a, b))
      const names = data.map(({ name }) => name)
      const normalizedNames = data.map(({ name }) => name.toLowerCase())
      const dedupe = new Set(normalizedNames)
      if (normalizedNames.length !== dedupe.size) {
        names.forEach((name, i) => {
          const normalized = name.toLowerCase()
          if (dedupe.has(normalized)) {
            dedupe.delete(normalized)
            return
          }
          console.error(
            `Rename story: [ ${name} ] in ${title} name is already in use`,
          )
          data.splice(i)
        })
      }
      return [{ path: relative(Deno.cwd(), path), ...config }, data]
    }),
  )
  const collator = new Intl.Collator()
  storiesData.sort(([{ title: a }], [{ title: b }]) => collator.compare(a, b))
  const titles = storiesData.map(([{ title }]) => title)
  const normalizedTitles = storiesData.map(([{ title }]) => title.toLowerCase())
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
      storiesData.splice(i)
    })
  }
  return storiesData
}
