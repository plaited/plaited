import * as z from 'zod'

export const WorkflowRoleSchema = z.enum(['planner', 'editor', 'verifier', 'reporter'])
export type WorkflowRole = z.infer<typeof WorkflowRoleSchema>

export const WorkflowStateSchema = z.object({
  activeRoles: z.array(WorkflowRoleSchema),
  lastTransition: z.string().optional(),
})
export type WorkflowState = z.infer<typeof WorkflowStateSchema>
