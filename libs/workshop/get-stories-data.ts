import { StoriesData, Story, StoryConfig } from './types.ts'
import { TemplateProps } from '../island/mod.ts'

export const getStoriesData = async (stories: string[]): Promise<StoriesData> =>
  await Promise.all(stories.map(async (path) => {
    const data = []
    let title = ''
    try {
      const { default: config, ...rest } = await import(path)
      const { title: _title, template, island } = config as StoryConfig<
        TemplateProps
      >
      title = _title
      if (!/^[a-zA-Z][a-zA-Z\/0-9]*$/.test(_title)) {
        console.error(
          `Invalid title "${_title}", must only include alphanumeric characters delineated by a "\"`,
        )
      }
      for (const name in rest) {
        if (!/^[a-zA-Z][a-zA-Z\_0-9]*$/.test(name)) {
          console.error(
            `Invalid title "${name}", must only include alphanumeric characters delineated by a "_"`,
          )
        }
        const { args, play } = rest[name] as Story<TemplateProps>
        data.push({
          args,
          name,
          island,
          template,
          play,
        })
      }
    } catch (err) {
      console.error(err)
    }
    return [{ title, path }, data]
  }))
