import * as z from 'zod'
import { AgentPlanStepSchema } from '../../agent.ts'

export const PlanStepStatusSchema = z.enum(['pending', 'in_progress', 'blocked', 'completed'])
export type PlanStepStatus = z.infer<typeof PlanStepStatusSchema>

export const RuntimePlanStepSchema = AgentPlanStepSchema.extend({
  status: PlanStepStatusSchema,
  note: z.string().optional(),
})
export type RuntimePlanStep = z.infer<typeof RuntimePlanStepSchema>

export const PlanPhaseSchema = z.enum(['planning', 'execution', 'verification', 'completed'])
export type PlanPhase = z.infer<typeof PlanPhaseSchema>

export const PlanStateSchema = z.object({
  goal: z.string().min(1),
  phase: PlanPhaseSchema,
  steps: z.array(RuntimePlanStepSchema),
  lastReplanCause: z.string().optional(),
})
export type PlanState = z.infer<typeof PlanStateSchema>

export const NullablePlanStateSchema = PlanStateSchema.nullable()

export const SetPlanDetailSchema = z.object({
  goal: z.string().min(1),
  steps: z.array(AgentPlanStepSchema).min(1),
})
export type SetPlanDetail = z.infer<typeof SetPlanDetailSchema>

export const UpdatePlanStepDetailSchema = z.object({
  id: z.string().min(1),
  status: PlanStepStatusSchema,
  note: z.string().optional(),
})
export type UpdatePlanStepDetail = z.infer<typeof UpdatePlanStepDetailSchema>

export const ReplanDetailSchema = z.object({
  cause: z.string().min(1),
  steps: z.array(AgentPlanStepSchema).min(1).optional(),
})
export type ReplanDetail = z.infer<typeof ReplanDetailSchema>
