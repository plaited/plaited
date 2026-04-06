import type { Factory } from '../../agent.ts'
import { SEARCH_FACTORY_SIGNAL_KEYS } from '../search-factory/search-factory.constants.ts'
import type { SearchResults } from '../search-factory/search-factory.schemas.ts'
import { SKILLS_FACTORY_SIGNAL_KEYS } from '../skills-factory/skills-factory.constants.ts'
import type { SelectedSkill } from '../skills-factory/skills-factory.schemas.ts'
import { TOOL_REGISTRY_FACTORY_SIGNAL_KEYS } from '../tool-registry-factory/tool-registry-factory.constants.ts'
import type { CapabilityRecord } from '../tool-registry-factory/tool-registry-factory.schemas.ts'
import { PROJECTION_FACTORY_EVENTS, PROJECTION_FACTORY_SIGNAL_KEYS } from './projection-factory.constants.ts'
import {
  type ProjectionBlock,
  ProjectionBlockSchema,
  ProjectionBlocksSchema,
  type ProjectionPhase,
  ProjectionPhaseSchema,
} from './projection-factory.schemas.ts'
import type { CreateProjectionFactoryOptions } from './projection-factory.types.ts'

const buildProjectionBlocks = ({
  phase,
  selectedSkill,
  searchResults,
  toolRegistry,
}: {
  phase: 'planning' | 'execution' | 'verification'
  selectedSkill: SelectedSkill | null
  searchResults: SearchResults | null
  toolRegistry: CapabilityRecord[]
}): ProjectionBlock[] => {
  const blocks: ProjectionBlock[] = []

  if (selectedSkill) {
    blocks.push(
      ProjectionBlockSchema.parse({
        id: 'selected-skill',
        title: 'Selected Skill',
        body:
          phase === 'planning'
            ? `${selectedSkill.name}: ${selectedSkill.description}`
            : `${selectedSkill.name}: ${selectedSkill.body.split('\n').slice(0, 4).join('\n')}`,
        sourceIds: [`skill:${selectedSkill.name}`],
      }),
    )
  }

  if (searchResults && searchResults.results.length > 0) {
    blocks.push(
      ProjectionBlockSchema.parse({
        id: 'search-evidence',
        title: 'Search Evidence',
        body: searchResults.results
          .slice(0, phase === 'planning' ? 3 : 2)
          .map((result) => `${result.label}: ${result.description}`)
          .join('\n'),
        sourceIds: searchResults.results.slice(0, 3).map((result) => result.id),
      }),
    )
  }

  blocks.push(
    ProjectionBlockSchema.parse({
      id: 'capability-summary',
      title: 'Capability Summary',
      body: `${toolRegistry.length} compact capabilities available`,
      sourceIds: toolRegistry.slice(0, 5).map((entry) => entry.id),
    }),
  )

  return blocks
}

/**
 * Creates the bounded projection factory.
 *
 * @public
 */
export const createProjectionFactory =
  ({
    phaseSignalKey = PROJECTION_FACTORY_SIGNAL_KEYS.phase,
    blocksSignalKey = PROJECTION_FACTORY_SIGNAL_KEYS.blocks,
    selectedSkillSignalKey = SKILLS_FACTORY_SIGNAL_KEYS.selected,
    searchResultsSignalKey = SEARCH_FACTORY_SIGNAL_KEYS.results,
    toolRegistrySignalKey = TOOL_REGISTRY_FACTORY_SIGNAL_KEYS.registry,
  }: CreateProjectionFactoryOptions = {}): Factory =>
  ({ signals, trigger }) => {
    const phaseSignal =
      signals.get(phaseSignalKey) ??
      signals.set({
        key: phaseSignalKey,
        schema: ProjectionPhaseSchema,
        value: 'planning',
        readOnly: false,
      })

    const blocksSignal =
      signals.get(blocksSignalKey) ??
      signals.set({
        key: blocksSignalKey,
        schema: ProjectionBlocksSchema,
        value: [],
        readOnly: false,
      })

    const rebuildProjection = () => {
      const phase = (phaseSignal.get() ?? 'planning') as ProjectionPhase
      const selectedSkill = (signals.get(selectedSkillSignalKey)?.get() ?? null) as SelectedSkill | null
      const searchResults = (signals.get(searchResultsSignalKey)?.get() ?? null) as SearchResults | null
      const toolRegistry = (signals.get(toolRegistrySignalKey)?.get() ?? []) as CapabilityRecord[]
      const blocks = buildProjectionBlocks({
        phase,
        selectedSkill,
        searchResults,
        toolRegistry,
      })
      blocksSignal.set?.(blocks)
      trigger({
        type: PROJECTION_FACTORY_EVENTS.projection_factory_updated,
        detail: {
          phase,
          count: blocks.length,
          blockIds: blocks.map((block) => block.id),
        },
      })
    }

    phaseSignal.listen(() => rebuildProjection(), true)
    signals.get(selectedSkillSignalKey)?.listen(() => rebuildProjection(), true)
    signals.get(searchResultsSignalKey)?.listen(() => rebuildProjection(), true)
    signals.get(toolRegistrySignalKey)?.listen(() => rebuildProjection(), true)

    rebuildProjection()

    return {}
  }
