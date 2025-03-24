import { expect, test } from 'bun:test'
import { parseCodeFiles } from '../parse-code-files'
import fs from 'fs'
import path from 'path'

// Create temporary test files
const createTestFile = (content: string) => {
  const tempDir = path.join(process.cwd(), 'scripts/create-corpus/tests/temp')
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir, { recursive: true })
  }
  const filePath = path.join(tempDir, `test-${Date.now()}.ts`)
  fs.writeFileSync(filePath, content)
  return filePath
}

// Clean up test files
const cleanup = (filePath: string) => {
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath)
  }
}

test('parseCodeFiles extracts exported function with documentation', async () => {
  const testContent = `
    /**
     * Test function description
     * @param x - A number parameter
     * @returns The squared number
     */
    export function square(x: number): number {
      return x * x;
    }
  `

  const filePath = createTestFile(testContent)

  try {
    const { codeElements, embeddings } = await parseCodeFiles([filePath])

    expect(codeElements.length).toBe(1)
    expect(codeElements[0].kind).toBe('FunctionDeclaration')
    expect(codeElements[0].name).toBe('square')
    expect(codeElements[0].signature).toContain('(x: number): number')
    expect(codeElements[0].documentation).toContain('Test function description')
    expect(codeElements[0].documentation).toContain('@param x - A number parameter')
    expect(codeElements[0].documentation).toContain('@returns The squared number')

    // Check if embeddings were generated
    expect(Object.keys(embeddings).length).toBe(1)
    expect(Array.isArray(embeddings[codeElements[0].fullText])).toBe(true)
  } finally {
    cleanup(filePath)
  }
})

test('parseCodeFiles extracts exported variables', async () => {
  const testContent = `
    /** A constant value */
    export const PI = 3.14159;
  `

  const filePath = createTestFile(testContent)

  try {
    const { codeElements, embeddings } = await parseCodeFiles([filePath])

    expect(codeElements.length).toBe(1)
    expect(codeElements[0].kind).toBe('VariableDeclaration')
    expect(codeElements[0].name).toBe('PI')
    expect(codeElements[0].documentation).toContain('A constant value')

    // Check if embeddings were generated
    expect(Object.keys(embeddings).length).toBe(1)
    expect(Array.isArray(embeddings[codeElements[0].fullText])).toBe(true)
  } finally {
    cleanup(filePath)
  }
})

test('parseCodeFiles handles multiple exports', async () => {
  const testContent = `
    /** Interface description */
    export interface Person {
      name: string;
      age: number;
    }

    /** Class description */
    export class Calculator {
      add(a: number, b: number): number {
        return a + b;
      }
    }
  `

  const filePath = createTestFile(testContent)

  try {
    const { codeElements, embeddings } = await parseCodeFiles([filePath])

    expect(codeElements.length).toBe(2)

    // Check interface
    const interfaceElement = codeElements.find((el) => el.kind === 'InterfaceDeclaration')
    expect(interfaceElement?.name).toBe('Person')
    expect(interfaceElement?.documentation).toContain('Interface description')

    // Check class
    const classElement = codeElements.find((el) => el.kind === 'ClassDeclaration')
    expect(classElement?.name).toBe('Calculator')
    expect(classElement?.documentation).toContain('Class description')

    // Check embeddings
    expect(Object.keys(embeddings).length).toBe(2)
  } finally {
    cleanup(filePath)
  }
})

test('parseCodeFiles handles files with no exports', async () => {
  const testContent = `
    function helper() {
      return true;
    }

    const localVar = 42;
  `

  const filePath = createTestFile(testContent)

  try {
    const { codeElements, embeddings } = await parseCodeFiles([filePath])

    expect(codeElements.length).toBe(0)
    expect(Object.keys(embeddings).length).toBe(0)
  } finally {
    cleanup(filePath)
  }
})

test('parseCodeFiles handles invalid file paths', async () => {
  await expect(parseCodeFiles(['nonexistent.ts'])).rejects.toThrow()
})
