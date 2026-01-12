/**
 * Tier 1 Static Analysis for generated code.
 *
 * @remarks
 * Fast, free checks that catch common issues before
 * more expensive model-based or browser validation.
 *
 * Checks include:
 * - Token usage validation
 * - Style pattern validation
 * - Accessibility attributes
 * - Loop completeness (p-trigger → handler pairs)
 * - Import validation
 */

import type { StaticAnalysisResult, StaticCheck } from './agent.types.ts'

// ============================================================================
// Static Check Options
// ============================================================================

/**
 * Options for running static analysis.
 */
export type StaticAnalysisOptions = {
  /** Path to token definitions (for validation) */
  tokenPath?: string
  /** Which checks to run (default: all) */
  checks?: Array<'tokenUsage' | 'stylePatterns' | 'accessibility' | 'loopCompleteness' | 'imports'>
  /** Custom hardcoded value patterns to flag */
  customHardcodedPatterns?: Array<{ pattern: RegExp; message: string }>
}

// ============================================================================
// Individual Check Functions
// ============================================================================

/**
 * Check for proper token usage instead of hardcoded values.
 *
 * @param code - The code to analyze
 * @param tokenPath - Optional path to token definitions
 * @returns Static check result
 *
 * @remarks
 * Flags hardcoded colors and pixel values that should use tokens.
 */
