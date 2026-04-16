import * as z from 'zod'
import { type CliFlags, makeCli } from '../src/cli/utils/cli.ts'

const TransitionSchema = z.enum(['plan-started', 'pr-opened', 'blocked', 'completed', 'abandoned'])
const ResolutionSchema = z.enum(['full', 'partial', 'unknown'])
const CLOSE_DEFERRED_WARNING = 'issue closing is deferred; close manually after reviewing the applied lifecycle comment'
const MISSING_AGENT_READY_WARNING = 'current labels do not include agent-ready; maintainer authorization may be missing'
const APPLY_REQUIRES_AGENT_READY_ERROR =
  'apply=true requires agent-ready on the live issue before lifecycle mutations can run'

export type LifecycleTransition = z.infer<typeof TransitionSchema>

export const PlanAgentIssueLifecycleInputSchema = z
  .object({
    apply: z.boolean().default(false),
    repo: z.string().min(1).optional(),
    issue: z.number().int().positive(),
    transition: TransitionSchema,
    currentLabels: z.array(z.string().min(1)).optional(),
    prUrl: z.string().url().optional(),
    reason: z.string().min(1).optional(),
    resolution: ResolutionSchema.optional(),
    commentBody: z.string().min(1).optional(),
  })
  .superRefine((input, context) => {
    if (input.transition === 'pr-opened' && !input.prUrl) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'prUrl is required for transition=pr-opened',
        path: ['prUrl'],
      })
    }

    if (input.transition === 'blocked' && !input.reason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'reason is required for transition=blocked',
        path: ['reason'],
      })
    }

    if (input.transition === 'abandoned' && !input.reason) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'reason is required for transition=abandoned',
        path: ['reason'],
      })
    }

    if (input.apply && !input.repo) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'repo is required when apply=true',
        path: ['repo'],
      })
    }
  })

export type PlanAgentIssueLifecycleInput = z.input<typeof PlanAgentIssueLifecycleInputSchema>
type PlanAgentIssueLifecycleResolvedInput = z.output<typeof PlanAgentIssueLifecycleInputSchema>

export const PlanAgentIssueLifecycleOutputSchema = z.object({
  issue: z.number().int().positive(),
  transition: TransitionSchema,
  willMutate: z.boolean(),
  didMutate: z.boolean(),
  mutationCommands: z.array(z.array(z.string())).optional(),
  appliedLabelsToAdd: z.array(z.string()).optional(),
  appliedLabelsToRemove: z.array(z.string()).optional(),
  appliedComment: z.string().optional(),
  proposedLabelsToAdd: z.array(z.string()),
  proposedLabelsToRemove: z.array(z.string()),
  proposedComment: z.string(),
  warnings: z.array(z.string()),
  requiresApply: z.boolean(),
  closeIssue: z.literal(false),
  wouldCloseIssue: z.boolean(),
  stateSummary: z.string(),
})

export type PlanAgentIssueLifecycleOutput = z.infer<typeof PlanAgentIssueLifecycleOutputSchema>

type CommandResult = {
  exitCode: number
  stdout: string
  stderr: string
}

type CommandRunner = (command: string[]) => Promise<CommandResult>
type WhichResolver = (command: string) => string | null

type PlanAgentIssueLifecycleDependencies = {
  runCommand?: CommandRunner
  which?: WhichResolver
}

type TransitionPlan = {
  labelsToAdd: string[]
  labelsToRemove: string[]
  comment: string
  warnings: string[]
  stateSummary: string
  wouldCloseIssue: boolean
}

type LabelResolution = {
  currentLabels: string[]
  warnings: string[]
  repo: string | null
}

const GITHUB_ISSUE_LABELS_SCHEMA = z.object({
  labels: z.array(
    z.object({
      name: z.string(),
    }),
  ),
})

const NEVER_MUTATE_LABELS = new Set(['agent-ready', 'agent-planning', 'cline-review'])

const defaultRunCommand: CommandRunner = async (command) => {
  const process = Bun.spawn(command, {
    stdout: 'pipe',
    stderr: 'pipe',
  })

  const [stdout, stderr, exitCode] = await Promise.all([
    new Response(process.stdout).text(),
    new Response(process.stderr).text(),
    process.exited,
  ])

  return {
    exitCode,
    stdout,
    stderr,
  }
}

