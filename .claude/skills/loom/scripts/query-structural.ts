#!/usr/bin/env bun
/**
 * Query structural vocabulary from the loom skill.
 *
 * @description Returns structural IA vocabulary for agent consumption.
 * Supports querying specific topics or retrieving all structural patterns.
 *
 * @example
 * # Get all structural vocabulary
 * bun scripts/query-structural.ts
 *
 * # Get specific topic
 * bun scripts/query-structural.ts channels
 * bun scripts/query-structural.ts levers
 *
 * # Get multiple topics
 * bun scripts/query-structural.ts channels levers loops
 */

import { join } from 'node:path'

const STRUCTURAL_DIR = join(import.meta.dir, '..', 'references', 'structural')

const TOPICS = ['objects', 'channels', 'levers', 'loops', 'blocks'] as const
type Topic = (typeof TOPICS)[number]

type StructuralContent = {
  topic: Topic
  content: string
  path: string
}

type QueryResult = {
  topics: StructuralContent[]
  summary: string
}

const isValidTopic = (arg: string): arg is Topic => TOPICS.includes(arg as Topic)

const readTopic = async (topic: Topic): Promise<StructuralContent> => {
  const path = join(STRUCTURAL_DIR, `${topic}.md`)
  const file = Bun.file(path)

  if (!(await file.exists())) {
    throw new Error(`Structural reference not found: ${path}`)
  }

  const content = await file.text()
  return { topic, content, path }
}

const main = async () => {
  const args = process.argv.slice(2)

  // Determine which topics to query
  const requestedTopics: Topic[] =
    args.length === 0
      ? [...TOPICS] // All topics if no args
      : args.filter(isValidTopic)

  // Validate args
  const invalidArgs = args.filter((arg) => !isValidTopic(arg))
  if (invalidArgs.length > 0) {
    console.error(`Invalid topics: ${invalidArgs.join(', ')}`)
    console.error(`Valid topics: ${TOPICS.join(', ')}`)
    process.exit(1)
  }

  if (requestedTopics.length === 0) {
    console.error(`No valid topics specified. Valid topics: ${TOPICS.join(', ')}`)
    process.exit(1)
  }

  // Read all requested topics
  const topics = await Promise.all(requestedTopics.map(readTopic))

  const result: QueryResult = {
    topics,
    summary: `Retrieved ${topics.length} structural reference(s): ${requestedTopics.join(', ')}`,
  }

  console.log(JSON.stringify(result, null, 2))
}

main().catch((err) => {
  console.error(err.message)
  process.exit(1)
})
