import { basename } from 'node:path'
import { Glob } from 'bun'
import type { ModuleModuleCatalogEntry } from '../module-discovery-module/module-discovery-module.schemas.ts'
import type { SkillCatalogEntry } from '../skills-module/skills-module.schemas.ts'
import type { CapabilityRecord } from '../tool-registry-module/tool-registry-module.schemas.ts'
import {
  type SearchClass,
  SearchClassSchema,
  type SearchResultEntry,
  SearchResultEntrySchema,
} from './search-module.schemas.ts'

const normalize = (value: string) => value.toLowerCase()

const scoreTextMatch = (query: string, ...values: Array<string | undefined>) => {
  const q = normalize(query)
  let score = 0

  for (const value of values) {
    if (!value) continue
    const text = normalize(value)
    if (text === q) score += 12
    else if (text.startsWith(q)) score += 8
    else if (text.includes(q)) score += 4
  }

  return score
}

const toSkillResults = (query: string, skills: SkillCatalogEntry[]): SearchResultEntry[] =>
  skills
    .map((skill) => ({
      id: `skill:${skill.name}`,
      label: skill.name,
      description: skill.description,
      sourceClass: 'skill',
      path: skill.skillPath,
      score: scoreTextMatch(query, skill.name, skill.description, skill.compatibility),
    }))
    .filter((entry) => entry.score > 0)
    .map((entry) => SearchResultEntrySchema.parse(entry))

const toModuleResults = (query: string, modules: ModuleModuleCatalogEntry[]): SearchResultEntry[] =>
  modules
    .map((module) => ({
      id: `module:${module.id}`,
      label: module.id,
      description: `Module module at ${module.path}`,
      sourceClass: module.sourceClass,
      path: module.path,
      score: scoreTextMatch(query, module.id, module.path, module.packageName),
    }))
    .filter((entry) => entry.score > 0)
    .map((entry) => SearchResultEntrySchema.parse(entry))

const toToolResults = (query: string, tools: CapabilityRecord[]): SearchResultEntry[] =>
  tools
    .map((tool) => ({
      id: tool.id,
      label: tool.name,
      description: tool.description,
      sourceClass: tool.sourceClass,
      path: tool.path,
      score: scoreTextMatch(query, tool.name, tool.description, ...tool.tags),
    }))
    .filter((entry) => entry.score > 0)
    .map((entry) => SearchResultEntrySchema.parse(entry))

const toFileResults = async ({ query, rootDir }: { query: string; rootDir: string }): Promise<SearchResultEntry[]> => {
  const glob = new Glob('**/*')
  const results: SearchResultEntry[] = []

  for await (const path of glob.scan({
    cwd: rootDir,
    absolute: false,
    onlyFiles: true,
  })) {
    const score = scoreTextMatch(query, path, basename(path))
    if (score === 0) continue
    results.push(
      SearchResultEntrySchema.parse({
        id: `file:${path}`,
        label: basename(path),
        description: `Workspace file ${path}`,
        sourceClass: 'file',
        path,
        score,
      }),
    )
  }

  return results
}

/**
 * Searches metadata-first capability and workspace surfaces.
 *
 * @public
 */
export const runSearch = async ({
  query,
  searchClass = 'auto',
  limit = 10,
  rootDir,
  skills = [],
  modules = [],
  tools = [],
}: {
  query: string
  searchClass?: SearchClass
  limit?: number
  rootDir: string
  skills?: SkillCatalogEntry[]
  modules?: ModuleModuleCatalogEntry[]
  tools?: CapabilityRecord[]
}): Promise<{
  searchClass: SearchClass
  results: SearchResultEntry[]
}> => {
  const normalizedClass = SearchClassSchema.parse(searchClass)
  const collected =
    normalizedClass === 'skills'
      ? toSkillResults(query, skills)
      : normalizedClass === 'modules'
        ? toModuleResults(query, modules)
        : normalizedClass === 'tools'
          ? toToolResults(query, tools)
          : normalizedClass === 'files'
            ? await toFileResults({ query, rootDir })
            : [
                ...toSkillResults(query, skills),
                ...toModuleResults(query, modules),
                ...toToolResults(query, tools),
                ...(await toFileResults({ query, rootDir })),
              ]

  const deduped = new Map<string, SearchResultEntry>()
  for (const entry of collected) {
    const existing = deduped.get(entry.id)
    if (!existing || entry.score > existing.score) {
      deduped.set(entry.id, entry)
    }
  }

  return {
    searchClass: normalizedClass,
    results: [...deduped.values()].sort((a, b) => b.score - a.score || a.id.localeCompare(b.id)).slice(0, limit),
  }
}