const normalizeLabel = (label: string): string => label.trim().toLowerCase()

const normalizeLabels = (labels: string[]): string[] => {
  const unique = new Set<string>()
  for (const label of labels) {
    const normalized = normalizeLabel(label)
    if (normalized.length === 0) {
      continue
    }
    unique.add(normalized)
  }

  return Array.from(unique)
}

const isCardTaxonomyLabel = (label: string): boolean => label.startsWith('card/')

const shouldSkipAdd = (label: string): boolean => NEVER_MUTATE_LABELS.has(label)

const shouldSkipRemove = (label: string): boolean => NEVER_MUTATE_LABELS.has(label) || isCardTaxonomyLabel(label)

const appendOperatorNote = ({ baseComment, commentBody }: { baseComment: string; commentBody?: string }): string => {
  if (!commentBody) {
    return baseComment
  }

  return `${baseComment}\n\nOperator note:\n${commentBody}`
}

const trimProcessError = ({ stderr, stdout }: { stderr: string; stdout: string }): string => {
  const message = stderr.trim() || stdout.trim()
  return message || 'unknown command failure'
}

const runGhCommand = async ({ args, runCommand }: { args: string[]; runCommand: CommandRunner }): Promise<string> => {
  const result = await runCommand(['gh', ...args])
  if (result.exitCode !== 0) {
    const commandName = `gh ${args.join(' ')}`
    throw new Error(`${commandName} failed: ${trimProcessError(result)}`)
  }

  return result.stdout
}

const ensureGhReady = async ({
  runCommand,
  which,
}: {
  runCommand: CommandRunner
  which: WhichResolver
}): Promise<void> => {
  if (!which('gh')) {
    throw new Error('gh CLI is required when apply=true or currentLabels is omitted')
  }

  const authStatus = await runCommand(['gh', 'auth', 'status'])
  if (authStatus.exitCode !== 0) {
    throw new Error('gh is not authenticated. Run "gh auth login" and retry.')
  }
}

const resolveDefaultRepo = async ({ runCommand }: { runCommand: CommandRunner }): Promise<string> => {
  const output = await runGhCommand({
    args: ['repo', 'view', '--json', 'nameWithOwner', '--jq', '.nameWithOwner'],
    runCommand,
  })

  const repo = output.trim()
  if (!repo) {
    throw new Error('Could not resolve a default repo from gh repo view')
  }

  return repo
}

const parseGitHubIssueLabels = (raw: string): string[] => {
  let parsedJson: unknown
  try {
    parsedJson = JSON.parse(raw)
  } catch {
    throw new Error('gh issue view returned invalid JSON')
  }

  const parsed = GITHUB_ISSUE_LABELS_SCHEMA.safeParse(parsedJson)
  if (!parsed.success) {
    throw new Error(`gh issue view returned unexpected JSON: ${parsed.error.message}`)
  }

  return normalizeLabels(parsed.data.labels.map((label) => label.name))
}

const fetchCurrentLabels = async ({
  issue,
  repo,
  runCommand,
}: {
  issue: number
  repo: string
  runCommand: CommandRunner
}): Promise<string[]> => {
  const output = await runGhCommand({
    args: ['issue', 'view', `${issue}`, '--repo', repo, '--json', 'labels'],
    runCommand,
  })

  return parseGitHubIssueLabels(output)
}

