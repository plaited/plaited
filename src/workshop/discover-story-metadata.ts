import { Glob } from 'bun'
import * as ts from 'typescript'
import { keyMirror } from '../utils.js'
import type { StoryMetadata } from './workshop.types.js'

const STORY_TYPES = keyMirror('StoryExport', 'InteractionExport', 'SnapshotExport')

/**
 * @internal
 * Discovers files matching a glob pattern within a directory.
 * Uses Bun's Glob API for efficient file discovery.
 *
 * @param cwd - The directory to search in
 * @param pattern - Glob pattern to match files against
 * @returns Array of absolute file paths matching the pattern
 *
 * @example
 * ```ts
 * const files = await globFiles('/project/root', '**\/*.stories.tsx');
 * // Returns: ['/project/root/Button.stories.tsx', '/project/root/components/Card.stories.tsx']
 * ```
 */
const globFiles = async (cwd: string, pattern: string): Promise<string[]> => {
  const glob = new Glob(pattern)
  const paths = await Array.fromAsync(glob.scan({ cwd }))
  return paths.map((path) => Bun.resolveSync(`./${path}`, cwd))
}

/**
 * @internal
 * Analyzes an object literal expression to extract story property information.
 * Checks for presence of play, args, template, and parameters properties.
 *
 * @param node - Object literal expression node
 * @returns Object with boolean flags for each property
 */
const analyzeStoryObject = (
  node: ts.ObjectLiteralExpression,
): {
  hasPlay: boolean
  hasArgs: boolean
  hasTemplate: boolean
  hasParameters: boolean
} => {
  let hasPlay = false
  let hasArgs = false
  let hasTemplate = false
  let hasParameters = false

  for (const prop of node.properties) {
    // Handle property assignments: { play: async () => {} }
    if (ts.isPropertyAssignment(prop) && ts.isIdentifier(prop.name)) {
      const propName = prop.name.text
      if (propName === 'play') hasPlay = true
      if (propName === 'args') hasArgs = true
      if (propName === 'template') hasTemplate = true
      if (propName === 'parameters') hasParameters = true
    }
    // Handle method shorthand: { async play() {} }
    if (ts.isMethodDeclaration(prop) && ts.isIdentifier(prop.name)) {
      const propName = prop.name.text
      if (propName === 'play') hasPlay = true
    }
  }

  return { hasPlay, hasArgs, hasTemplate, hasParameters }
}

/**
 * Analyzes a TypeScript file to find and extract story metadata.
 * Detects exports of type StoryExport, InteractionExport, or SnapshotExport
 * (stories created with the story() function wrapper).
 *
 * Uses TypeScript compiler API to:
 * - Type checking for explicit type annotations
 * - Structural analysis of object literals
 * - Property detection (play, args, template, parameters)
 *
 * @param filePath - Absolute path to the TypeScript/TSX file to analyze
 * @returns Array of story metadata
 *
 * @example Extract stories from a specific file
 * ```ts
 * const stories = getStoryMetadata('/path/to/Button.stories.tsx');
 * // Returns: [{ exportName: 'primary', filePath: '...', type: 'snapshot', ... }]
 * ```
 */
