import ts from 'typescript'
import { TSDocParser, DocComment } from '@microsoft/tsdoc'
import { Ollama } from 'ollama'

const ollama = new Ollama()
const embeddingModel = 'ph4i-mini' // While sources mention phi-1, you specified phi4-mini. Use accordingly.

interface CodeElementInfo {
  kind: string
  name: string
  signature: string
  documentation?: string
  fullText: string
}

const formatTSDocComment = (docComment: DocComment): string => {
  try {
    let formatted = docComment?.summarySection?.getChildNodes()[0]?.toString().trim() || ''

    const params = docComment.params
    if (params) {
      params.blocks.forEach((paramBlock) => {
        if (paramBlock?.parameterName) {
          formatted += `\n@param ${paramBlock.parameterName} - ${paramBlock.content.getChildNodes()[0]?.toString().trim()}`
        }
      })
    }

    const returns = docComment.returnsBlock
    if (returns) {
      formatted += `\n@returns ${returns.content.getChildNodes()[0]?.toString().trim()}`
    }

    return formatted
  } catch (error) {
    console.warn('Error formatting TSDoc comment:', error)
    return ''
  }
}

export const parseCodeFiles = async (typescriptFiles: string[]) => {
  const codeElements: CodeElementInfo[] = []

  // Create compiler host and program
  const compilerOptions = {
    target: ts.ScriptTarget.Latest,
    module: ts.ModuleKind.CommonJS,
    allowJs: true,
    checkJs: true,
  }

  const compilerHost = ts.createCompilerHost(compilerOptions)
  const program = ts.createProgram(typescriptFiles, compilerOptions, compilerHost)
  const checker = program.getTypeChecker()
  const parser = new TSDocParser()

  // Process each source file
  for (const sourceFile of program.getSourceFiles()) {
    // Skip declaration files and files not in our input list
    if (sourceFile.isDeclarationFile || !typescriptFiles.includes(sourceFile.fileName)) {
      continue
    }

    const visit = (node: ts.Node) => {
      // Helper function to get symbol safely
      const getSymbol = (node: ts.Node): ts.Symbol | undefined => {
        try {
          return checker.getSymbolAtLocation(node) || undefined
        } catch {
          return undefined
        }
      }

      if (
        (ts.isFunctionDeclaration(node) ||
          ts.isClassDeclaration(node) ||
          ts.isInterfaceDeclaration(node) ||
          ts.isTypeAliasDeclaration(node)) &&
        node.name
      ) {
        const symbol = getSymbol(node.name)

        if (symbol && symbol.flags & ts.SymbolFlags.ExportValue) {
          let documentation: string | undefined = undefined
          const symbolDocs = symbol.getDocumentationComment(checker)
          if (symbolDocs.length > 0) {
            const docString = ts.displayPartsToString(symbolDocs)
            const docComment = parser.parseString(`/*${docString}*/`).docComment
            documentation = formatTSDocComment(docComment)
          }

          const signature = checker.typeToString(checker.getTypeAtLocation(node), node, ts.TypeFormatFlags.NoTruncation)

          codeElements.push({
            kind: ts.SyntaxKind[node.kind],
            name: symbol.name,
            signature,
            documentation,
            fullText: node.getFullText(sourceFile).trim(),
          })
        }
      } else if (ts.isVariableStatement(node)) {
        // Handle exported variables
        node.declarationList.declarations.forEach((declaration) => {
          if (ts.isIdentifier(declaration.name)) {
            const symbol = getSymbol(declaration.name)
            if (symbol && symbol.flags & ts.SymbolFlags.ExportValue) {
              const documentation = symbol
                .getDocumentationComment(checker)
                .map((doc) => doc.text)
                .join('\n')

              codeElements.push({
                kind: 'VariableDeclaration',
                name: symbol.name,
                signature: checker.typeToString(
                  checker.getTypeAtLocation(declaration),
                  declaration,
                  ts.TypeFormatFlags.NoTruncation,
                ),
                documentation,
                fullText: node.getFullText(sourceFile).trim(),
              })
            }
          }
        })
      }

      ts.forEachChild(node, visit)
    }

    visit(sourceFile)
  }

  const embeddings: { [key: string]: number[] } = {}

  // Generate embeddings for each code element
  for (const element of codeElements) {
    const textToEmbed = `${element.kind}: ${element.name} ${element.signature}. Documentation: ${
      element.documentation || 'No documentation.'
    } Code: ${element.fullText}`

    try {
      const response = await ollama.embeddings({
        model: embeddingModel,
        prompt: textToEmbed,
      })
      embeddings[element.fullText] = response.embedding
      console.log(`Generated embedding for: ${element.kind} ${element.name}`)
    } catch (error) {
      console.error(`Error generating embedding for ${element.kind} ${element.name}:`, error)
    }
  }

  return { codeElements, embeddings }
}
