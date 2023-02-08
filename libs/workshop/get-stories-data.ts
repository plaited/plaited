import { StoriesData, Story, StoryConfig } from './types.ts'
import { CustomElementTag, Template, TemplateProps } from '../island/mod.ts'

export const getStoriesData = async (stories: string[]): Promise<StoriesData> =>
  await Promise.all(stories.map(async (path) => {
    const data = []
    let title = ''
    let description = ''
    let island: CustomElementTag | undefined
    let template: Template
    try {
      const { default: config, ...rest } = await import(path)
      ;({ title, island, description, template } = config as StoryConfig<
        TemplateProps
      >)
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
          template,
        })
      }
    } catch (err) {
      console.error(err)
    }
    return [{ title, path, description, island }, data]
  }))
