import { describe, expect, test } from 'bun:test'
import { getTSDocs } from '../get-tsdoc-ast.js'

describe('getTSDocs', () => {
  test('should generate AST documentation structure', () => {
    const source = `
      /**
       * Adds two numbers together
       * @param a - First number
       * @param b - Second number
       * @returns The sum of a and b
       * @example
       * \`\`\`ts
       * add(1, 2) // returns 3
       * \`\`\`
       */
      function add(a: number, b: number): number {
        return a + b;
      }
    `
    const docs = getTSDocs(source)
    expect(docs).toMatchSnapshot()
  })

  test('should handle functions with deprecated tag', () => {
    const source = `
      /**
       * Old method for adding numbers
       * @deprecated Use add() instead
       * @param a - First number
       * @param b - Second number
       * @returns Sum
       */
      function oldAdd(a: number, b: number): number {
        return a + b;
      }
    `

    const docs = getTSDocs(source)
    expect(docs).toMatchSnapshot()
  })

  test('should handle optional parameters', () => {
    const source = `
      /**
       * Greets a person
       * @param name - Person's name
       * @param title? - Optional title
       * @returns Greeting message
       */
      function greet(name: string, title?: string): string {
        return title ? \`Hello \${title} \${name}\` : \`Hello \${name}\`;
      }
    `

    const docs = getTSDocs(source)
    expect(docs).toMatchSnapshot()
  })

  test('should handle functions without documentation', () => {
    const source = `
      function undocumented(x: number): number {
        return x * 2;
      }
    `

    const docs = getTSDocs(source)
    expect(docs).toEqual('- Comment\n  - Section')
  })
})
