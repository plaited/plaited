import * as ts from 'typescript'
import type { StoryMetadata } from './workshop.types.js'

/**
 * Enhanced version that detects StoryObj exports and analyzes their properties
 * to determine if they are interaction or snapshot stories.
 *
 * @param filePath - Path to the TypeScript/TSX file to analyze
 * @returns Array of story export details with type information
 *
 * @example
 * ```ts
 * const stories = getStorySetExportDetails({ filePath: './button.stories.tsx' });
 * // Returns: [
 * //   { name: 'clickTest', type: 'interaction', hasPlay: true, ... },
 * //   { name: 'defaultView', type: 'snapshot', hasPlay: false, ... }
 * // ]
 * ```
 */
export const getStorySetMetadata = (filePath: string): StoryMetadata[] => {
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
  const storyExportDetails: StoryMetadata[] = []

  /**
   * Analyzes a node to check for actual properties in object literal
   */
  const analyzeObjectLiteral = (node: ts.Node): Partial<StoryMetadata> | null => {
    if (!ts.isObjectLiteralExpression(node)) {
      return null
    }

    let hasPlay = false
    let hasArgs = false
    let hasTemplate = false
    let hasParameters = false
    let hasDescription = false

    for (const prop of node.properties) {
      if (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) {
        const propName = prop.name?.getText()
        if (propName === 'play') hasPlay = true
        if (propName === 'args') hasArgs = true
        if (propName === 'template') hasTemplate = true
        if (propName === 'parameters') hasParameters = true
        if (propName === 'description') hasDescription = true
      }
    }

    if (!hasDescription) {
      return null
    }

    // Determine story type based on play function presence
    const storyType: 'interaction' | 'snapshot' | 'unknown' = hasPlay ? 'interaction' : 'snapshot'

    return {
      type: storyType,
      hasPlay,
      hasArgs,
      hasTemplate,
      hasParameters,
    }
  }

  /**
   * Analyzes a type to extract story properties
   */
  const analyzeStoryType = (type: ts.Type, node?: ts.Node): Partial<StoryMetadata> | null => {
    const typeString = typeChecker.typeToString(type)

    // Check if it's a StoryObj type
    if (
      !typeString.includes('StoryObj') &&
      !typeString.includes('InteractionStoryObj') &&
      !typeString.includes('SnapshotStoryObj')
    ) {
      // Also check symbol name
      if (type.symbol) {
        const symbolName = type.symbol.getName()
        if (symbolName !== 'StoryObj' && symbolName !== 'InteractionStoryObj' && symbolName !== 'SnapshotStoryObj') {
          return null
        }
      } else {
        // Check for structural matching
        const properties = type.getProperties()
        const propNames = properties.map((prop) => prop.getName())

        // Must have description to be a StoryObj
        if (!propNames.includes('description')) {
          return null
        }

        // Should have at least one story-related property
        const hasStoryProps = propNames.some((name) => ['play', 'args', 'parameters', 'template'].includes(name))

        if (!hasStoryProps) {
          return null
        }
      }
    }

    // If we have the actual node, analyze the object literal directly
    if (node) {
      // Find the initializer
      let initializer: ts.Node | undefined
      if (ts.isVariableDeclaration(node)) {
        initializer = node.initializer
      } else if (ts.isExportAssignment(node)) {
        initializer = node.expression
      }

      if (initializer && ts.isObjectLiteralExpression(initializer)) {
        return analyzeObjectLiteral(initializer)
      }
    }

    // Fallback to type analysis if we don't have the node
    const properties = type.getProperties()
    const propMap = new Map(properties.map((prop) => [prop.getName(), prop]))

    const hasPlay = propMap.has('play')
    const hasArgs = propMap.has('args')
    const hasTemplate = propMap.has('template')
    const hasParameters = propMap.has('parameters')
    const hasDescription = propMap.has('description')

    if (!hasDescription) {
      return null
    }

    // For type-based detection, we can't reliably determine if play is actually present
    // So we mark as unknown unless we can analyze the actual object
    const storyType: 'interaction' | 'snapshot' | 'unknown' = 'unknown'

    return {
      type: storyType,
      hasPlay,
      hasArgs,
      hasTemplate,
      hasParameters,
    }
  }

  /**
   * Visit nodes and find exported StoryObj types with details
   */
  const visit = (node: ts.Node): void => {
    // Check direct exports (export const, export function, etc.)
    if (ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword)) {
      // Handle variable statements
      if (ts.isVariableStatement(node)) {
        for (const declaration of node.declarationList.declarations) {
          if (ts.isIdentifier(declaration.name)) {
            const symbol = typeChecker.getSymbolAtLocation(declaration.name)
            if (symbol) {
              const type = typeChecker.getTypeOfSymbolAtLocation(symbol, declaration.name)
              const details = analyzeStoryType(type, declaration)
              if (details) {
                storyExportDetails.push({
                  filePath,
                  exportName: declaration.name.text,
                  type: details.type ?? 'unknown',
                  hasPlay: details.hasPlay ?? false,
                  hasArgs: details.hasArgs ?? false,
                  hasTemplate: details.hasTemplate ?? false,
                  hasParameters: details.hasParameters ?? false,
                } as StoryMetadata)
              }
            }
          }
        }
      }
    }

    // Check named exports
    if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const exportSpec of node.exportClause.elements) {
        const symbol = typeChecker.getSymbolAtLocation(exportSpec.name)
        if (symbol) {
          // Try to find the original declaration
          const declaration = symbol.valueDeclaration
          const type = typeChecker.getTypeOfSymbolAtLocation(symbol, exportSpec.name)
          const details = analyzeStoryType(type, declaration)
          if (details) {
            storyExportDetails.push({
              filePath,
              exportName: exportSpec.name.text,
              type: details.type ?? 'unknown',
              hasPlay: details.hasPlay ?? false,
              hasArgs: details.hasArgs ?? false,
              hasTemplate: details.hasTemplate ?? false,
              hasParameters: details.hasParameters ?? false,
            } as StoryMetadata)
          }
        }
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return storyExportDetails
}
