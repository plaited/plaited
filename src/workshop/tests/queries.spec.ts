import { beforeEach, expect, test } from 'bun:test'
import type { ExampleData, PatternData } from '../queries.js'
import {
  getExamplesByExport,
  getPattern,
  insertExample,
  insertPattern,
  listExamples,
  listPatterns,
  searchExamples,
  searchPatterns,
} from '../queries.js'

// Clean database between tests
beforeEach(async () => {
  const { db, initDB } = await import('../../databases/db.js')
  await initDB()

  // Clear all tables
  db.exec('DELETE FROM examples')
  db.exec('DELETE FROM patterns')
  db.exec('DELETE FROM release_changes')
})

test('insertExample: inserts example and returns ID', () => {
  const example: ExampleData = {
    module: 'main',
    export_name: 'bElement',
    category: 'web-components',
    title: 'Basic Custom Element',
    description: 'Create a simple custom element',
    code: 'const MyElement = bElement({ tag: "my-element" })',
    complexity: 'basic',
  }

  const id = insertExample(example)
  expect(id).toBeGreaterThan(0)
})

test('insertExample: stores all fields correctly', () => {
  const example: ExampleData = {
    module: 'testing',
    export_name: 'story',
    category: 'testing',
    title: 'Complete Story Example',
    description: 'Full story with play function',
    code: 'export const myStory = story({ template: MyTemplate, play: async () => {} })',
    dependencies: ['bun:test', 'plaited/testing'],
    runtime_context: 'node',
    mcp_tool_compatible: true,
    expected_output: 'Story passes all assertions',
    github_permalink: 'https://github.com/plaited/plaited/blob/main/src/example.ts',
    derived_from: 'story',
    tags: ['jsx', 'testing'],
    complexity: 'intermediate',
  }

  insertExample(example)

  const results = getExamplesByExport('story')
  expect(results.length).toBe(1)

  const stored = results[0]
  expect(stored.module).toBe('testing')
  expect(stored.export_name).toBe('story')
  expect(stored.category).toBe('testing')
  expect(stored.dependencies).toEqual(['bun:test', 'plaited/testing'])
  expect(stored.runtime_context).toBe('node')
  expect(stored.mcp_tool_compatible).toBe(true)
  expect(stored.tags).toEqual(['jsx', 'testing'])
  expect(stored.complexity).toBe('intermediate')
})

test('insertPattern: inserts pattern and returns ID', () => {
  const pattern: PatternData = {
    name: 'shadow-dom-slots',
    category: 'web-components',
    title: 'Shadow DOM Slot Pattern',
    description: 'Using named and default slots',
    problem: 'Need to compose elements with flexible content',
    solution: 'Use Shadow DOM slots for content projection',
    code_example: '<slot name="header"></slot>',
    complexity: 'basic',
  }

  const id = insertPattern(pattern)
  expect(id).toBeGreaterThan(0)
})

test('insertPattern: stores all fields correctly', () => {
  const pattern: PatternData = {
    name: 'behavioral-thread-pattern',
    category: 'behavioral-programming',
    title: 'B-Thread Coordination Pattern',
    description: 'Coordinating async operations with b-threads',
    problem: 'Complex async coordination across components',
    solution: 'Use bThread to manage state and block conflicting events',
    code_example: 'const thread = bThread([bSync({ waitFor: "START" })])',
    use_cases: ['State machines', 'Wizard flows', 'Game logic'],
    anti_patterns: 'Do not use for simple state - use signals instead',
    related_patterns: ['signal-pattern'],
    related_apis: ['bThread', 'bSync', 'behavioral'],
    related_examples: [1, 2],
    mcp_tool_compatible: true,
    expected_outcome: 'Events coordinated correctly',
    github_permalink: 'https://github.com/plaited/plaited/blob/main/src/example.ts',
    reference_links: ['https://docs.plaited.com/behavioral'],
    maintainer_notes: 'Performance critical - minimize sync points',
    tags: ['bp', 'async', 'coordination'],
    complexity: 'advanced',
  }

  insertPattern(pattern)

  const stored = getPattern('behavioral-thread-pattern')
  expect(stored).not.toBeNull()
  expect(stored!.name).toBe('behavioral-thread-pattern')
  expect(stored!.use_cases).toEqual(['State machines', 'Wizard flows', 'Game logic'])
  expect(stored!.related_patterns).toEqual(['signal-pattern'])
  expect(stored!.related_apis).toEqual(['bThread', 'bSync', 'behavioral'])
  expect(stored!.related_examples).toEqual([1, 2])
  expect(stored!.mcp_tool_compatible).toBe(true)
  expect(stored!.tags).toEqual(['bp', 'async', 'coordination'])
  expect(stored!.complexity).toBe('advanced')
})

