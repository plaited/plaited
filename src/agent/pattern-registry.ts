/**
 * Pattern Registry.
 * Indexes validated stories as reusable UI patterns.
 *
 * @remarks
 * Stories that pass validation become indexed patterns that the agent
 * can reference when generating new UI. This enables:
 * - Composition over generation (use validated elements)
 * - Pattern matching for similar intents
 * - Progressive disclosure of available patterns
 *
 * Patterns are indexed by:
 * - Intent (natural language description)
 * - Tags (categorical metadata)
 * - Template name (import reference)
 */

import type { StoryResult } from './agent.types.ts'
import { extractIntent, type StoryInfo } from './generate-trajectories.ts'

// ============================================================================
// Pattern Types
// ============================================================================

/**
 * A validated UI pattern derived from a passing story.
 */
export type Pattern = {
  /** Unique identifier */
  id: string
  /** Natural language intent this pattern fulfills */
  intent: string
  /** Import path for the BehavioralTemplate */
  templatePath: string
  /** Export name of the template */
  templateExport: string
  /** Story file path (for reference) */
  storyPath: string
  /** Story export name */
  storyExport: string
  /** Tags for categorization */
  tags: string[]
  /** Usage example (JSX-like) */
  usage?: string
  /** Props schema if available */
  propsSchema?: Record<string, unknown>
  /** When pattern was indexed */
  indexedAt: number
  /** Validation result that qualified this pattern */
  validation: {
    passed: boolean
    a11yPassed: boolean
    assertionRatio: number
  }
}

/**
 * Pattern match result with relevance score.
 */
export type PatternMatch = {
  pattern: Pattern
  /** Relevance score (0-1) based on intent similarity */
  score: number
  /** Why this pattern matched */
  matchReason: string
}

/**
 * Configuration for pattern indexing.
 */
export type PatternIndexConfig = {
  /** Minimum assertion pass ratio to index (default: 1.0 = all must pass) */
  minAssertionRatio?: number
  /** Require a11y pass (default: true) */
  requireA11y?: boolean
  /** Custom tag extractor */
  extractTags?: (story: StoryInfo) => string[]
}

// ============================================================================
// Pattern Registry Implementation
// ============================================================================

/**
 * Creates a pattern registry for indexing validated stories.
 *
 * @param config - Optional indexing configuration
 * @returns Registry with methods to add, query, and manage patterns
 *
 * @remarks
 * The registry provides:
 * - `index` - Add a validated story as a pattern
 * - `search` - Find patterns matching an intent
 * - `getByTag` - Filter patterns by tag
 * - `all` - Get all indexed patterns
 *
 * Patterns are stored in memory. For persistence, serialize
 * the `all()` output and restore with `restore()`.
 */
