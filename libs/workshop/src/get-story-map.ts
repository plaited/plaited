import path from 'node:path'
import { trueTypeOf, kebabCase } from '@plaited/utils'
import { PlaitedElement } from 'plaited'
import { Story, StoryMap } from './types.js'
import { toId } from './to-id.js'

export const getStoryMap = async (
  entryPoints: string[],
  root: string
) => {
  const absWorkingDir = path.resolve(process.cwd(), root)
  const storyMap: StoryMap = new Map()
  const titles = new Set<string>()
  for(const entry of entryPoints) {
    const { default: meta, ...rest } = await import(entry)
    // P1 handle bad meta export
    if(
      trueTypeOf(meta) !== 'object' &&
      !('title' in meta) &&
      !('description' in meta) &&
      !('template' in meta)
    ) {
      console.error(
        `Export: [ default ] in ${entry} \n Default export is not a story meta config`
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
    for (const name in rest) {
      // P4 handle incorrectly formatted names
      if (!/^[a-zA-Z][a-zA-Z_0-9]*$/.test(name)) {
        console.error(
          `Invalid name "${name}" in ${entry} \n Name must only include alphanumeric characters delineated by a "_"`
        )
        continue
      }
      // P5 handle non story exports
      const props = rest[name] as Story
      if(
        trueTypeOf(props) !== 'object' &&
        !('attrs' in props) &&
        !('description' in props)
      ) {
        console.error(
          `Export: [ ${name} ] in ${entry} \n Export [ ${name} ] is not a story`
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
        ...props,
        name,
        storyPath: path.relative(absWorkingDir, entry).replace(/\.tsx?$/, '.js'),
        template: meta.template as PlaitedElement,
        testPath: entry,
        title: meta.title as string,
      })
    }
  }
  return  storyMap
}