test('insertPattern: name must be unique', () => {
  const pattern: PatternData = {
    name: 'unique-pattern',
    category: 'web-components',
    title: 'Unique Pattern',
    description: 'Test uniqueness',
    problem: 'Problem',
    solution: 'Solution',
    code_example: 'code',
  }

  insertPattern(pattern)

  // Attempting to insert again should throw
  expect(() => {
    insertPattern(pattern)
  }).toThrow()
})

test('searchExamples: finds examples using full-text search', () => {
  insertExample({
    module: 'main',
    export_name: 'bElement',
    category: 'web-components',
    title: 'Shadow DOM Example',
    description: 'Create element with shadow DOM',
    code: 'bElement({ tag: "my-element", shadowDom: <div>Shadow</div> })',
  })

  insertExample({
    module: 'testing',
    export_name: 'story',
    category: 'testing',
    title: 'Story Test',
    description: 'Test behavioral elements',
    code: 'story({ template: MyTemplate })',
  })

  const results = searchExamples('shadow')
  expect(results.length).toBeGreaterThan(0)
  expect(results[0].title).toContain('Shadow')
})

test('searchExamples: respects limit parameter', () => {
  // Insert 5 examples
  for (let i = 0; i < 5; i++) {
    insertExample({
      module: 'main',
      export_name: 'test',
      category: 'test',
      title: `Example ${i}`,
      description: 'search test keyword',
      code: 'code',
    })
  }

  const results = searchExamples('test', 3)
  expect(results.length).toBeLessThanOrEqual(3)
})

test('searchPatterns: finds patterns using full-text search', () => {
  insertPattern({
    name: 'event-coordination',
    category: 'behavioral-programming',
    title: 'Event Coordination',
    description: 'Coordinate events across components',
    problem: 'Async event conflicts',
    solution: 'Use bThread blocking',
    code_example: 'code',
  })

  insertPattern({
    name: 'slot-pattern',
    category: 'web-components',
    title: 'Slot Pattern',
    description: 'Content projection',
    problem: 'Composable content',
    solution: 'Use slots',
    code_example: 'code',
  })

  const results = searchPatterns('coordination')
  expect(results.length).toBeGreaterThan(0)
  expect(results[0].name).toBe('event-coordination')
})

test('getExamplesByExport: returns all examples for an export', () => {
  insertExample({
    module: 'main',
    export_name: 'bElement',
    category: 'web-components',
    title: 'Example 1',
    description: 'First example',
    code: 'code1',
  })

  insertExample({
    module: 'main',
    export_name: 'bElement',
    category: 'web-components',
    title: 'Example 2',
    description: 'Second example',
    code: 'code2',
  })

  insertExample({
    module: 'testing',
    export_name: 'story',
    category: 'testing',
    title: 'Story Example',
    description: 'Story',
    code: 'code3',
  })

  const bElementExamples = getExamplesByExport('bElement')
  expect(bElementExamples.length).toBe(2)
  expect(bElementExamples.every((e) => e.export_name === 'bElement')).toBe(true)

  const storyExamples = getExamplesByExport('story')
  expect(storyExamples.length).toBe(1)
})

