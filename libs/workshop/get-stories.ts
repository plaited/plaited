import { StoriesData, Story, StoryConfig } from './types.ts'

export const getStories = async (stories: string[]): Promise<StoriesData> =>
  await Promise.all(stories.map(async (path) => {
    const data = []
    let title = ''
    try {
      const { default: config, ...rest } = await import(path)
      const { title: _title, template, fixture } = config as StoryConfig
      title = _title
      for (const name in rest) {
        const { args } = rest[name] as Story
        data.push({
          args,
          name,
          fixture,
          template,
        })
      }
    } catch (err) {
      console.error(err)
    }
    return [{ title, path }, data]
  }))
