import type { infer as Infer } from 'zod'
import type {
  ActiveAutoresearchRunSchema,
  AutoresearchModuleModeSchema,
  AutoresearchModulePolicySchema,
  ImprovementJobSchema,
  ImprovementTargetSchema,
  PromotionDecisionSchema,
} from './autoresearch-module.schemas.ts'

/** @public */
export type AutoresearchModuleMode = Infer<typeof AutoresearchModuleModeSchema>

/** @public */
export type ImprovementTarget = Infer<typeof ImprovementTargetSchema>

/** @public */
export type ImprovementJob = Infer<typeof ImprovementJobSchema>

/** @public */
export type ActiveAutoresearchRun = Infer<typeof ActiveAutoresearchRunSchema>

/** @public */
export type PromotionDecision = Infer<typeof PromotionDecisionSchema>

/** @public */
export type AutoresearchModulePolicy = Infer<typeof AutoresearchModulePolicySchema>
