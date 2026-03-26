import type { ReviewPrompt, WorkflowMode } from './modnet-pi-workflow.ts'

export type RoundStatus = 'running' | 'completed' | 'accepted' | 'rejected' | 'superseded' | 'failed'

export type RoundManifest = {
  queuePromptId: string
  promptId: string
  promptTitle: string
  mode: WorkflowMode
  feedback: string
  roundNumber: number
  sourcePrompt: ReviewPrompt
  createdAt: string
  status: RoundStatus
  basedOnRoundNumber?: number
  completedAt?: string
  resolvedAt?: string
  error?: string
}

export type DecisionRowLike = {
  id: string
  action: string
}

const TERMINAL_DECISION_ACTIONS = new Set(['keep', 'remove', 'skip', 'accept-winner', 'reject-winner'])

export const buildCompletedPromptIds = (decisions: DecisionRowLike[]): Set<string> =>
  new Set(decisions.filter((decision) => TERMINAL_DECISION_ACTIONS.has(decision.action)).map((decision) => decision.id))

export const isRoundActionTerminal = (status: RoundStatus): boolean =>
  status === 'accepted' || status === 'rejected' || status === 'superseded' || status === 'failed'

export const buildBlockedPromptIds = (manifests: RoundManifest[]): Set<string> =>
  new Set(
    manifests.filter((manifest) => !isRoundActionTerminal(manifest.status)).map((manifest) => manifest.queuePromptId),
  )

export const pickReadyManifest = (manifests: RoundManifest[]): RoundManifest | null =>
  [...manifests]
    .filter((manifest) => manifest.status === 'completed' && manifest.completedAt)
    .sort((a, b) => a.completedAt!.localeCompare(b.completedAt!))[0] ?? null
