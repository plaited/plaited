type BucketAssignment = {
  id: string
  bucketKey: string
  rationale: string
}

type ValidateAssignmentsInput = {
  promptIds: string[]
  assignments: BucketAssignment[]
}

export const normalizeBucketKey = (value: string) =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

export const chunkArray = <T>(items: T[], chunkSize: number) => {
  if (chunkSize <= 0) {
    throw new Error('chunkSize must be greater than zero')
  }

  const chunks: T[][] = []

  for (let index = 0; index < items.length; index += chunkSize) {
    chunks.push(items.slice(index, index + chunkSize))
  }

  return chunks
}

export const validateAssignments = ({ promptIds, assignments }: ValidateAssignmentsInput) => {
  const promptIdSet = new Set(promptIds)
  const assignedIds = new Set<string>()

  for (const assignment of assignments) {
    if (!promptIdSet.has(assignment.id) || assignedIds.has(assignment.id)) {
      throw new Error('Invalid bucket assignments')
    }

    assignedIds.add(assignment.id)
  }

  if (assignedIds.size !== promptIdSet.size) {
    throw new Error('Invalid bucket assignments')
  }
}
