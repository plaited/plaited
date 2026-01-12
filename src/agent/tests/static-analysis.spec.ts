import { describe, expect, test } from 'bun:test'
import {
  checkAccessibility,
  checkImports,
  checkLoopCompleteness,
  checkStylePatterns,
  checkTokenUsage,
  formatAnalysisResult,
  getFailedChecks,
  runStaticAnalysis,
} from '../static-analysis.ts'

// ============================================================================
// Token Usage Tests
// ============================================================================

describe('checkTokenUsage', () => {
  test('passes when no hardcoded colors', () => {
    const code = `
      const Button = () => (
        <button {...styles.btn}>Click me</button>
      )
    `
    const result = checkTokenUsage(code)
    expect(result.passed).toBe(true)
  })

  test('fails on hex colors', () => {
    const code = `
      const styles = createStyles({
        btn: css\`
          background: #ff0000;
        \`
      })
    `
    const result = checkTokenUsage(code)
    expect(result.passed).toBe(false)
    expect(result.message).toContain('Hardcoded color')
  })

  test('fails on rgb colors', () => {
    const code = `
      const styles = createStyles({
        btn: css\`
          background: rgb(255, 0, 0);
        \`
      })
    `
    const result = checkTokenUsage(code)
    expect(result.passed).toBe(false)
    expect(result.message).toContain('RGB')
  })

  test('warns on invoked tokens', () => {
    const code = `
      const color = tokens.primary()
    `
    const result = checkTokenUsage(code)
    expect(result.passed).toBe(false)
    expect(result.message).toContain('should not be invoked')
  })

  test('passes with few hardcoded pixel values', () => {
    const code = `
      const styles = createStyles({
        btn: css\`
          padding: 8px;
          margin: 16px;
        \`
      })
    `
    const result = checkTokenUsage(code)
    // Should pass with only 2 values (threshold is 3+)
    expect(result.passed).toBe(true)
  })

  test('warns on many hardcoded pixel values', () => {
    const code = `
      const styles = createStyles({
        container: css\`
          padding: 8px;
          margin: 16px;
          width: 200px;
          height: 100px;
        \`
      })
    `
    const result = checkTokenUsage(code)
    expect(result.passed).toBe(false)
    expect(result.message).toContain('pixel values')
  })
})

// ============================================================================
// Style Patterns Tests
// ============================================================================

describe('checkStylePatterns', () => {
  test('passes with createStyles', () => {
    const code = `
      import { createStyles, css } from 'plaited/css'
      const styles = createStyles({
        btn: css\`background: var(--color-primary);\`
      })
    `
    const result = checkStylePatterns(code)
    expect(result.passed).toBe(true)
  })

  test('fails on inline styles without createStyles', () => {
    const code = `
      const Button = () => (
        <button style={{ color: 'red' }}>Click</button>
      )
    `
    const result = checkStylePatterns(code)
    expect(result.passed).toBe(false)
    expect(result.message).toContain('createStyles')
  })

  test('fails on :host without createHostStyles', () => {
    const code = `
      const styles = createStyles({
        root: css\`
          :host {
            display: block;
          }
        \`
      })
    `
    const result = checkStylePatterns(code)
    expect(result.passed).toBe(false)
    expect(result.message).toContain('createHostStyles')
  })

  test('warns on className strings with createStyles', () => {
    const code = `
      import { createStyles } from 'plaited/css'
      const styles = createStyles({})
      const Button = () => <button className="btn">Click</button>
    `
    const result = checkStylePatterns(code)
    expect(result.passed).toBe(false)
    expect(result.message).toContain('spread syntax')
  })
})

// ============================================================================
// Accessibility Tests
// ============================================================================