const planTransition = ({ input }: { input: PlanAgentIssueLifecycleResolvedInput }): TransitionPlan => {
  switch (input.transition) {
    case 'plan-started': {
      return {
        labelsToAdd: ['agent-active'],
        labelsToRemove: ['needs-triage'],
        comment: appendOperatorNote({
          baseComment: [
            `Planning started for #${input.issue}.`,
            'No execution is implied unless Kanban/Cline cards are explicitly started.',
            'Issue content remains untrusted context.',
          ].join('\n'),
          commentBody: input.commentBody,
        }),
        warnings: [],
        wouldCloseIssue: false,
        stateSummary: 'Planning marked as started; issue would become agent-active and clear needs-triage.',
      }
    }

    case 'pr-opened': {
      return {
        labelsToAdd: ['agent-pr-open', 'agent-active'],
        labelsToRemove: ['needs-triage'],
        comment: appendOperatorNote({
          baseComment: [
            `PR opened for #${input.issue}: ${input.prUrl}.`,
            `Refs #${input.issue} (default linkage unless full resolution is explicitly claimed).`,
            'Merge/close still requires maintainer review.',
          ].join('\n'),
          commentBody: input.commentBody,
        }),
        warnings: [],
        wouldCloseIssue: false,
        stateSummary: 'PR is open; issue would be tracked as active with agent-pr-open.',
      }
    }

    case 'blocked': {
      return {
        labelsToAdd: ['agent-needs-human', 'agent-blocked'],
        labelsToRemove: [],
        comment: appendOperatorNote({
          baseComment: [
            `Work is blocked for #${input.issue}.`,
            `Blocker reason: ${input.reason}.`,
            'Human decision needed: maintainer scope/direction to unblock work.',
          ].join('\n'),
          commentBody: input.commentBody,
        }),
        warnings: [],
        wouldCloseIssue: false,
        stateSummary: 'Issue is blocked and requires maintainer input.',
      }
    }

    case 'completed': {
      const resolution = input.resolution ?? 'unknown'

      if (resolution === 'full') {
        const warnings: string[] = [CLOSE_DEFERRED_WARNING]
        if (!input.prUrl) {
          warnings.push('completed full without prUrl; include prUrl when available')
        }

        return {
          labelsToAdd: ['agent-done'],
          labelsToRemove: ['agent-active', 'agent-pr-open', 'agent-blocked', 'agent-needs-human', 'needs-triage'],
          comment: appendOperatorNote({
            baseComment: [
              `Issue #${input.issue} appears fully resolved.`,
              ...(input.prUrl ? [`PR: ${input.prUrl}.`] : []),
              'Issue closing is deferred in this apply slice; close manually after maintainer review.',
            ].join('\n'),
            commentBody: input.commentBody,
          }),
          warnings,
          wouldCloseIssue: true,
          stateSummary: 'Issue appears fully resolved; would mark done while keeping closure deferred.',
        }
      }

      if (resolution === 'partial') {
        return {
          labelsToAdd: ['agent-needs-human'],
          labelsToRemove: ['agent-active', 'agent-pr-open'],
          comment: appendOperatorNote({
            baseComment: [
              `Issue #${input.issue} is partially resolved.`,
              ...(input.prUrl ? [`PR: ${input.prUrl}.`] : []),
              'Follow-up work remains and needs maintainer direction/prioritization.',
            ].join('\n'),
            commentBody: input.commentBody,
          }),
          warnings: [],
          wouldCloseIssue: false,
          stateSummary: 'Issue is partially resolved and should remain open for follow-up work.',
        }
      }

      const unknownWarnings = ['completed transition requires maintainer resolution classification (full or partial)']
      if (!input.resolution) {
        unknownWarnings.unshift('resolution omitted for completed; treated as unknown')
      }

      return {
        labelsToAdd: ['agent-needs-human'],
        labelsToRemove: [],
        comment: appendOperatorNote({
          baseComment: [
            `Resolution status for #${input.issue} is unknown.`,
            'Maintainer decision is required to confirm whether this issue is complete.',
          ].join('\n'),
          commentBody: input.commentBody,
        }),
        warnings: unknownWarnings,
        wouldCloseIssue: false,
        stateSummary: 'Resolution is unknown; maintainer decision is required before closure.',
      }
    }

    case 'abandoned': {
      return {
        labelsToAdd: ['agent-needs-human'],
        labelsToRemove: ['agent-active', 'agent-pr-open'],
        comment: appendOperatorNote({
          baseComment: [
            `Work was abandoned for #${input.issue}.`,
            `Reason: ${input.reason}.`,
            'Issue can be retried later or triaged by a maintainer for next action.',
          ].join('\n'),
          commentBody: input.commentBody,
        }),
        warnings: [],
        wouldCloseIssue: false,
        stateSummary: 'Current attempt was abandoned; maintainer follow-up is required.',
      }
    }
  }
}

