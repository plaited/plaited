import * as ts from 'typescript'
import type { GetTemplateExportsParams } from '../mcp.schemas.js'

/**
 * Detects and returns the names of all exports that are of type StoryObj,
 * InteractionStoryObj, or SnapshotStoryObj from a TypeScript/TSX file.
 * 
 * @param filePath - Path to the TypeScript/TSX file to analyze
 * @returns Array of export names that are StoryObj types
 * 
 * @example
 * ```ts
 * const storyExports = getStorySetExportNames({ filePath: './button.stories.tsx' });
 * // Returns: ['defaultStory', 'clickTest', 'disabledState']
 * ```
 */
export const getStorySetExportNames = ({ filePath }: GetTemplateExportsParams): string[] => {
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
  const storyExportNames: string[] = []

    /**
     * Checks if a type matches StoryObj or its variants
     */
    const isStoryObjType = (type: ts.Type): boolean => {
      const typeString = typeChecker.typeToString(type)
      
      // Check for explicit StoryObj types
      if (
        typeString.includes('StoryObj') ||
        typeString.includes('InteractionStoryObj') ||
        typeString.includes('SnapshotStoryObj')
      ) {
        return true
      }

      // Check symbol name
      if (type.symbol) {
        const symbolName = type.symbol.getName()
        if (
          symbolName === 'StoryObj' ||
          symbolName === 'InteractionStoryObj' ||
          symbolName === 'SnapshotStoryObj'
        ) {
          return true
        }
      }

      // Check for structural matching - StoryObj should have these properties
      const properties = type.getProperties()
      if (properties.length > 0) {
        const propNames = properties.map((prop) => prop.getName())
        
        // StoryObj must have 'description' property
        // May have 'play', 'args', 'parameters', 'template'
        const hasDescription = propNames.includes('description')
        const hasStoryProperties = 
          propNames.some((name) => ['play', 'args', 'parameters', 'template'].includes(name))
        
        if (hasDescription && hasStoryProperties) {
          // Additional check: if it has 'play', it's InteractionStoryObj
          // If no 'play' or play is undefined/never, it could be SnapshotStoryObj
          return true
        }
      }

      // For union types, check each constituent
      if (type.isUnion()) {
        for (const t of type.types) {
          if (isStoryObjType(t)) {
            return true
          }
        }
      }

      return false
    }

    /**
     * Checks if a symbol's type is a StoryObj
     */
    const checkSymbolType = (symbol: ts.Symbol, location: ts.Node): boolean => {
      const type = typeChecker.getTypeOfSymbolAtLocation(symbol, location)
      return isStoryObjType(type)
    }

    /**
     * Visit nodes and find exported StoryObj types
     */
    const visit = (node: ts.Node): void => {
      // Check export declarations
      if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const exportSpec of node.exportClause.elements) {
          const symbol = typeChecker.getSymbolAtLocation(exportSpec.name)
          if (symbol && checkSymbolType(symbol, exportSpec.name)) {
            storyExportNames.push(exportSpec.name.text)
          }
        }
      }

      // Check export assignments (export = ...)
      if (ts.isExportAssignment(node) && !node.isExportEquals) {
        const type = typeChecker.getTypeAtLocation(node.expression)
        if (isStoryObjType(type)) {
          storyExportNames.push('default')
        }
      }

      // Check direct exports (export const, export function, etc.)
      if (ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword)) {
        // Handle variable statements
        if (ts.isVariableStatement(node)) {
          for (const declaration of node.declarationList.declarations) {
            if (ts.isIdentifier(declaration.name)) {
              const symbol = typeChecker.getSymbolAtLocation(declaration.name)
              if (symbol && checkSymbolType(symbol, declaration.name)) {
                storyExportNames.push(declaration.name.text)
              }
            }
          }
        }
        // Handle function declarations (less common for StoryObj but possible)
        else if (ts.isFunctionDeclaration(node) && node.name) {
          const symbol = typeChecker.getSymbolAtLocation(node.name)
          if (symbol && checkSymbolType(symbol, node.name)) {
            storyExportNames.push(node.name.text)
          }
        }
      }

      ts.forEachChild(node, visit)
    }

    visit(sourceFile)
    return storyExportNames
}