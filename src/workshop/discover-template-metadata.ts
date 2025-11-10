import { Glob } from 'bun'
import * as ts from 'typescript'
import type { TemplateExport, TemplateType } from './workshop.types.js'
import { keyMirror } from '../utils.js'

const TEMPLATE_TYPES = keyMirror('FunctionTemplate', 'FT', 'BehavioralTemplate', 'TemplateObject')

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
 * const files = await globFiles('/project/root', '**\/*.tsx');
 * // Returns: ['/project/root/Button.tsx', '/project/root/components/Card.tsx']
 * ```
 */
const globFiles = async (cwd: string, pattern: string): Promise<string[]> => {
  const glob = new Glob(pattern)
  const paths = await Array.fromAsync(glob.scan({ cwd }))
  return paths.map((path) => Bun.resolveSync(`./${path}`, cwd))
}

/**
 * @internal
 * Analyzes a TypeScript file to find and classify exported Plaited templates.
 * Detects both FunctionTemplate (functions returning JSX/TemplateObject) and
 * BehavioralTemplate (templates created with bElement) exports.
 *
 * Uses TypeScript compiler API to perform dual analysis:
 * - Type checking for explicit type annotations
 * - Structural analysis of object literals and return types
 *
 * @param filePath - Absolute path to the TypeScript/TSX file to analyze
 * @returns Array of template export metadata
 */
const getTemplateExports = (filePath: string): TemplateExport[] => {
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
  const templateExports: TemplateExport[] = []

  /**
   * Analyzes a type to determine if it matches a Plaited template type.
   * Checks type strings, symbol names, and structural properties.
   */
  const matchesTargetType = (type: ts.Type): TemplateType | null => {
    const typeString = typeChecker.typeToString(type)

    // Check for explicit BehavioralTemplate type
    if (typeString.includes(TEMPLATE_TYPES.BehavioralTemplate)) {
      return 'BehavioralTemplate'
    }

    // Check for FunctionTemplate or FT types
    if (typeString.includes(TEMPLATE_TYPES.FunctionTemplate) || typeString.includes(TEMPLATE_TYPES.FT)) {
      return 'FunctionTemplate'
    }

    // Check symbol name
    if (type.symbol) {
      const symbolName = type.symbol.getName()
      if (symbolName === TEMPLATE_TYPES.BehavioralTemplate) {
        return 'BehavioralTemplate'
      }
      if (symbolName === TEMPLATE_TYPES.FunctionTemplate || symbolName === TEMPLATE_TYPES.FT) {
        return 'FunctionTemplate'
      }
    }

    // Check for specific template object structures
    const properties = type.getProperties()
    if (properties.length > 0) {
      const propNames = properties.map((prop) => prop.getName())

      // BehavioralTemplate should have these specific properties
      const behavioralProps = ['tag', 'registry', 'observedAttributes', 'publicEvents', '$']
      const hasBehavioralProps = behavioralProps.every((prop) => propNames.includes(prop))

      if (hasBehavioralProps) {
        return 'BehavioralTemplate'
      }

      // TemplateObject should have these specific properties - classify as FunctionTemplate
      const templateObjectProps = ['html', 'stylesheets', 'registry', '$']
      const hasTemplateObjectProps = templateObjectProps.every((prop) => propNames.includes(prop))

      if (hasTemplateObjectProps) {
        return 'FunctionTemplate'
      }
    }

    // For union types, check each constituent
    if (type.isUnion()) {
      for (const t of type.types) {
        const result = matchesTargetType(t)
        if (result) {
          return result
        }
      }
    }

    return null
  }

  /**
   * Determines if a type represents a template by checking the type itself
   * and function return types.
   */
  const isTargetType = (type: ts.Type): TemplateType | null => {
    // First check the type itself directly
    const directMatch = matchesTargetType(type)
    if (directMatch) {
      return directMatch
    }

    // Check if it's a function type and get its return type
    const signatures = type.getCallSignatures()
    if (signatures.length > 0) {
      for (const signature of signatures) {
        const returnType = typeChecker.getReturnTypeOfSignature(signature)
        const returnMatch = matchesTargetType(returnType)
        if (returnMatch) {
          return returnMatch
        }
      }
    }

    return null
  }

  /**
   * Checks a symbol at a given location to determine its template type.
   */
  const checkSymbolType = (symbol: ts.Symbol, location: ts.Node): TemplateType | null => {
    const type = typeChecker.getTypeOfSymbolAtLocation(symbol, location)
    return isTargetType(type)
  }

  /**
   * Visit nodes and find exported template types with details.
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
              const templateType = checkSymbolType(symbol, declaration.name)
              if (templateType) {
                templateExports.push({
                  filePath,
                  exportName: declaration.name.text,
                  type: templateType,
                })
              }
            }
          }
        }
      }

      // Handle function declarations
      if (ts.isFunctionDeclaration(node) && node.name) {
        const symbol = typeChecker.getSymbolAtLocation(node.name)
        if (symbol) {
          const templateType = checkSymbolType(symbol, node.name)
          if (templateType) {
            templateExports.push({
              filePath,
              exportName: node.name.text,
              type: templateType,
            })
          }
        }
      }
    }

    // Check named exports
    if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
      for (const exportSpec of node.exportClause.elements) {
        const symbol = typeChecker.getSymbolAtLocation(exportSpec.name)
        if (symbol) {
          const templateType = checkSymbolType(symbol, exportSpec.name)
          if (templateType) {
            templateExports.push({
              filePath,
              exportName: exportSpec.name.text,
              type: templateType,
            })
          }
        }
      }
    }

    // Check export assignments (export default ...)
    if (ts.isExportAssignment(node)) {
      const type = typeChecker.getTypeAtLocation(node.expression)
      const templateType = isTargetType(type)
      if (templateType) {
        templateExports.push({
          filePath,
          exportName: 'default',
          type: templateType,
        })
      }
    }

    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return templateExports
}

/**
 * Discovers all template files and their exports in a directory.
 * Combines file discovery with TypeScript compiler analysis to extract
 * metadata about FunctionTemplate and BehavioralTemplate exports.
 *
 * @param cwd - Current working directory (project root)
 * @param exclude - Pattern to exclude from discovery (defaults to test spec files)
 * @returns Array of template export metadata
 *
 * @example
 * ```ts
 * const templates = await discoverTemplateMetadata('/project/root');
 * ```
 *
 * @example
 * ```ts
 * const templates = await discoverTemplateMetadata('/project/root', '*.stories.tsx');
 * ```
 */
export const discoverTemplateMetadata = async (
  cwd: string,
  exclude: string = '**/*.tpl.spec.{ts,tsx}',
): Promise<TemplateExport[]> => {
  console.log(`🔍 Discovering template metadata in: ${cwd}`)
  console.log(`📋 Excluding pattern: ${exclude}`)

  // Get all .tsx files
  const allFiles = await globFiles(cwd, '**/*.tsx')
  // Filter out exclude pattern using glob matching
  const excludeGlob = new Glob(exclude)
  const files = allFiles.filter((file) => !excludeGlob.match(file))

  if (files.length === 0) {
    throw new Error(`No template files (*.tsx) found in directory '${cwd}' (excluding ${exclude})`)
  }

  console.log(`📄 Found ${files.length} template files`)

  // Map through files to extract template exports
  const metadata = files.flatMap((file) => getTemplateExports(file))
  console.log(`✅ Discovered ${metadata.length} template exports`)

  return metadata
}
