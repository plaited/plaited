import { StoriesData, Story, StoryConfig } from './types.ts'
import { TemplateProps } from '../island/mod.ts'

export const getStories = async (stories: string[]): Promise<StoriesData> =>
  await Promise.all(stories.map(async (path) => {
    const data = []
    let title = ''
    try {
      const { default: config, ...rest } = await import(path)
      const { title: _title, template, island } = config as StoryConfig<
        TemplateProps
      >
      title = _title
      for (const name in rest) {
        const { args } = rest[name] as Story<TemplateProps>
        data.push({
          args,
          name,
          island,
          template,
        })
      }
    } catch (err) {
      console.error(err)
    }
    return [{ title, path }, data]
  }))
