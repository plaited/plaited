import path from 'node:path'
import { trueTypeOf, kebabCase } from '@plaited/utils'
import { PlaitedElement } from 'plaited'
import { Story, StoryMap } from './types.js'
import { toId } from './utils.js'

export const getStoryMap = async (
  entryPoints: string[],
  srcDir: string
) => {
  const storyMap: StoryMap = new Map()
  const titles = new Set<string>()
  for(const entry of entryPoints) {
    const { default: meta, ...stories } = await import(entry)
    // P1 handle bad meta export
    if(
      trueTypeOf(meta) !== 'object' 
    ) {
      console.error(
        `Export: [ default ] in ${entry} \n Default export is not a story meta config`
      )
      continue
    }
    if(
      !Object.hasOwn(meta, 'title') ||
      !Object.hasOwn(meta, 'description') ||
      !Object.hasOwn(meta,'template')
    ) {
      console.error(
        `Export: [ default ] in ${entry} \n Default export is missing key values pairs`
      )
      continue
    }
    const title = meta.title
    // P2 handle incorrectly formatted titles
    if (!/^[a-zA-Z][a-zA-Z/0-9]*$/.test(title)) {
      console.error(
        `Invalid title "${title}" in ${entry} \n Title must only include alphanumeric characters delineated by a "/"`
      )
      continue
    }
    const normalizedTitle = title.toLowerCase()
    // P3 handle duplicate normalized titles
    if(titles.has(normalizedTitle)) {
      console.error(
        `Rename meta: [ ${title} ] in ${entry} \n Title already in use`
      )
      continue
    }
    titles.add(normalizedTitle)
    for (const name in stories) {
      // P4 handle incorrectly formatted names
      if (!/^[a-zA-Z][a-zA-Z_0-9]*$/.test(name)) {
        console.error(
          `Invalid name "${name}" in ${entry} \n Name must only include alphanumeric characters delineated by a "_"`
        )
        continue
      }
      // P5 handle non story exports
      const story = stories[name] as Story
      if(
        trueTypeOf(story) !== 'object'
      ) {
        console.error(
          `Exported Story: [ ${name} ] in ${entry} \n Export [ ${name} ] is not a story`
        )
        continue
      }
      if(
        !('attrs' in story) ||
        !('description' in story)
      ) {
        console.error(
          `Exported Story: [ ${name} ] in ${entry} \n Export [ ${name} ] is missing key values pairs`
        )
        continue
      }
      const id = toId(title, name)
      // P6 handle duplicate normalized names
      if(storyMap.has(id)) {
        console.error(
          `Rename story: [ ${name} ] in ${entry} \n KebabCase  [${kebabCase(name)}] already in use`
        )
        continue
      }
      storyMap.set(id, {
        ...story,
        play: Boolean(story.play),
        name,
        clientPath: `/${path.relative(srcDir, entry).replace(/\.tsx?$/, '.js')}`,
        template: meta.template as PlaitedElement,
        srcPath: entry,
        title: meta.title as string,
      })
    }
  }
  return  storyMap
}