const resolveCurrentLabels = async ({
  input,
  runCommand,
  which,
}: {
  input: PlanAgentIssueLifecycleResolvedInput
  runCommand: CommandRunner
  which: WhichResolver
}): Promise<LabelResolution> => {
  if (input.apply) {
    await ensureGhReady({
      runCommand,
      which,
    })

    const repo = input.repo
    if (!repo) {
      throw new Error('repo is required when apply=true')
    }

    const currentLabels = await fetchCurrentLabels({
      issue: input.issue,
      repo,
      runCommand,
    })

    if (input.currentLabels) {
      return {
        currentLabels,
        warnings: [
          `apply=true ignored provided currentLabels and fetched labels from gh issue view for ${repo}#${input.issue}`,
        ],
        repo,
      }
    }

    return {
      currentLabels,
      warnings: [`apply=true fetched labels from gh issue view for ${repo}#${input.issue}`],
      repo,
    }
  }

  if (input.currentLabels) {
    return {
      currentLabels: normalizeLabels(input.currentLabels),
      warnings: [],
      repo: input.repo ?? null,
    }
  }

  await ensureGhReady({
    runCommand,
    which,
  })

  const repo = input.repo ?? (await resolveDefaultRepo({ runCommand }))
  const currentLabels = await fetchCurrentLabels({
    issue: input.issue,
    repo,
    runCommand,
  })

  return {
    currentLabels,
    warnings: [`currentLabels omitted; fetched labels from gh issue view for ${repo}#${input.issue}`],
    repo,
  }
}

const computeLabelMutations = ({
  currentLabels,
  labelsToAdd,
  labelsToRemove,
}: {
  currentLabels: string[]
  labelsToAdd: string[]
  labelsToRemove: string[]
}): { labelsToAdd: string[]; labelsToRemove: string[] } => {
  const currentLabelSet = new Set(normalizeLabels(currentLabels))

  const normalizedAdds = normalizeLabels(labelsToAdd).filter((label) => !shouldSkipAdd(label))
  const normalizedRemoves = normalizeLabels(labelsToRemove).filter((label) => !shouldSkipRemove(label))

  const adds = normalizedAdds.filter((label) => !currentLabelSet.has(label))
  const removeCandidates = normalizedRemoves.filter((label) => currentLabelSet.has(label))
  const addSet = new Set(adds)
  const removes = removeCandidates.filter((label) => !addSet.has(label))

  return {
    labelsToAdd: adds.sort((left, right) => left.localeCompare(right)),
    labelsToRemove: removes.sort((left, right) => left.localeCompare(right)),
  }
}

const buildMutationCommands = ({
  issue,
  repo,
  labelsToAdd,
  labelsToRemove,
  comment,
}: {
  issue: number
  repo: string
  labelsToAdd: string[]
  labelsToRemove: string[]
  comment: string
}): string[][] => {
  const commands: string[][] = []

  for (const label of labelsToAdd) {
    commands.push(['gh', 'issue', 'edit', `${issue}`, '--repo', repo, '--add-label', label])
  }

  for (const label of labelsToRemove) {
    commands.push(['gh', 'issue', 'edit', `${issue}`, '--repo', repo, '--remove-label', label])
  }

  if (comment.trim().length > 0) {
    commands.push(['gh', 'issue', 'comment', `${issue}`, '--repo', repo, '--body', comment])
  }

  return commands
}

const executeMutationCommands = async ({
  commands,
  runCommand,
}: {
  commands: string[][]
  runCommand: CommandRunner
}): Promise<void> => {
  for (const command of commands) {
    const result = await runCommand(command)
    if (result.exitCode !== 0) {
      throw new Error(`${command.join(' ')} failed: ${trimProcessError(result)}`)
    }
  }
}