describe('checkAccessibility', () => {
  test('passes with accessible button', () => {
    const code = `
      const Button = () => (
        <button aria-label="Submit form">Submit</button>
      )
    `
    const result = checkAccessibility(code)
    expect(result.passed).toBe(true)
  })

  test('passes with button text content', () => {
    const code = `
      const Button = () => (
        <button>Click me</button>
      )
    `
    const result = checkAccessibility(code)
    expect(result.passed).toBe(true)
  })

  test('fails on image without alt', () => {
    const code = `
      const Card = () => (
        <img src="/photo.jpg" />
      )
    `
    const result = checkAccessibility(code)
    expect(result.passed).toBe(false)
    expect(result.message).toContain('alt')
  })

  test('passes with image with alt', () => {
    const code = `
      const Card = () => (
        <img src="/photo.jpg" alt="Profile photo" />
      )
    `
    const result = checkAccessibility(code)
    expect(result.passed).toBe(true)
  })

  test('fails on input without label', () => {
    const code = `
      const Form = () => (
        <input type="text" name="email" />
      )
    `
    const result = checkAccessibility(code)
    expect(result.passed).toBe(false)
    expect(result.message).toContain('label')
  })

  test('passes with input and label', () => {
    const code = `
      const Form = () => (
        <div>
          <label for="email">Email</label>
          <input type="text" name="email" id="email" />
        </div>
      )
    `
    const result = checkAccessibility(code)
    expect(result.passed).toBe(true)
  })

  test('fails on clickable div without role', () => {
    const code = `
      const Card = () => (
        <div onClick={handleClick}>Click me</div>
      )
    `
    const result = checkAccessibility(code)
    expect(result.passed).toBe(false)
    expect(result.message).toContain('button')
  })

  test('fails on clickable div with p-trigger', () => {
    const code = `
      const Card = () => (
        <div p-trigger="click">Click me</div>
      )
    `
    const result = checkAccessibility(code)
    expect(result.passed).toBe(false)
    expect(result.message).toContain('button')
  })
})

// ============================================================================
// Loop Completeness Tests
// ============================================================================

describe('checkLoopCompleteness', () => {
  test('passes when all triggers have handlers', () => {
    const code = `
      const Button = bElement({
        tag: 'my-button',
        template: () => <button p-trigger="click">Click</button>,
        triggers: {
          click: ({ trigger }) => trigger({ type: 'clicked' })
        }
      })
    `
    const result = checkLoopCompleteness(code)
    expect(result.passed).toBe(true)
  })

  test('fails when trigger missing handler', () => {
    const code = `
      const Button = bElement({
        tag: 'my-button',
        template: () => <button p-trigger="click">Click</button>,
        triggers: {
          hover: () => {}
        }
      })
    `
    const result = checkLoopCompleteness(code)
    expect(result.passed).toBe(false)
    expect(result.message).toContain('click')
  })

  test('handles multiple triggers', () => {
    const code = `
      const Card = bElement({
        tag: 'my-card',
        template: () => (
          <div>
            <button p-trigger="click">Click</button>
            <input p-trigger="input" />
          </div>
        ),
        triggers: {
          click: () => {},
          input: () => {}
        }
      })
    `
    const result = checkLoopCompleteness(code)
    expect(result.passed).toBe(true)
  })

  test('passes with no triggers', () => {
    const code = `
      const Card = () => <div>Static content</div>
    `
    const result = checkLoopCompleteness(code)
    expect(result.passed).toBe(true)
  })
})

// ============================================================================
// Import Validation Tests
// ============================================================================

describe('checkImports', () => {
  test('passes with proper imports', () => {
    const code = `
      import { bElement, createStyles } from 'plaited'
      import type { FT } from 'plaited'
    `
    const result = checkImports(code)
    expect(result.passed).toBe(true)
  })

  test('fails on bElement without import', () => {
    const code = `
      const Button = bElement({
        tag: 'my-button',
        template: () => <button>Click</button>
      })
    `
    const result = checkImports(code)
    expect(result.passed).toBe(false)
    expect(result.message).toContain('bElement')
  })

  test('fails on createStyles without import', () => {
    const code = `
      const styles = createStyles({
        btn: css\`color: red;\`
      })
    `
    const result = checkImports(code)
    expect(result.passed).toBe(false)
    expect(result.message).toContain('createStyles')
  })

  test('fails on FT without import', () => {
    const code = `
      const Button: FT<{ label: string }> = ({ label }) => (
        <button>{label}</button>
      )
    `
    const result = checkImports(code)
    expect(result.passed).toBe(false)
    expect(result.message).toContain('FT')
  })
})

