/**
 * Re-ingestion handlers — reingest_skill, reingest_rules, reingest_goal.
 *
 * @remarks
 * Registered once at agent creation via `useFeedback()` (BP principle 6).
 * When the agent modifies skill, rules, or goal files during a session,
 * a bThread detects the change (via `tool_result` events) and triggers
 * the corresponding reingest event. The handler calls the library ingestion
 * function to update the hypergraph vertex in `.memory/`.
 *
 * Handlers use the library exports from `src/tools/` directly — no CLI
 * invocation, no pipeline re-entry.
 *
 * @public
 */

import type { DefaultHandlers } from '../behavioral/behavioral.types.ts'
import { ingestGoal } from '../tools/ingest-goal.ts'
import { ingestRules } from '../tools/ingest-rules.ts'
import { ingestSkill } from '../tools/ingest-skill.ts'
import { AGENT_EVENTS } from './agent.constants.ts'
import type { ReingestGoalDetail, ReingestRulesDetail, ReingestSkillDetail } from './agent.types.ts'

/**
 * Create re-ingestion handlers for the agent loop.
 *
 * @remarks
 * Returns a `DefaultHandlers` object to be registered once via `useFeedback()`.
 * Each handler wraps the corresponding library ingestion function, catching
 * errors and logging to stderr (handlers are fire-and-forget — they must not
 * throw into the BP engine).
 *
 * @returns Handler map for reingest_skill, reingest_rules, and reingest_goal events
 *
 * @public
 */
export const createReingestHandlers = (): DefaultHandlers => ({
  /**
   * reingest_skill — re-ingest a skill directory after modification.
   *
   * @remarks
   * Calls `ingestSkill(skillDir, memoryDir)` to update the Skill vertex
   * in `.memory/skills/`. Errors are logged, not thrown.
   */
  [AGENT_EVENTS.reingest_skill]: async (detail: unknown) => {
    const { skillDir, memoryDir } = detail as ReingestSkillDetail
    try {
      await ingestSkill(skillDir, memoryDir)
    } catch (error) {
      console.error(`reingest_skill failed for ${skillDir}: ${error instanceof Error ? error.message : String(error)}`)
    }
  },

  /**
   * reingest_rules — re-ingest AGENTS.md after modification.
   *
   * @remarks
   * Calls `ingestRules(path, memoryDir)` to update the RuleSet vertices
   * in `.memory/rules/`. Errors are logged, not thrown.
   */
  [AGENT_EVENTS.reingest_rules]: async (detail: unknown) => {
    const { path, memoryDir } = detail as ReingestRulesDetail
    try {
      await ingestRules(path, memoryDir)
    } catch (error) {
      console.error(`reingest_rules failed for ${path}: ${error instanceof Error ? error.message : String(error)}`)
    }
  },

  /**
   * reingest_goal — re-ingest a goal factory after modification.
   *
   * @remarks
   * Calls `ingestGoal(path, memoryDir)` to update the Goal vertex
   * in `.memory/threads/`. Errors are logged, not thrown.
   */
  [AGENT_EVENTS.reingest_goal]: async (detail: unknown) => {
    const { path, memoryDir } = detail as ReingestGoalDetail
    try {
      await ingestGoal(path, memoryDir)
    } catch (error) {
      console.error(`reingest_goal failed for ${path}: ${error instanceof Error ? error.message : String(error)}`)
    }
  },
})
