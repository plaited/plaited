import type { Module } from '../../agent.ts'
import { AGENT_EVENTS } from '../../agent.ts'
import { MODULE_DISCOVERY_MODULE_SIGNAL_KEYS } from '../module-discovery-module/module-discovery-module.constants.ts'
import type { ModuleModuleCatalogEntry } from '../module-discovery-module/module-discovery-module.schemas.ts'
import { SKILLS_MODULE_SIGNAL_KEYS } from '../skills-module/skills-module.constants.ts'
import type { SkillCatalogEntry } from '../skills-module/skills-module.schemas.ts'
import { TOOL_REGISTRY_MODULE_EVENTS, TOOL_REGISTRY_MODULE_SIGNAL_KEYS } from './tool-registry-module.constants.ts'
import {
  type CapabilityRecord,
  CapabilityRecordSchema,
  CapabilityRegistrySchema,
} from './tool-registry-module.schemas.ts'
import type { CreateToolRegistryModuleOptions } from './tool-registry-module.types.ts'

const BUILT_IN_CAPABILITIES: CapabilityRecord[] = [
  {
    id: 'builtin:read_file',
    name: 'read_file',
    description: 'Read a file inside the current working directory.',
    capabilityClass: 'built-in',
    sourceClass: 'core',
    tags: ['file', 'read', 'workspace'],
    authorityHints: ['cwd-read'],
  },
  {
    id: 'builtin:write_file',
    name: 'write_file',
    description: 'Write or overwrite a file inside the current working directory.',
    capabilityClass: 'built-in',
    sourceClass: 'core',
    tags: ['file', 'write', 'workspace'],
    authorityHints: ['cwd-write'],
  },
  {
    id: 'builtin:delete_file',
    name: 'delete_file',
    description: 'Delete a file inside the current working directory.',
    capabilityClass: 'built-in',
    sourceClass: 'core',
    tags: ['file', 'delete', 'workspace'],
    authorityHints: ['cwd-delete'],
  },
  {
    id: 'builtin:glob_files',
    name: 'glob_files',
    description: 'List workspace files using glob patterns.',
    capabilityClass: 'built-in',
    sourceClass: 'core',
    tags: ['search', 'glob', 'workspace'],
    authorityHints: ['cwd-read'],
  },
  {
    id: 'builtin:grep',
    name: 'grep',
    description: 'Search file contents within the current working directory.',
    capabilityClass: 'built-in',
    sourceClass: 'core',
    tags: ['search', 'text', 'workspace'],
    authorityHints: ['cwd-read'],
  },
  {
    id: 'builtin:bash',
    name: 'bash',
    description: 'Run a Bun worker inside the current workspace.',
    capabilityClass: 'built-in',
    sourceClass: 'core',
    tags: ['execution', 'workspace'],
    authorityHints: ['workspace-exec'],
  },
]

const buildRegistry = ({
  skills = [],
  modules = [],
}: {
  skills?: SkillCatalogEntry[]
  modules?: ModuleModuleCatalogEntry[]
}): CapabilityRecord[] => {
  const records: CapabilityRecord[] = [...BUILT_IN_CAPABILITIES]

  for (const skill of skills) {
    records.push(
      CapabilityRecordSchema.parse({
        id: `skill:${skill.name}`,
        name: skill.name,
        description: skill.description,
        capabilityClass: 'skill',
        sourceClass: 'default',
        path: skill.skillPath,
        tags: ['skill', ...(skill.compatibility ? ['compatibility'] : [])],
        authorityHints: skill.allowedTools ? [skill.allowedTools] : [],
      }),
    )
  }

  for (const module of modules) {
    records.push(
      CapabilityRecordSchema.parse({
        id: `module:${module.id}`,
        name: module.id,
        description: `Module module discovered at ${module.path}`,
        capabilityClass: 'module',
        sourceClass: module.sourceClass,
        path: module.path,
        tags: ['module', 'module'],
        authorityHints: [`module-count:${module.moduleCount}`],
      }),
    )
  }

  return records.sort((a, b) => a.id.localeCompare(b.id))
}

/**
 * Creates the metadata-first tool registry module.
 *
 * @public
 */
export const createToolRegistryModule =
  ({
    registrySignalKey = TOOL_REGISTRY_MODULE_SIGNAL_KEYS.registry,
    skillsCatalogSignalKey = SKILLS_MODULE_SIGNAL_KEYS.catalog,
    moduleCatalogSignalKey = MODULE_DISCOVERY_MODULE_SIGNAL_KEYS.catalog,
  }: CreateToolRegistryModuleOptions = {}): Module =>
  ({ signals, trigger }) => {
    const registrySignal =
      signals.get(registrySignalKey) ??
      signals.set({
        key: registrySignalKey,
        schema: CapabilityRegistrySchema,
        value: BUILT_IN_CAPABILITIES,
        readOnly: false,
      })

    const rebuildRegistry = () => {
      const skillsSignal = signals.get(skillsCatalogSignalKey)
      const modulesSignal = signals.get(moduleCatalogSignalKey)
      const skills = (skillsSignal?.get() ?? []) as SkillCatalogEntry[]
      const modules = (modulesSignal?.get() ?? []) as ModuleModuleCatalogEntry[]
      const registry = buildRegistry({ skills, modules })
      registrySignal.set?.(registry)
      trigger({
        type: TOOL_REGISTRY_MODULE_EVENTS.tool_registry_updated,
        detail: {
          count: registry.length,
          capabilityIds: registry.map((entry) => entry.id),
        },
      })
    }

    const skillsSignal = signals.get(skillsCatalogSignalKey)
    skillsSignal?.listen(() => rebuildRegistry(), true)

    const modulesSignal = signals.get(moduleCatalogSignalKey)
    modulesSignal?.listen(() => rebuildRegistry(), true)

    rebuildRegistry()

    return {
      handlers: {
        [AGENT_EVENTS.set_signal](detail) {
          if (detail.key === skillsCatalogSignalKey || detail.key === moduleCatalogSignalKey) {
            detail.signal.listen(() => rebuildRegistry(), true)
            rebuildRegistry()
          }
        },
      },
    }
  }