export const createPatternRegistry = (config: PatternIndexConfig = {}) => {
  const { minAssertionRatio = 1.0, requireA11y = true, extractTags = defaultTagExtractor } = config

  const patterns = new Map<string, Pattern>()
  const intentIndex = new Map<string, Set<string>>() // word → pattern IDs
  const tagIndex = new Map<string, Set<string>>() // tag → pattern IDs

  /**
   * Index words from intent for search.
   */
  const indexIntent = (patternId: string, intent: string) => {
    const words = intent.toLowerCase().split(/\s+/)
    for (const word of words) {
      if (word.length < 2) continue // Skip short words
      if (!intentIndex.has(word)) {
        intentIndex.set(word, new Set())
      }
      intentIndex.get(word)!.add(patternId)
    }
  }

  /**
   * Index tags for filtering.
   */
  const indexTags = (patternId: string, tags: string[]) => {
    for (const tag of tags) {
      const normalizedTag = tag.toLowerCase()
      if (!tagIndex.has(normalizedTag)) {
        tagIndex.set(normalizedTag, new Set())
      }
      tagIndex.get(normalizedTag)!.add(patternId)
    }
  }

  return {
    /**
     * Index a validated story as a pattern.
     *
     * @param story - Story metadata
     * @param result - Validation result
     * @param options - Additional pattern metadata
     * @returns The created pattern, or undefined if validation failed
     */
    index(
      story: StoryInfo,
      result: StoryResult,
      options?: {
        templatePath?: string
        templateExport?: string
        usage?: string
        propsSchema?: Record<string, unknown>
      },
    ): Pattern | undefined {
      // Check if story passes indexing criteria
      const assertionRatio = result.totalAssertions > 0 ? result.passedAssertions / result.totalAssertions : 0

      if (assertionRatio < minAssertionRatio) {
        return undefined
      }

      if (requireA11y && !result.a11yPassed) {
        return undefined
      }

      // Generate pattern ID
      const id = `${story.filePath}:${story.exportName}`

      // Extract intent
      const intent = extractIntent(story)

      // Extract tags
      const tags = extractTags(story)

      // Create pattern
      const pattern: Pattern = {
        id,
        intent,
        templatePath: options?.templatePath ?? inferTemplatePath(story.filePath),
        templateExport: options?.templateExport ?? story.exportName.replace(/Story$/, ''),
        storyPath: story.filePath,
        storyExport: story.exportName,
        tags,
        usage: options?.usage,
        propsSchema: options?.propsSchema,
        indexedAt: Date.now(),
        validation: {
          passed: result.passed,
          a11yPassed: result.a11yPassed,
          assertionRatio,
        },
      }

      // Store pattern
      patterns.set(id, pattern)

      // Index for search
      indexIntent(id, intent)
      indexTags(id, tags)

      return pattern
    },

    /**
     * Search for patterns matching an intent.
     *
     * @param query - Natural language query
     * @param options - Search options
     * @returns Matched patterns sorted by relevance
     */
    search(query: string, options?: { limit?: number; minScore?: number }): PatternMatch[] {
      const { limit = 10, minScore = 0.1 } = options ?? {}

      const queryWords = query.toLowerCase().split(/\s+/)
      const scores = new Map<string, number>()
      const matchReasons = new Map<string, string[]>()

      // Score patterns based on word matches
      for (const word of queryWords) {
        if (word.length < 2) continue

        const matchingIds = intentIndex.get(word)
        if (matchingIds) {
          for (const id of matchingIds) {
            const current = scores.get(id) ?? 0
            scores.set(id, current + 1)

            if (!matchReasons.has(id)) {
              matchReasons.set(id, [])
            }
            matchReasons.get(id)!.push(word)
          }
        }
      }

      // Normalize scores and filter
      const matches: PatternMatch[] = []
      const maxScore = queryWords.length

      for (const [id, rawScore] of scores) {
        const score = rawScore / maxScore
        if (score >= minScore) {
          const pattern = patterns.get(id)
          if (pattern) {
            matches.push({
              pattern,
              score,
              matchReason: `Matched: ${matchReasons.get(id)!.join(', ')}`,
            })
          }
        }
      }

      // Sort by score (descending) and limit
      return matches.sort((a, b) => b.score - a.score).slice(0, limit)
    },

    /**
     * Get patterns by tag.
     *
     * @param tag - Tag to filter by
     * @returns Patterns with this tag
     */
    getByTag(tag: string): Pattern[] {
      const normalizedTag = tag.toLowerCase()
      const ids = tagIndex.get(normalizedTag)
      if (!ids) return []

      return Array.from(ids)
        .map((id) => patterns.get(id))
        .filter((p): p is Pattern => p !== undefined)
    },

    /**
     * Get a pattern by ID.
     */
    get(id: string): Pattern | undefined {
      return patterns.get(id)
    },

    /**
     * Get all indexed patterns.
     */
    all(): Pattern[] {
      return Array.from(patterns.values())
    },

    /**
     * Get available tags with counts.
     */
    tags(): Map<string, number> {
      const counts = new Map<string, number>()
      for (const [tag, ids] of tagIndex) {
        counts.set(tag, ids.size)
      }
      return counts
    },

    /**
     * Remove a pattern from the registry.
     */
    remove(id: string): boolean {
      const pattern = patterns.get(id)
      if (!pattern) return false

      // Remove from indexes
      const words = pattern.intent.toLowerCase().split(/\s+/)
      for (const word of words) {
        intentIndex.get(word)?.delete(id)
      }

      for (const tag of pattern.tags) {
        tagIndex.get(tag.toLowerCase())?.delete(id)
      }

      patterns.delete(id)
      return true
    },

    /**
     * Clear all patterns.
     */
    clear(): void {
      patterns.clear()
      intentIndex.clear()
      tagIndex.clear()
    },

    /**
     * Restore patterns from serialized data.
     */
    restore(data: Pattern[]): void {
      this.clear()
      for (const pattern of data) {
        patterns.set(pattern.id, pattern)
        indexIntent(pattern.id, pattern.intent)
        indexTags(pattern.id, pattern.tags)
      }
    },

    /**
     * Get registry statistics.
     */
    stats(): {
      totalPatterns: number
      totalTags: number
      avgAssertionRatio: number
      a11yPassRate: number
    } {
      const all = this.all()
      const total = all.length

      if (total === 0) {
        return { totalPatterns: 0, totalTags: 0, avgAssertionRatio: 0, a11yPassRate: 0 }
      }

      const avgAssertionRatio = all.reduce((sum, p) => sum + p.validation.assertionRatio, 0) / total
      const a11yPassRate = all.filter((p) => p.validation.a11yPassed).length / total

      return {
        totalPatterns: total,
        totalTags: tagIndex.size,
        avgAssertionRatio,
        a11yPassRate,
      }
    },
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Default tag extractor.
 * Extracts tags from story file path and export name.
 */
const defaultTagExtractor = (story: StoryInfo): string[] => {
  const tags: string[] = []

  // Extract from file path (e.g., "src/templates/button.stories.tsx" → ["templates", "button"])
  const pathParts = story.filePath
    .replace(/\.stories\.tsx?$/, '')
    .split('/')
    .filter((p) => p && p !== 'src')

  tags.push(...pathParts)

  // Extract category from export name (e.g., "PrimaryButton" → ["primary"])
  const words = story.exportName
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .toLowerCase()
    .split(' ')
    .filter((w) => w.length > 2)

  tags.push(...words)

  return [...new Set(tags)] // Dedupe
}

/**
 * Infer template path from story path.
 * Converts "button.stories.tsx" → "button.tsx"
 */
const inferTemplatePath = (storyPath: string): string => {
  return storyPath.replace(/\.stories\.tsx?$/, '.tsx')
}

/**
 * Pattern Registry type for external use.
 */
export type PatternRegistry = ReturnType<typeof createPatternRegistry>
