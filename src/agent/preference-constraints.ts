/**
 * User preference constraints for hybrid UI.
 *
 * @remarks
 * Allows users to specify familiar structures they prefer.
 * Generated content fills in dynamic parts while maintaining
 * structural consistency with their preferences.
 *
 * This implements the "Hybrid UI" concept from NNGroup's AI paradigm research:
 * familiar structures combined with generative content creates comfort.
 */

import type { BPEvent, BSync, BThread, RulesFunction } from '../main/behavioral.types.ts'
import type { BlockType, ObjectGrouping, StructuralMetadata, UserPreferenceProfile } from './agent.types.ts'

// ============================================================================
// Structural Metadata Extraction
// ============================================================================

/**
 * Extract structural metadata from generated template code.
 *
 * @param code - The generated template code
 * @returns Extracted structural metadata
 *
 * @remarks
 * Analyzes code to identify structural patterns from the loom vocabulary:
 * - Objects: Elements conceived as "one" thing
 * - Channels: Type contracts for information flow
 * - Loops: Action → Response cycles
 * - Levers: Tools that shape user energy
 * - Blocks: Emergent compositional patterns
 */
export const extractStructuralMetadata = (code: string): StructuralMetadata => {
  const objects: StructuralMetadata['objects'] = []
  const loops: StructuralMetadata['loops'] = []
  const levers: string[] = []
  let channel: StructuralMetadata['channel']
  let block: BlockType | undefined

  // Extract object definitions (template functions, bElements)
  // Matches multiple patterns:
  // - const X = bElement(...) - behavioral element factory
  // - const X: FT<...> = ... - typed functional template
  // - const X = FT(...) - FT function call
  // - const X = story(...) - story definition
  // - const X = () => (...) or const X = () => < - template arrow functions
  const patterns = [
    /(?:const|export const)\s+(\w+)\s*=\s*bElement/g, // bElement
    /(?:const|export const)\s+(\w+)\s*:\s*FT(?:<[^>]*>)?\s*=/g, // FT typed
    /(?:const|export const)\s+(\w+)\s*=\s*FT\s*\(/g, // FT call
    /(?:const|export const)\s+(\w+)\s*=\s*story/g, // story
    /(?:const|export const)\s+(\w+)\s*=\s*\([^)]*\)\s*=>\s*[(<]/g, // arrow template
  ]

  for (const pattern of patterns) {
    for (const match of code.matchAll(pattern)) {
      if (match[1]) objects.push({ name: match[1] })
    }
  }

  // Detect grouping patterns
  // List pattern: {something.map(...)} - using word boundary to detect .map( calls
  const listPattern = /\w+\.map\s*\(/
  // Steps pattern: Step/Wizard/Stage elements or class names
  const stepsPattern = /step|wizard|stage/i
  // Nested pattern: elements containing other elements
  const nestedPattern = /<\w+[^>]*>[\s\S]*?<\w+[^>]*>[\s\S]*?<\/\w+>[\s\S]*?<\/\w+>/

  // Apply grouping detection in priority order
  // If no objects are detected but a grouping pattern exists, create an anonymous object
  let detectedGrouping: ObjectGrouping | undefined
  if (listPattern.test(code)) {
    detectedGrouping = 'list'
  } else if (stepsPattern.test(code)) {
    detectedGrouping = 'steps'
  } else if (nestedPattern.test(code)) {
    detectedGrouping = 'nested'
  }

  if (detectedGrouping) {
    if (objects.length > 0) {
      for (const obj of objects) {
        obj.grouping = detectedGrouping
      }
    } else {
      // Create anonymous object for grouping detection
      objects.push({ name: '_anonymous', grouping: detectedGrouping })
    }
  }

  // Extract loops (p-trigger → handler pairs)
  const triggerPattern = /p-trigger\s*=\s*["'](\w+)["']/g
  const triggers = new Set<string>()
  for (const triggerMatch of code.matchAll(triggerPattern)) {
    if (triggerMatch[1]) {
      triggers.add(triggerMatch[1])
    }
  }

  // Match with handlers in triggers config using brace counting
  const handlers = new Set<string>()
  const triggersStart = code.match(/triggers:\s*\{/)
  if (triggersStart?.index !== undefined) {
    const startIdx = triggersStart.index + triggersStart[0].length
    let braceCount = 1
    let endIdx = startIdx
    for (let i = startIdx; i < code.length && braceCount > 0; i++) {
      if (code[i] === '{') braceCount++
      else if (code[i] === '}') braceCount--
      endIdx = i
    }
    const triggersContent = code.slice(startIdx, endIdx)

    // Extract handler names from triggers object
    const handlerPattern = /(?:^|,|\{)\s*['"]?(\w+)['"]?\s*:/gm
    for (const handlerMatch of triggersContent.matchAll(handlerPattern)) {
      if (handlerMatch[1]) handlers.add(handlerMatch[1])
    }
  }

  // Create loops from matched pairs
  for (const trigger of triggers) {
    if (handlers.has(trigger)) {
      loops.push({ trigger, handler: trigger })
    }
  }

  // Detect channel type based on interactions
  if (/checkbox|radio|select|combobox/i.test(code)) {
    channel = 'selection'
  } else if (/navigate|route|tab|step/i.test(code)) {
    channel = 'transition'
  } else if (/input|textarea|form/i.test(code)) {
    channel = 'input'
  } else if (/output|display|result/i.test(code)) {
    channel = 'output'
  }

  // Detect levers (interactive elements)
  const leverPatterns = [
    { pattern: /<button/gi, name: 'button' },
    { pattern: /<a\s/gi, name: 'link' },
    { pattern: /<input/gi, name: 'input' },
    { pattern: /<select/gi, name: 'select' },
    { pattern: /slider|range/gi, name: 'slider' },
    { pattern: /toggle|switch/gi, name: 'toggle' },
  ]

  for (const { pattern, name } of leverPatterns) {
    if (pattern.test(code)) {
      levers.push(name)
    }
  }

  // Detect block type
  if (/feed|timeline|stream/i.test(code)) {
    block = 'feed'
  } else if (/gallery|grid.*image|carousel/i.test(code)) {
    block = 'gallery'
  } else if (/card[s]?|CardLayout/i.test(code)) {
    block = 'card'
  } else if (/dialog|modal|overlay/i.test(code)) {
    block = 'dialog'
  } else if (/accordion|disclosure|expand/i.test(code)) {
    block = 'disclosure'
  } else if (/wizard|stepper|multi-?step/i.test(code)) {
    block = 'wizard'
  } else if (/dashboard|panel|widget/i.test(code)) {
    block = 'dashboard'
  } else if (/pool|collection|bucket/i.test(code)) {
    block = 'pool'
  } else if (/pipeline|workflow|process/i.test(code)) {
    block = 'pipeline'
  }

  return { objects, channel, loops, levers, block }
}

// ============================================================================
// Preference Constraint Factory
// ============================================================================

/**
 * Creates a preference constraint bThread.
 *
 * @param bSync - The bSync factory
 * @param bThread - The bThread factory
 * @param profile - User preference profile
 * @returns A RulesFunction that blocks non-conforming generations
 *
 * @remarks
 * Blocks generations that don't align with user preferences.
 * This creates hybrid UI: familiar structure + generative content.
 */
export const createPreferenceConstraint = (
  bSync: BSync,
  bThread: BThread,
  profile: UserPreferenceProfile,
): RulesFunction => {
  return bThread(
    [
      bSync({
        block: (event: BPEvent) => {
          // Only check writeTemplate tool results
          if (event.type !== 'toolResult') return false
          const detail = event.detail as { name: string; result: { data?: { content?: string } } }
          if (detail.name !== 'writeTemplate') return false

          const content = detail.result?.data?.content
          if (!content) return false

          // Extract structural metadata from generated content
          const structural = extractStructuralMetadata(content)

          // Check block type preference
          if (profile.preferredBlocks?.length) {
            if (structural.block && !profile.preferredBlocks.includes(structural.block)) {
              return true // Block if block type doesn't match preference
            }
          }

          // Check grouping preference
          if (profile.preferredGroupings?.length) {
            const hasPreferredGrouping = structural.objects.some(
              (obj) => obj.grouping && profile.preferredGroupings!.includes(obj.grouping),
            )
            // Only block if we detected a grouping that's not preferred
            const hasAnyGrouping = structural.objects.some((obj) => obj.grouping)
            if (hasAnyGrouping && !hasPreferredGrouping) {
              return true
            }
          }

          // Check required patterns
          if (profile.requiredPatterns?.length) {
            for (const required of profile.requiredPatterns) {
              // Check if required block is present
              if (required.block && required.block !== structural.block) {
                return true
              }

              // Check if required loops are present
              if (required.loops?.length) {
                for (const requiredLoop of required.loops) {
                  const hasLoop = structural.loops?.some(
                    (loop) => loop.trigger === requiredLoop.trigger && loop.handler === requiredLoop.handler,
                  )
                  if (!hasLoop) {
                    return true
                  }
                }
              }
            }
          }

          return false // Don't block - passes preferences
        },
      }),
    ],
    true,
  )
}

// ============================================================================
// Specific Preference Constraints
// ============================================================================

/**
 * Creates a constraint that requires card layouts.
 *
 * @param bSync - The bSync factory
 * @param bThread - The bThread factory
 * @returns A RulesFunction that requires card patterns
 */
export const createRequireCardLayout = (bSync: BSync, bThread: BThread): RulesFunction => {
  return createPreferenceConstraint(bSync, bThread, {
    preferredBlocks: ['card'],
  })
}

/**
 * Creates a constraint that requires list groupings.
 *
 * @param bSync - The bSync factory
 * @param bThread - The bThread factory
 * @returns A RulesFunction that requires list patterns
 */
export const createRequireListGrouping = (bSync: BSync, bThread: BThread): RulesFunction => {
  return createPreferenceConstraint(bSync, bThread, {
    preferredGroupings: ['list'],
  })
}

/**
 * Creates a constraint that requires wizard/stepper patterns.
 *
 * @param bSync - The bSync factory
 * @param bThread - The bThread factory
 * @returns A RulesFunction that requires wizard patterns
 */
export const createRequireWizardPattern = (bSync: BSync, bThread: BThread): RulesFunction => {
  return createPreferenceConstraint(bSync, bThread, {
    preferredBlocks: ['wizard'],
    preferredGroupings: ['steps'],
  })
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Check if structural metadata matches a preference profile.
 *
 * @param structural - Extracted structural metadata
 * @param profile - User preference profile
 * @returns True if metadata matches preferences
 */
export const matchesPreferences = (structural: StructuralMetadata, profile: UserPreferenceProfile): boolean => {
  // Check block type
  if (profile.preferredBlocks?.length && structural.block) {
    if (!profile.preferredBlocks.includes(structural.block)) {
      return false
    }
  }

  // Check groupings
  if (profile.preferredGroupings?.length) {
    const hasPreferredGrouping = structural.objects.some(
      (obj) => obj.grouping && profile.preferredGroupings!.includes(obj.grouping),
    )
    const hasAnyGrouping = structural.objects.some((obj) => obj.grouping)
    if (hasAnyGrouping && !hasPreferredGrouping) {
      return false
    }
  }

  return true
}

/**
 * Infer a preference profile from example code.
 *
 * @param examples - Array of example code strings
 * @returns Inferred preference profile
 *
 * @remarks
 * Useful for building a profile from a user's existing templates.
 */
export const inferPreferenceProfile = (examples: string[]): UserPreferenceProfile => {
  const blockCounts = new Map<BlockType, number>()
  const groupingCounts = new Map<ObjectGrouping, number>()

  for (const code of examples) {
    const structural = extractStructuralMetadata(code)

    if (structural.block) {
      blockCounts.set(structural.block, (blockCounts.get(structural.block) || 0) + 1)
    }

    for (const obj of structural.objects) {
      if (obj.grouping) {
        groupingCounts.set(obj.grouping, (groupingCounts.get(obj.grouping) || 0) + 1)
      }
    }
  }

  // Get most common patterns
  const preferredBlocks = Array.from(blockCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([block]) => block)

  const preferredGroupings = Array.from(groupingCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([grouping]) => grouping)

  return {
    preferredBlocks: preferredBlocks.length > 0 ? preferredBlocks : undefined,
    preferredGroupings: preferredGroupings.length > 0 ? preferredGroupings : undefined,
  }
}