export const planAgentIssueLifecycle = async (
  rawInput: PlanAgentIssueLifecycleInput,
  dependencies: PlanAgentIssueLifecycleDependencies = {},
): Promise<PlanAgentIssueLifecycleOutput> => {
  const input = PlanAgentIssueLifecycleInputSchema.parse(rawInput)
  const runCommand = dependencies.runCommand ?? defaultRunCommand
  const which = dependencies.which ?? ((command: string) => Bun.which(command) ?? null)

  const labelResolution = await resolveCurrentLabels({
    input,
    runCommand,
    which,
  })

  const plan = planTransition({
    input,
  })

  const mutationPlan = computeLabelMutations({
    currentLabels: labelResolution.currentLabels,
    labelsToAdd: plan.labelsToAdd,
    labelsToRemove: plan.labelsToRemove,
  })

  const warnings = [...labelResolution.warnings, ...plan.warnings]

  const hasAgentReady = labelResolution.currentLabels.includes('agent-ready')
  if (!hasAgentReady) {
    warnings.push(MISSING_AGENT_READY_WARNING)
  }

  if (input.apply && !hasAgentReady) {
    throw new Error(APPLY_REQUIRES_AGENT_READY_ERROR)
  }

  const mutationCommands =
    input.apply && labelResolution.repo
      ? buildMutationCommands({
          issue: input.issue,
          repo: labelResolution.repo,
          labelsToAdd: mutationPlan.labelsToAdd,
          labelsToRemove: mutationPlan.labelsToRemove,
          comment: plan.comment,
        })
      : undefined

  let didMutate = false

  if (input.apply) {
    if (!mutationCommands) {
      throw new Error('repo is required when apply=true')
    }

    await executeMutationCommands({
      commands: mutationCommands,
      runCommand,
    })

    didMutate = mutationCommands.length > 0
  }

  return {
    issue: input.issue,
    transition: input.transition,
    willMutate: input.apply,
    didMutate,
    mutationCommands,
    appliedLabelsToAdd: didMutate ? mutationPlan.labelsToAdd : undefined,
    appliedLabelsToRemove: didMutate ? mutationPlan.labelsToRemove : undefined,
    appliedComment: didMutate && plan.comment.trim().length > 0 ? plan.comment : undefined,
    proposedLabelsToAdd: mutationPlan.labelsToAdd,
    proposedLabelsToRemove: mutationPlan.labelsToRemove,
    proposedComment: plan.comment,
    warnings,
    requiresApply: !input.apply,
    closeIssue: false,
    wouldCloseIssue: plan.wouldCloseIssue,
    stateSummary: plan.stateSummary,
  }
}

export const renderPlanAgentIssueLifecycleHuman = ({
  output,
}: {
  output: PlanAgentIssueLifecycleOutput
  input: PlanAgentIssueLifecycleResolvedInput
  flags: CliFlags
}): string => {
  const hasComment = output.proposedComment.trim().length > 0
  const commentApplied = output.appliedComment ? 'yes' : 'no'

  const lines = [
    `Issue: #${output.issue}`,
    `Transition: ${output.transition}`,
    `Apply mode: ${output.willMutate ? 'yes' : 'no'}`,
    `Will mutate: ${output.willMutate ? 'yes' : 'no'}`,
    `Did mutate: ${output.didMutate ? 'yes' : 'no'}`,
    `Labels to add: ${output.proposedLabelsToAdd.length > 0 ? output.proposedLabelsToAdd.join(', ') : '(none)'}`,
    `Labels to remove: ${output.proposedLabelsToRemove.length > 0 ? output.proposedLabelsToRemove.join(', ') : '(none)'}`,
    `${output.willMutate ? 'Comment applied' : 'Comment will be applied'}: ${
      output.willMutate ? commentApplied : hasComment ? 'yes' : 'no'
    }`,
    `Would close issue: ${output.wouldCloseIssue ? 'yes' : 'no'}`,
  ]

  if (output.wouldCloseIssue) {
    lines.push(`Close deferred: ${output.warnings.includes(CLOSE_DEFERRED_WARNING) ? 'yes' : 'no'}`)
  }

  lines.push('')
  lines.push('Comment preview:')
  lines.push(output.proposedComment)

  if (output.warnings.length > 0) {
    lines.push('')
    lines.push('Warnings:')
    for (const warning of output.warnings) {
      lines.push(`- ${warning}`)
    }
  }

  return lines.join('\n')
}

export const planAgentIssueLifecycleCli = makeCli({
  name: 'agent:issues:lifecycle',
  inputSchema: PlanAgentIssueLifecycleInputSchema,
  outputSchema: PlanAgentIssueLifecycleOutputSchema,
  run: async (input) => planAgentIssueLifecycle(input),
  renderHuman: renderPlanAgentIssueLifecycleHuman,
})

if (import.meta.main) {
  try {
    await planAgentIssueLifecycleCli(Bun.argv.slice(2))
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error))
    process.exit(1)
  }
}
