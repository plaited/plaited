import { AGENT_EVENTS } from '../agent/agent.constants.ts'
import type { EvalRejectedDetail, SimulateRequestDetail, SimulationResultDetail } from '../agent/agent.types.ts'
import { evaluate } from '../agent/evaluate.ts'
import { simulate } from '../agent/simulate.ts'
import type { SimulationEvaluationFactoryCreator } from './factories.types.ts'

/**
 * Creates the default simulation/evaluation factory promoted out of the
 * legacy loop.
 *
 * @remarks
 * This factory owns:
 * - `simulate_request`
 * - `simulation_result`
 * - `eval_approved`
 * - `eval_rejected`
 *
 * It keeps the simulation and evaluation phases separate in the event flow
 * while using the same model interface underneath.
 *
 * @public
 */
export const createSimulationEvaluationFactory: SimulationEvaluationFactoryCreator =
  ({ model, getGoal, getHistory }) =>
  ({ trigger }) => ({
    handlers: {
      async [AGENT_EVENTS.simulate_request](detail: unknown) {
        const request = detail as SimulateRequestDetail

        try {
          const result = await simulate({
            toolCall: request.toolCall,
            history: getHistory(),
            model,
            signal: AbortSignal.timeout(30_000),
          })

          trigger({
            type: AGENT_EVENTS.simulation_result,
            detail: {
              toolCall: request.toolCall,
              prediction: result.predictedOutput,
              tags: request.tags,
            } satisfies SimulationResultDetail,
          })
        } catch (error) {
          trigger({
            type: AGENT_EVENTS.eval_rejected,
            detail: {
              toolCall: request.toolCall,
              reason: `Simulation failed: ${error instanceof Error ? error.message : String(error)}`,
            } satisfies EvalRejectedDetail,
          })
        }
      },

      async [AGENT_EVENTS.simulation_result](detail: unknown) {
        const result = detail as SimulationResultDetail

        try {
          const evaluation = await evaluate({
            simulatedOutput: result.prediction,
            goal: getGoal(),
            model,
            signal: AbortSignal.timeout(30_000),
          })

          if (evaluation.approved) {
            trigger({
              type: AGENT_EVENTS.eval_approved,
              detail: {
                toolCall: result.toolCall,
                tags: result.tags,
                ...(evaluation.score !== undefined ? { score: evaluation.score } : {}),
              },
            })
            return
          }

          trigger({
            type: AGENT_EVENTS.eval_rejected,
            detail: {
              toolCall: result.toolCall,
              reason: evaluation.reason ?? 'Evaluation rejected',
              ...(evaluation.score !== undefined ? { score: evaluation.score } : {}),
            } satisfies EvalRejectedDetail,
          })
        } catch (error) {
          trigger({
            type: AGENT_EVENTS.eval_rejected,
            detail: {
              toolCall: result.toolCall,
              reason: `Evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
            } satisfies EvalRejectedDetail,
          })
        }
      },
    },
  })
