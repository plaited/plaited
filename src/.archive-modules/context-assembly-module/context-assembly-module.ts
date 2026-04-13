import type { Module } from '../../agent.ts'
import { PLAN_MODULE_SIGNAL_KEYS } from '../plan-module/plan-module.constants.ts'
import type { PlanState } from '../plan-module/plan-module.schemas.ts'
import { PROJECTION_MODULE_SIGNAL_KEYS } from '../projection-module/projection-module.constants.ts'
import type { ProjectionBlock } from '../projection-module/projection-module.schemas.ts'
import { SEARCH_MODULE_SIGNAL_KEYS } from '../search-module/search-module.constants.ts'
import type { SearchResults } from '../search-module/search-module.schemas.ts'
import { TOOL_REGISTRY_MODULE_SIGNAL_KEYS } from '../tool-registry-module/tool-registry-module.constants.ts'
import type { CapabilityRecord } from '../tool-registry-module/tool-registry-module.schemas.ts'
import {
  CONTEXT_ASSEMBLY_MODULE_EVENTS,
  CONTEXT_ASSEMBLY_MODULE_SIGNAL_KEYS,
} from './context-assembly-module.constants.ts'
import {
  AssembledContextBlockSchema,
  type AssembledRequest,
  AssembledRequestSchema,
} from './context-assembly-module.schemas.ts'
import type { CreateContextAssemblyModuleOptions } from './context-assembly-module.types.ts'

const buildRequest = ({
  phase,
  plan,
  projectionBlocks,
  searchResults,
  toolRegistry,
}: {
  phase: string
  plan: PlanState | null
  projectionBlocks: ProjectionBlock[]
  searchResults: SearchResults | null
  toolRegistry: CapabilityRecord[]
}): AssembledRequest => {
  const blocks = []

  if (plan) {
    blocks.push(
      AssembledContextBlockSchema.parse({
        id: 'plan-state',
        title: 'Plan State',
        body: `${plan.goal}\n${plan.steps.map((step) => `${step.id}:${step.status}`).join('\n')}`,
        sourceIds: plan.steps.map((step) => step.id),
      }),
    )
  }

  for (const block of projectionBlocks.slice(0, 2)) {
    blocks.push(
      AssembledContextBlockSchema.parse({
        id: block.id,
        title: block.title,
        body: block.body,
        sourceIds: block.sourceIds,
      }),
    )
  }

  if (searchResults) {
    blocks.push(
      AssembledContextBlockSchema.parse({
        id: 'search-results',
        title: 'Selected Search Evidence',
        body: searchResults.results
          .slice(0, 3)
          .map((entry) => `${entry.label}: ${entry.description}`)
          .join('\n'),
        sourceIds: searchResults.results.slice(0, 3).map((entry) => entry.id),
      }),
    )
  }

  blocks.push(
    AssembledContextBlockSchema.parse({
      id: 'capability-selection',
      title: 'Capability Selection',
      body: toolRegistry
        .slice(0, 5)
        .map((entry) => `${entry.name}: ${entry.description}`)
        .join('\n'),
      sourceIds: toolRegistry.slice(0, 5).map((entry) => entry.id),
    }),
  )

  return AssembledRequestSchema.parse({
    phase,
    blocks,
  })
}

/**
 * Creates the phase-aware context assembly module.
 *
 * @public
 */
export const createContextAssemblyModule =
  ({
    requestSignalKey = CONTEXT_ASSEMBLY_MODULE_SIGNAL_KEYS.request,
    phaseSignalKey = PROJECTION_MODULE_SIGNAL_KEYS.phase,
    projectionBlocksSignalKey = PROJECTION_MODULE_SIGNAL_KEYS.blocks,
    searchResultsSignalKey = SEARCH_MODULE_SIGNAL_KEYS.results,
    toolRegistrySignalKey = TOOL_REGISTRY_MODULE_SIGNAL_KEYS.registry,
    planSignalKey = PLAN_MODULE_SIGNAL_KEYS.plan,
  }: CreateContextAssemblyModuleOptions = {}): Module =>
  ({ signals, trigger }) => {
    const requestSignal =
      signals.get(requestSignalKey) ??
      signals.set({
        key: requestSignalKey,
        schema: AssembledRequestSchema,
        value: {
          phase: 'planning',
          blocks: [],
        },
        readOnly: false,
      })

    const rebuild = () => {
      const phase = String(signals.get(phaseSignalKey)?.get() ?? 'planning')
      const plan = (signals.get(planSignalKey)?.get() ?? null) as PlanState | null
      const projectionBlocks = (signals.get(projectionBlocksSignalKey)?.get() ?? []) as ProjectionBlock[]
      const searchResults = (signals.get(searchResultsSignalKey)?.get() ?? null) as SearchResults | null
      const toolRegistry = (signals.get(toolRegistrySignalKey)?.get() ?? []) as CapabilityRecord[]
      const request = buildRequest({
        phase,
        plan,
        projectionBlocks,
        searchResults,
        toolRegistry,
      })
      requestSignal.set?.(request)
      trigger({
        type: CONTEXT_ASSEMBLY_MODULE_EVENTS.context_assembly_module_updated,
        detail: {
          phase: request.phase,
          blockCount: request.blocks.length,
        },
      })
    }

    signals.get(phaseSignalKey)?.listen(() => rebuild(), true)
    signals.get(planSignalKey)?.listen(() => rebuild(), true)
    signals.get(projectionBlocksSignalKey)?.listen(() => rebuild(), true)
    signals.get(searchResultsSignalKey)?.listen(() => rebuild(), true)
    signals.get(toolRegistrySignalKey)?.listen(() => rebuild(), true)

    return {
      handlers: {
        [CONTEXT_ASSEMBLY_MODULE_EVENTS.context_assembly_module_rebuild]() {
          rebuild()
        },
      },
    }
  }