// ============================================================================
// Full Analysis Tests
// ============================================================================

describe('runStaticAnalysis', () => {
  test('runs all checks by default', () => {
    const code = `
      import { bElement, createStyles } from 'plaited'
      const Button = bElement({
        tag: 'my-button',
        template: () => <button aria-label="Click">Click</button>
      })
    `
    const result = runStaticAnalysis(code)
    expect(result.tier).toBe(1)
    expect(result.checks.length).toBe(5)
  })

  test('respects checks filter', () => {
    const code = `const x = 1`
    const result = runStaticAnalysis(code, { checks: ['imports'] })
    expect(result.checks.length).toBe(1)
    expect(result.checks[0]?.name).toBe('imports')
  })

  test('supports custom hardcoded patterns', () => {
    const code = `
      const apiKey = 'sk-1234567890'
    `
    const result = runStaticAnalysis(code, {
      customHardcodedPatterns: [{ pattern: /sk-\w+/, message: 'API key detected' }],
    })
    expect(result.passed).toBe(false)
    const customCheck = result.checks.find((c) => c.name === 'customPattern')
    expect(customCheck?.message).toContain('API key')
  })

  test('returns passed=true when all checks pass', () => {
    const code = `
      import { bElement, createStyles, css } from 'plaited'
      const styles = createStyles({
        btn: css\`background: var(--color-primary);\`
      })
      const Button = bElement({
        tag: 'my-button',
        template: () => <button {...styles.btn} aria-label="Submit">Submit</button>,
        triggers: {}
      })
    `
    const result = runStaticAnalysis(code)
    expect(result.passed).toBe(true)
  })

  test('returns passed=false when any check fails', () => {
    const code = `
      // Missing imports, using raw colors
      const styles = createStyles({
        btn: css\`background: #ff0000;\`
      })
    `
    const result = runStaticAnalysis(code)
    expect(result.passed).toBe(false)
  })
})

// ============================================================================
// Utility Function Tests
// ============================================================================

describe('getFailedChecks', () => {
  test('returns only failed checks', () => {
    const code = `
      const styles = createStyles({})
      const Button = () => <button style={{ color: 'red' }}>Click</button>
    `
    const result = runStaticAnalysis(code)
    const failed = getFailedChecks(result)

    expect(failed.length).toBeGreaterThan(0)
    expect(failed.every((c) => !c.passed)).toBe(true)
  })

  test('returns empty array when all pass', () => {
    const code = `
      import { createStyles, css } from 'plaited'
      const styles = createStyles({})
    `
    const result = runStaticAnalysis(code, { checks: ['stylePatterns'] })
    const failed = getFailedChecks(result)

    expect(failed.length).toBe(0)
  })
})

describe('formatAnalysisResult', () => {
  test('formats passed result', () => {
    const result = runStaticAnalysis('const x = 1', { checks: ['imports'] })
    const formatted = formatAnalysisResult(result)

    expect(formatted).toContain('PASSED')
    expect(formatted).toContain('imports')
  })

  test('formats failed result with messages', () => {
    const code = `const styles = createStyles({})`
    const result = runStaticAnalysis(code, { checks: ['imports'] })
    const formatted = formatAnalysisResult(result)

    expect(formatted).toContain('FAILED')
    expect(formatted).toContain('✗')
  })

  test('includes check names and status', () => {
    const result = runStaticAnalysis('const x = 1')
    const formatted = formatAnalysisResult(result)

    expect(formatted).toContain('tokenUsage')
    expect(formatted).toContain('stylePatterns')
    expect(formatted).toContain('accessibility')
  })
})