export const checkTokenUsage = (code: string, _tokenPath?: string): StaticCheck => {
  const issues: string[] = []

  // Check for hardcoded hex colors
  const hexColorPattern = /#[0-9a-fA-F]{3,8}(?![0-9a-fA-F])/g
  const hexMatches = code.match(hexColorPattern)
  if (hexMatches) {
    // Filter out common non-color hex values (e.g., in URLs, IDs)
    const colorMatches = hexMatches.filter((match) => {
      // Skip if it's in a comment or string that looks like an ID/URL
      return !/#[0-9a-f]{6,8}[a-z]/i.test(match + code.charAt(code.indexOf(match) + match.length))
    })
    if (colorMatches.length > 0) {
      issues.push(`Hardcoded color values found (${colorMatches.length}) - consider using tokens`)
    }
  }

  // Check for rgb/rgba colors
  const rgbPattern = /rgb[a]?\s*\(\s*\d+\s*,\s*\d+\s*,\s*\d+/g
  if (rgbPattern.test(code)) {
    issues.push('Hardcoded RGB values found - consider using tokens')
  }

  // Check for hardcoded pixel values (excluding 0px and common browser defaults)
  const pxPattern = /(?<!\d)(?!0px)[1-9]\d*px/g
  const pxMatches = code.match(pxPattern)
  if (pxMatches && pxMatches.length > 3) {
    issues.push(`Multiple hardcoded pixel values found (${pxMatches.length}) - consider using spacing tokens`)
  }

  // Check for invoked tokens (should be references, not calls)
  if (/tokens\.\w+\(\)/.test(code)) {
    issues.push('Token references should not be invoked: use tokens.primary, not tokens.primary()')
  }

  return {
    name: 'tokenUsage',
    passed: issues.length === 0,
    message: issues.length > 0 ? issues.join('; ') : undefined,
  }
}

/**
 * Check for proper createStyles usage patterns.
 *
 * @param code - The code to analyze
 * @returns Static check result
 *
 * @remarks
 * Ensures createStyles is used instead of inline styles,
 * and createHostStyles for :host pseudo-class.
 */
export const checkStylePatterns = (code: string): StaticCheck => {
  const issues: string[] = []

  // Check for inline styles without createStyles
  if (/style=\{/.test(code) && !/createStyles/.test(code)) {
    issues.push('Use createStyles instead of inline styles')
  }

  // Check for :host without createHostStyles
  if (/:host/.test(code) && !/createHostStyles/.test(code)) {
    issues.push('Use createHostStyles for :host pseudo-class styling')
  }

  // Check for direct className strings instead of spread styles
  const classNameAssignment = /className\s*=\s*["'][^"']+["']/
  if (classNameAssignment.test(code) && /createStyles/.test(code)) {
    issues.push('Use spread syntax {...styles.name} instead of className strings')
  }

  // Check for proper css import when using createStyles
  if (/createStyles/.test(code) && !/import.*css.*from/.test(code) && !/css`/.test(code)) {
    // This is okay if css is not being used
  }

  return {
    name: 'stylePatterns',
    passed: issues.length === 0,
    message: issues.length > 0 ? issues.join('; ') : undefined,
  }
}

/**
 * Check for accessibility attributes.
 *
 * @param code - The code to analyze
 * @returns Static check result
 *
 * @remarks
 * Ensures interactive elements have appropriate ARIA attributes.
 */
export const checkAccessibility = (code: string): StaticCheck => {
  const issues: string[] = []

  // Check for buttons without accessible names
  const buttonPattern = /<button[^>]*>/g
  const buttons = code.match(buttonPattern) || []
  for (const button of buttons) {
    const hasAriaLabel = /aria-label/.test(button)
    const hasAriaLabelledBy = /aria-labelledby/.test(button)
    const hasTextContent = /<button[^>]*>[^<]+</.test(code.substring(code.indexOf(button)))
    if (!hasAriaLabel && !hasAriaLabelledBy && !hasTextContent) {
      issues.push('Button without accessible name - add aria-label, aria-labelledby, or text content')
      break // Only report once
    }
  }

  // Check for images without alt text
  const imgPattern = /<img[^>]*>/g
  const images = code.match(imgPattern) || []
  for (const img of images) {
    if (!/alt\s*=/.test(img)) {
      issues.push('Image without alt attribute')
      break
    }
  }

  // Check for inputs without labels
  const inputPattern = /<input[^>]*type\s*=\s*["'](?!hidden|submit|button|reset)[^"']*["'][^>]*>/g
  const inputs = code.match(inputPattern) || []
  if (inputs.length > 0) {
    const hasLabel = /<label/.test(code)
    const hasAriaLabel = inputs.some((input) => /aria-label/.test(input))
    if (!hasLabel && !hasAriaLabel) {
      issues.push('Input without associated label - add <label> or aria-label')
    }
  }

  // Check for divs with click handlers (should be buttons)
  if (/<div[^>]*onClick/.test(code) || /<div[^>]*p-trigger/.test(code)) {
    const hasRole = /role\s*=\s*["']button["']/.test(code)
    const hasTabIndex = /tabIndex/.test(code)
    if (!hasRole || !hasTabIndex) {
      issues.push('Clickable div should be a button, or have role="button" and tabIndex')
    }
  }

  return {
    name: 'accessibility',
    passed: issues.length === 0,
    message: issues.length > 0 ? issues.join('; ') : undefined,
  }
}

/**
 * Check for loop completeness (p-trigger → handler pairs).
 *
 * @param code - The code to analyze
 * @returns Static check result
 *
 * @remarks
 * Ensures every p-trigger has a corresponding handler in the
 * bElement's triggers configuration.
 */
export const checkLoopCompleteness = (code: string): StaticCheck => {
  const issues: string[] = []

  // Extract p-trigger values from JSX
  const pTriggerPattern = /p-trigger\s*=\s*["']([^"']+)["']/g
  const triggers = new Set<string>()
  for (const match of code.matchAll(pTriggerPattern)) {
    if (match[1]) {
      triggers.add(match[1])
    }
  }

  // Extract handler names from triggers: { ... } configuration
  // Use a simpler approach: find triggers: { and then extract keys
  const triggersStartPattern = /triggers:\s*\{/
  const triggersStartMatch = code.match(triggersStartPattern)
  const handlers = new Set<string>()

  if (triggersStartMatch) {
    const startIdx = triggersStartMatch.index! + triggersStartMatch[0].length
    // Find matching brace - simple balance counter
    let braceCount = 1
    let endIdx = startIdx
    for (let i = startIdx; i < code.length && braceCount > 0; i++) {
      if (code[i] === '{') braceCount++
      else if (code[i] === '}') braceCount--
      endIdx = i
    }
    const triggersContent = code.slice(startIdx, endIdx)

    // Extract handler names (keys at the start of lines or after commas)
    const handlerPattern = /(?:^|,)\s*['"]?(\w+)['"]?\s*:/gm
    for (const handlerMatch of triggersContent.matchAll(handlerPattern)) {
      if (handlerMatch[1]) {
        handlers.add(handlerMatch[1])
      }
    }
  }

  // Check for triggers without handlers
  for (const trigger of triggers) {
    if (!handlers.has(trigger)) {
      issues.push(`p-trigger="${trigger}" has no corresponding handler`)
    }
  }

  // Check for handlers without triggers (warning, not error)
  // This is less critical as handlers might be triggered programmatically

  return {
    name: 'loopCompleteness',
    passed: issues.length === 0,
    message: issues.length > 0 ? issues.join('; ') : undefined,
  }
}

/**
 * Check for proper import statements.
 *
 * @param code - The code to analyze
 * @returns Static check result
 *
 * @remarks
 * Validates that necessary imports are present for used APIs.
 */
export const checkImports = (code: string): StaticCheck => {
  const issues: string[] = []

  // Check for bElement usage without import
  if (/\bbElement\b/.test(code) && !/import.*bElement/.test(code)) {
    issues.push('bElement used but not imported')
  }

  // Check for createStyles usage without import
  if (/\bcreateStyles\b/.test(code) && !/import.*createStyles/.test(code)) {
    issues.push('createStyles used but not imported')
  }

  // Check for createTokens usage without import
  if (/\bcreateTokens\b/.test(code) && !/import.*createTokens/.test(code)) {
    issues.push('createTokens used but not imported')
  }

  // Check for FT type usage without import
  if (/\bFT\b/.test(code) && !/import.*\bFT\b/.test(code)) {
    issues.push('FT type used but not imported')
  }

  // Check for JSX usage without proper pragma or import
  if (/<[A-Z]/.test(code) || /<[a-z]+[^>]*>/.test(code)) {
    const hasJsxImport = /import.*from\s*['"]plaited\/jsx-runtime['"]/.test(code)
    const hasJsxPragma = /\/\*\*?\s*@jsx/.test(code)
    const hasTsxExtension = true // Assume .tsx extension
    if (!hasJsxImport && !hasJsxPragma && !hasTsxExtension) {
      // This check is informational since TSX is standard
    }
  }

  return {
    name: 'imports',
    passed: issues.length === 0,
    message: issues.length > 0 ? issues.join('; ') : undefined,
  }
}

// ============================================================================
// Main Analysis Function
// ============================================================================

/**
 * Run all static analysis checks on code.
 *
 * @param code - The code to analyze
 * @param options - Analysis options
 * @returns Static analysis result with all check details
 *
 * @remarks
 * Tier 1 in the tiered symbolic analysis system.
 * These checks are fast and free, catching common issues
 * before more expensive validation.
 */
export const runStaticAnalysis = (code: string, options: StaticAnalysisOptions = {}): StaticAnalysisResult => {
  const { checks: enabledChecks, tokenPath, customHardcodedPatterns } = options

  const allChecks: Record<string, (code: string) => StaticCheck> = {
    tokenUsage: (c) => checkTokenUsage(c, tokenPath),
    stylePatterns: checkStylePatterns,
    accessibility: checkAccessibility,
    loopCompleteness: checkLoopCompleteness,
    imports: checkImports,
  }

  const checksToRun = enabledChecks || (Object.keys(allChecks) as Array<keyof typeof allChecks>)

  const results: StaticCheck[] = checksToRun.map((checkName) => {
    const checkFn = allChecks[checkName]
    return checkFn ? checkFn(code) : { name: checkName, passed: true }
  })

  // Add custom hardcoded pattern checks if provided
  if (customHardcodedPatterns) {
    for (const { pattern, message } of customHardcodedPatterns) {
      const matches = code.match(pattern)
      if (matches) {
        results.push({
          name: 'customPattern',
          passed: false,
          message: `${message} (${matches.length} occurrences)`,
        })
      }
    }
  }

  return {
    passed: results.every((r) => r.passed),
    tier: 1,
    checks: results,
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Get only the failed checks from a result.
 *
 * @param result - Static analysis result
 * @returns Array of failed checks
 */
export const getFailedChecks = (result: StaticAnalysisResult): StaticCheck[] => result.checks.filter((c) => !c.passed)

/**
 * Format analysis result as a human-readable string.
 *
 * @param result - Static analysis result
 * @returns Formatted string
 */
export const formatAnalysisResult = (result: StaticAnalysisResult): string => {
  const lines = [`Static Analysis (Tier 1): ${result.passed ? 'PASSED' : 'FAILED'}`]

  for (const check of result.checks) {
    const status = check.passed ? '✓' : '✗'
    lines.push(`  ${status} ${check.name}${check.message ? `: ${check.message}` : ''}`)
  }

  return lines.join('\n')
}
