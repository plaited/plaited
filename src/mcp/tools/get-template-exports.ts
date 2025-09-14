import * as ts from 'typescript'
import { keyMirror } from '../../utils.js'
import type { GetTemplateExportsParams } from '../mcp.schemas.js'

export const TEMPLATE_TYPES = keyMirror('FunctionTemplate', 'FT', 'BehavioralTemplate', 'TemplateObject')

export type TemplateExport = {
  name: string
  type: typeof TEMPLATE_TYPES.FunctionTemplate | typeof TEMPLATE_TYPES.BehavioralTemplate
}

export const getTemplateExports = ({ filePath }: GetTemplateExportsParams): TemplateExport[] => {
  try {
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
      return []
    }

    const typeChecker = program.getTypeChecker()
    const matchingExports: TemplateExport[] = []

    const matchesTargetType = (
      type: ts.Type,
    ): typeof TEMPLATE_TYPES.FunctionTemplate | typeof TEMPLATE_TYPES.BehavioralTemplate | null => {
      const typeString = typeChecker.typeToString(type)

      // Check for explicit BehavioralTemplate type
      if (typeString.includes(TEMPLATE_TYPES.BehavioralTemplate)) {
        return TEMPLATE_TYPES.BehavioralTemplate
      }

      // Check for FunctionTemplate or FT types
      if (typeString.includes(TEMPLATE_TYPES.FunctionTemplate) || typeString.includes(TEMPLATE_TYPES.FT)) {
        return TEMPLATE_TYPES.FunctionTemplate
      }

      // Check symbol name
      if (type.symbol) {
        const symbolName = type.symbol.getName()
        if (symbolName === TEMPLATE_TYPES.BehavioralTemplate) {
          return TEMPLATE_TYPES.BehavioralTemplate
        }
        if (symbolName === TEMPLATE_TYPES.FunctionTemplate || symbolName === TEMPLATE_TYPES.FT) {
          return TEMPLATE_TYPES.FunctionTemplate
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
          return TEMPLATE_TYPES.BehavioralTemplate
        }

        // TemplateObject should have these specific properties - classify as FunctionTemplate
        const templateObjectProps = ['html', 'stylesheets', 'registry', '$']
        const hasTemplateObjectProps = templateObjectProps.every((prop) => propNames.includes(prop))

        if (hasTemplateObjectProps) {
          return TEMPLATE_TYPES.FunctionTemplate
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

    const isTargetType = (
      type: ts.Type,
    ): typeof TEMPLATE_TYPES.FunctionTemplate | typeof TEMPLATE_TYPES.BehavioralTemplate | null => {
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

    const checkSymbolType = (
      symbol: ts.Symbol,
      location: ts.Node,
    ): typeof TEMPLATE_TYPES.FunctionTemplate | typeof TEMPLATE_TYPES.BehavioralTemplate | null => {
      const type = typeChecker.getTypeOfSymbolAtLocation(symbol, location)
      return isTargetType(type)
    }

    const visit = (node: ts.Node): void => {
      // Check export declarations
      if (ts.isExportDeclaration(node) && node.exportClause && ts.isNamedExports(node.exportClause)) {
        for (const exportSpec of node.exportClause.elements) {
          const symbol = typeChecker.getSymbolAtLocation(exportSpec.name)
          if (symbol) {
            const templateType = checkSymbolType(symbol, exportSpec.name)
            if (templateType) {
              matchingExports.push({ name: exportSpec.name.text, type: templateType })
            }
          }
        }
      }

      // Check export assignments (export = ...)
      if (ts.isExportAssignment(node)) {
        const type = typeChecker.getTypeAtLocation(node.expression)
        const templateType = isTargetType(type)
        if (templateType) {
          matchingExports.push({ name: 'default', type: templateType })
        }
      }

      // Check direct exports (export function, export const, etc.)
      if (ts.canHaveModifiers(node) && ts.getModifiers(node)?.some((mod) => mod.kind === ts.SyntaxKind.ExportKeyword)) {
        if (ts.isFunctionDeclaration(node) && node.name) {
          const symbol = typeChecker.getSymbolAtLocation(node.name)
          if (symbol) {
            const templateType = checkSymbolType(symbol, node.name)
            if (templateType) {
              matchingExports.push({ name: node.name.text, type: templateType })
            }
          }
        } else if (ts.isVariableStatement(node)) {
          for (const declaration of node.declarationList.declarations) {
            if (ts.isIdentifier(declaration.name)) {
              const symbol = typeChecker.getSymbolAtLocation(declaration.name)
              if (symbol) {
                const templateType = checkSymbolType(symbol, declaration.name)
                if (templateType) {
                  matchingExports.push({ name: declaration.name.text, type: templateType })
                }
              }
            }
          }
        }
      }

      ts.forEachChild(node, visit)
    }

    visit(sourceFile)
    return matchingExports
  } catch (error) {
    console.error(`Error analyzing ${filePath}:`, error)
    return []
  }
}
