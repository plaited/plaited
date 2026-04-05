import type { infer as Infer } from 'zod'
import type {
  ActiveAutoresearchRunSchema,
  AutoresearchFactoryModeSchema,
  AutoresearchFactoryPolicySchema,
  ImprovementJobSchema,
  ImprovementTargetSchema,
  PromotionDecisionSchema,
} from './autoresearch-factory.schemas.ts'

/** @public */
export type AutoresearchFactoryMode = Infer<typeof AutoresearchFactoryModeSchema>

/** @public */
export type ImprovementTarget = Infer<typeof ImprovementTargetSchema>

/** @public */
export type ImprovementJob = Infer<typeof ImprovementJobSchema>

/** @public */
export type ActiveAutoresearchRun = Infer<typeof ActiveAutoresearchRunSchema>

/** @public */
export type PromotionDecision = Infer<typeof PromotionDecisionSchema>

/** @public */
export type AutoresearchFactoryPolicy = Infer<typeof AutoresearchFactoryPolicySchema>
