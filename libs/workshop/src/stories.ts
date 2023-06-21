import path from 'node:path'
import { Bundles, Story, StoryList, StoryMap } from './types.js'
import { Server } from './server.js'


export class Stories {
  absWorkingDir: string
  entryPoints: string[]
  storyMap: StoryMap = []
  constructor(entryPoints: string[], root: string) {
    this.absWorkingDir = path.resolve(process.cwd(), root)
    this.entryPoints = entryPoints
  }
  setRoutes(bundles: Bundles, server: Server) {
    // entryPoints.map(entry => path.relative(absWorkingDir, entry))
    for(const bundle of bundles) {
      
    }
  }
  async getStoryData(){
    for(const entry of this.entryPoints) {
      const data: StoryList = []
      const { default: config, ...rest } = await import(entry)
      const title = config.title
      if (!/^[a-zA-Z][a-zA-Z\/0-9]*$/.test(title)) {
        console.error(
          `Invalid title "${title}", must only include alphanumeric characters delineated by a "/\"`
        )
      }
      for (const name in rest) {
        if (!/^[a-zA-Z][a-zA-Z\_0-9]*$/.test(name)) {
          console.error(
            `Invalid title "${name}", must only include alphanumeric characters delineated by a "_"`
          )
        }
        const props = rest[name] as Story
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
            `Rename story: [ ${name} ] in ${title} name is already in use`
          )
          data.splice(i)
        })
      }
      this.storyMap.push([ { path: path.relative(this.absWorkingDir, entry), ...config }, data ])
    }
    this.sortAndDedupe()
  }
  sortAndDedupe(){
    const collator = new Intl.Collator()
    this.storyMap.sort(([ { title: a } ], [ { title: b } ]) => collator.compare(a, b))
    const titles = this.storyMap.map(([ { title } ]) => title)
    const normalizedTitles = this.storyMap.map(([ { title } ]) => title.toLowerCase())
    const dedupe = new Set(normalizedTitles)
    if (normalizedTitles.length !== dedupe.size) {
      titles.forEach((title, i) => {
        const normalized = title.toLowerCase()
        if (dedupe.has(normalized)) {
          dedupe.delete(normalized)
          return
        }
        console.error(
          `Rename StoryConfigs: [ ${title} ] title already in use`
        )
        this.storyMap.splice(i)
      })
    }
  }
}