test('getPattern: returns pattern by name', () => {
  insertPattern({
    name: 'test-pattern',
    category: 'testing',
    title: 'Test Pattern',
    description: 'A test pattern',
    problem: 'Problem',
    solution: 'Solution',
    code_example: 'code',
  })

  const pattern = getPattern('test-pattern')
  expect(pattern).not.toBeNull()
  expect(pattern!.name).toBe('test-pattern')
  expect(pattern!.title).toBe('Test Pattern')
})

test('getPattern: returns null for non-existent pattern', () => {
  const pattern = getPattern('does-not-exist')
  expect(pattern).toBeNull()
})

test('listExamples: returns all examples when no filters', () => {
  insertExample({
    module: 'main',
    export_name: 'bElement',
    category: 'web-components',
    title: 'Example 1',
    description: 'Description',
    code: 'code',
  })

  insertExample({
    module: 'testing',
    export_name: 'story',
    category: 'testing',
    title: 'Example 2',
    description: 'Description',
    code: 'code',
  })

  const examples = listExamples()
  expect(examples.length).toBe(2)
})

test('listExamples: filters by module', () => {
  insertExample({
    module: 'main',
    export_name: 'bElement',
    category: 'web-components',
    title: 'Main Example',
    description: 'Description',
    code: 'code',
  })

  insertExample({
    module: 'testing',
    export_name: 'story',
    category: 'testing',
    title: 'Testing Example',
    description: 'Description',
    code: 'code',
  })

  const mainExamples = listExamples({ module: 'main' })
  expect(mainExamples.length).toBe(1)
  expect(mainExamples[0].module).toBe('main')

  const testingExamples = listExamples({ module: 'testing' })
  expect(testingExamples.length).toBe(1)
  expect(testingExamples[0].module).toBe('testing')
})

test('listExamples: filters by complexity', () => {
  insertExample({
    module: 'main',
    export_name: 'test',
    category: 'test',
    title: 'Basic Example',
    description: 'Description',
    code: 'code',
    complexity: 'basic',
  })

  insertExample({
    module: 'main',
    export_name: 'test',
    category: 'test',
    title: 'Advanced Example',
    description: 'Description',
    code: 'code',
    complexity: 'advanced',
  })

  const basicExamples = listExamples({ complexity: 'basic' })
  expect(basicExamples.length).toBe(1)
  expect(basicExamples[0].complexity).toBe('basic')
})

test('listPatterns: returns all patterns when no filters', () => {
  insertPattern({
    name: 'pattern-1',
    category: 'web-components',
    title: 'Pattern 1',
    description: 'Description',
    problem: 'Problem',
    solution: 'Solution',
    code_example: 'code',
  })

  insertPattern({
    name: 'pattern-2',
    category: 'behavioral-programming',
    title: 'Pattern 2',
    description: 'Description',
    problem: 'Problem',
    solution: 'Solution',
    code_example: 'code',
  })

  const patterns = listPatterns()
  expect(patterns.length).toBe(2)
})

test('listPatterns: filters by category', () => {
  insertPattern({
    name: 'pattern-1',
    category: 'web-components',
    title: 'Pattern 1',
    description: 'Description',
    problem: 'Problem',
    solution: 'Solution',
    code_example: 'code',
  })

  insertPattern({
    name: 'pattern-2',
    category: 'behavioral-programming',
    title: 'Pattern 2',
    description: 'Description',
    problem: 'Problem',
    solution: 'Solution',
    code_example: 'code',
  })

  const webComponentPatterns = listPatterns({ category: 'web-components' })
  expect(webComponentPatterns.length).toBe(1)
  expect(webComponentPatterns[0].category).toBe('web-components')
})

test('FTS index: automatically updates on insert', () => {
  // Insert example with specific searchable text
  insertExample({
    module: 'main',
    export_name: 'bElement',
    category: 'web-components',
    title: 'Unique Searchable Title',
    description: 'Description',
    code: 'code',
  })

  // Should immediately be searchable
  const results = searchExamples('Unique Searchable')
  expect(results.length).toBeGreaterThan(0)
})
