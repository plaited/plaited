/**
 * Balance command - analyze test set coverage.
 *
 * @remarks
 * Analyzes the distribution of test cases by metadata categories.
 * Identifies underrepresented categories and suggests improvements.
 *
 * @packageDocumentation
 */

import { parseArgs } from 'node:util'
import { loadPrompts, resolvePath } from '../core.ts'
import type { BalanceAnalysis, CategoryDistribution, PromptCase } from '../schemas.ts'

// ============================================================================
// Types
// ============================================================================

/** Configuration for balance command */
export type BalanceConfig = {
  /** Path to prompts.jsonl file */
  promptsPath: string
  /** Output file path */
  outputPath?: string
  /** Metadata key to analyze (default: 'category') */
  key?: string
  /** Threshold for underrepresentation (percentage) */
  threshold?: number
}

/**
 * Analyze category distribution across prompts.
 *
 * @param prompts - Array of prompt cases
 * @param key - Metadata key to analyze
 * @returns Array of category distributions sorted by count descending
 *
 * @public
 */
export const analyzeCategories = (prompts: PromptCase[], key: string): CategoryDistribution[] => {
  const counts = new Map<string, number>()

  for (const prompt of prompts) {
    const value = prompt.metadata?.[key]
    const category = value !== undefined ? String(value) : '(uncategorized)'
    counts.set(category, (counts.get(category) ?? 0) + 1)
  }

  const total = prompts.length
  const distributions: CategoryDistribution[] = []

  for (const [name, count] of counts) {
    distributions.push({
      name,
      count,
      percentage: Math.round((count / total) * 100),
    })
  }

  // Sort by count descending
  distributions.sort((a, b) => b.count - a.count)

  return distributions
}

/**
 * Identify underrepresented categories.
 *
 * @param distributions - Array of category distributions
 * @param threshold - Percentage threshold relative to even distribution
 * @returns Array of underrepresented category names
 *
 * @public
 */
export const findUnderrepresented = (distributions: CategoryDistribution[], threshold: number): string[] => {
  // Expected percentage if evenly distributed
  const evenPercentage = 100 / distributions.length

  return distributions.filter((d) => d.percentage < evenPercentage * (threshold / 100)).map((d) => d.name)
}

/**
 * Generate suggestions for improving test set balance.
 *
 * @param distributions - Array of category distributions
 * @param underrepresented - Array of underrepresented category names
 * @param total - Total number of test cases
 * @returns Array of suggestion strings
 *
 * @public
 */
export const generateSuggestions = (
  distributions: CategoryDistribution[],
  underrepresented: string[],
  total: number,
): string[] => {
  const suggestions: string[] = []

  if (underrepresented.length > 0) {
    suggestions.push(`Consider adding more test cases for: ${underrepresented.join(', ')}`)
  }

  // Check for category with > 50% of cases
  const dominant = distributions.find((d) => d.percentage > 50)
  if (dominant) {
    suggestions.push(`Category '${dominant.name}' has ${dominant.percentage}% of cases - consider diversifying`)
  }

  // Check for very small categories
  const tiny = distributions.filter((d) => d.count < 3)
  if (tiny.length > 0) {
    suggestions.push(`Categories with < 3 cases may not be reliable: ${tiny.map((d) => d.name).join(', ')}`)
  }

  // Check total test count
  if (total < 20) {
    suggestions.push(`Consider expanding test set (currently ${total} cases) for more statistical significance`)
  }

  if (suggestions.length === 0) {
    suggestions.push('Test set appears well-balanced')
  }

  return suggestions
}

// ============================================================================
// Balance Implementation
// ============================================================================

/**
 * Execute balance analysis with configuration object.
 *
 * @param config - Balance configuration
 * @returns Balance analysis result
 */
export const runBalance = async (config: BalanceConfig): Promise<BalanceAnalysis> => {
  const { promptsPath, outputPath, key = 'category', threshold = 50 } = config

  // Load prompts
  const prompts = await loadPrompts(promptsPath)

  console.error(`Analyzing ${prompts.length} prompts by '${key}' metadata...`)

  // Analyze distribution
  const categories = analyzeCategories(prompts, key)
  const underrepresented = findUnderrepresented(categories, threshold)
  const suggestions = generateSuggestions(categories, underrepresented, prompts.length)

  const analysis: BalanceAnalysis = {
    totalCases: prompts.length,
    categories,
    underrepresented,
    suggestions,
  }

  // Format output
  const output = JSON.stringify(analysis, null, 2)

  // Write output
  if (outputPath) {
    await Bun.write(resolvePath(outputPath), output)
  } else {
    console.log(output)
  }

  // Summary to stderr
  console.error('\nCategory Distribution:')
  for (const cat of categories) {
    const bar = '█'.repeat(Math.round(cat.percentage / 5))
    console.error(`  ${cat.name}: ${cat.count} (${cat.percentage}%) ${bar}`)
  }

  if (underrepresented.length > 0) {
    console.error(`\nUnderrepresented: ${underrepresented.join(', ')}`)
  }

  console.error('\nSuggestions:')
  for (const suggestion of suggestions) {
    console.error(`  - ${suggestion}`)
  }

  return analysis
}

// ============================================================================
// CLI Entry Point
// ============================================================================

/**
 * Balance command CLI handler.
 *
 * @param args - Command line arguments (after 'balance')
 */
export const balance = async (args: string[]): Promise<void> => {
  const { values, positionals } = parseArgs({
    args,
    options: {
      output: { type: 'string', short: 'o' },
      key: { type: 'string', short: 'k', default: 'category' },
      threshold: { type: 'string', short: 't', default: '50' },
      help: { type: 'boolean', short: 'h' },
    },
    allowPositionals: true,
  })

  if (values.help) {
    console.log(`
Usage: agent-eval-harness balance <prompts.jsonl> [options]

Arguments:
  prompts.jsonl     Input file with prompts

Options:
  -o, --output      Output file (default: stdout)
  -k, --key         Metadata key to analyze (default: 'category')
  -t, --threshold   Underrepresentation threshold % (default: 50)
  -h, --help        Show this help message

Output:
  JSON with category distribution, underrepresented categories, and suggestions.

Examples:
  # Analyze by default 'category' key
  agent-eval-harness balance prompts.jsonl -o balance.json

  # Analyze by custom metadata key
  agent-eval-harness balance prompts.jsonl --key difficulty -o balance.json
`)
    return
  }

  const promptsPath = positionals[0]
  if (!promptsPath) {
    console.error('Error: prompts.jsonl path is required')
    process.exit(1)
  }

  await runBalance({
    promptsPath,
    outputPath: values.output,
    key: values.key ?? 'category',
    threshold: Number.parseInt(values.threshold ?? '50', 10),
  })
}