export const getStoryMetadata = (filePath: string): StoryMetadata[] => {
  const program = ts.createProgram([filePath], {
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    strict: true,
    skipLibCheck: true,
    moduleResolution: ts.ModuleResolutionKind.NodeNext,
    jsx: ts.JsxEmit.ReactJSX,
    jsxImportSource: 'plaited',
    allowSyntheticDefaultImports: true,
    esModuleInterop: true,
    resolveJsonModule: true,
  })

  const sourceFile = program.getSourceFile(filePath)
  if (!sourceFile) {
    throw new Error(`Failed to load file: ${filePath}`)
  }

  const typeChecker = program.getTypeChecker()
  const storyMetadata: StoryMetadata[] = []

  /**
   * Checks if a type is a StoryExport type (or InteractionExport/SnapshotExport variants).
   */
  const isStoryType = (type: ts.Type): boolean => {
    const typeString = typeChecker.typeToString(type)

    // Check for StoryExport types (story() function return types)
    if (
      typeString.includes(STORY_TYPES.StoryExport) ||
      typeString.includes(STORY_TYPES.InteractionExport) ||
      typeString.includes(STORY_TYPES.SnapshotExport)
    ) {
      return true
    }

    // Check symbol name
    if (type.symbol) {
      const symbolName = type.symbol.getName()
      if (
        symbolName === STORY_TYPES.StoryExport ||
        symbolName === STORY_TYPES.InteractionExport ||
        symbolName === STORY_TYPES.SnapshotExport
      ) {
        return true
      }
    }

    // For union types, check each constituent
    if (type.isUnion()) {
      return type.types.some((t) => isStoryType(t))
    }

    return false
  }

  /**
   * Finds the object literal expression in a declaration.
   * Handles various declaration patterns.
   */
  const findObjectLiteral = (node: ts.Node): ts.ObjectLiteralExpression | null => {
    if (ts.isObjectLiteralExpression(node)) {
      return node
    }

    if (ts.isVariableDeclaration(node) && node.initializer) {
      // Handle: const story = {...}
      if (ts.isObjectLiteralExpression(node.initializer)) {
        return node.initializer
      }
      // Handle: const story = story({...})
      if (ts.isCallExpression(node.initializer) && node.initializer.arguments.length > 0) {
        const firstArg = node.initializer.arguments[0]
        if (ts.isObjectLiteralExpression(firstArg)) {
          return firstArg
        }
      }
    }

    return null
  }

  /**
   * Visit nodes and find exported story objects with metadata.
   */
  const visit = (node: ts.Node): void => {
    // Check direct exports (export const)
    if (ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword)) {
      if (ts.isVariableStatement(node)) {
        for (const declaration of node.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name)) {
            const symbol = typeChecker.getSymbolAtLocation(declaration.name)
            if (symbol) {
              const type = typeChecker.getTypeOfSymbolAtLocation(symbol, declaration.name)
              if (isStoryType(type)) {
                const objectLiteral = findObjectLiteral(declaration)
                if (objectLiteral) {
                  const { hasPlay, hasArgs, hasTemplate, hasParameters } = analyzeStoryObject(objectLiteral)
                  storyMetadata.push({
                    exportName: declaration.name.text,
                    filePath,
                    type: hasPlay ? 'interaction' : 'snapshot',
                    hasPlay,
                    hasArgs,
                    hasTemplate,
                    hasParameters,
                  })
                }
              }
            }
          }
        }
      }
    }

    // Check named exports (export { story1, story2 })
    if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const exportSpec of node.exportClause.elements) {
        const symbol = typeChecker.getSymbolAtLocation(exportSpec.name)
        if (symbol) {
          const type = typeChecker.getTypeOfSymbolAtLocation(symbol, exportSpec.name)
          if (isStoryType(type)) {
            // Find the original declaration
            const declarations = symbol.getDeclarations()
            if (declarations && declarations.length > 0) {
              const declaration = declarations[0]
              const objectLiteral = findObjectLiteral(declaration)
              if (objectLiteral) {
                const { hasPlay, hasArgs, hasTemplate, hasParameters } = analyzeStoryObject(objectLiteral)
                storyMetadata.push({
                  exportName: exportSpec.name.text,
                  filePath,
                  type: hasPlay ? 'interaction' : 'snapshot',
                  hasPlay,
                  hasArgs,
                  hasTemplate,
                  hasParameters,
                })
              }
            }
          }
        }
      }
    }

    // Note: We intentionally skip export default (export assignments)
    // as per the test requirements

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return storyMetadata
}

/**
 * Discovers all story files and their metadata in a directory.
 * Combines file discovery with TypeScript compiler analysis to extract
 * metadata about story exports.
 *
 * @param cwd - Current working directory (project root)
 * @param exclude - Pattern to exclude from discovery (defaults to test spec files)
 * @returns Array of story metadata
 *
 * @example
 * ```ts
 * const stories = await discoverStoryMetadata('/project/root');
 * // Returns metadata for all stories in *.stories.tsx files
 * ```
 *
 * @example
 * ```ts
 * const stories = await discoverStoryMetadata('/project/root', '**\/*.tpl.spec.{ts,tsx}');
 * ```
 */
export const discoverStoryMetadata = async (cwd: string, exclude?: string): Promise<StoryMetadata[]> => {
  console.log(`🔍 Discovering story metadata in: ${cwd}`)
  console.log(`📋 Excluding pattern: ${exclude}`)

  // Get all .stories.tsx files
  const allFiles = await globFiles(cwd, '**/*.stories.tsx')
  // Filter out exclude pattern using glob matching
  const excludeGlob = exclude && new Glob(exclude)
  const files = exclude ? allFiles.filter((file) => !excludeGlob?.match(file)) : allFiles

  if (files.length === 0) {
    console.log(`⚠️  No story files (*.stories.tsx) found in directory '${cwd}' (excluding ${exclude})`)
    return []
  }

  console.log(`📄 Found ${files.length} story files`)

  // Map through files to extract story metadata
  const metadata = files.flatMap((file) => getStoryMetadata(file))

  console.log(`✅ Discovered ${metadata.length} story exports`)

  return metadata
}
