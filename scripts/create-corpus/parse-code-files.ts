import ts from 'typescript'
import { Ollama } from 'ollama'
import path from 'path'
import fs from 'fs'

const ollama = new Ollama()
const embeddingModel = 'phi4-mini'

interface FileAnalysis {
  filePath: string
  source: string
  imports: string[]
  exports: {
    name: string
    description?: string
    embedding?: number[]
  }[]
  fileEmbedding: number[]
}

export const parseCodeFiles = async (typescriptFiles: string[]) => {
  const fileAnalyses: FileAnalysis[] = []
  const processedFiles = new Set<string>()
  const transpiler = new Bun.Transpiler({ loader: 'tsx' })

  const compilerOptions = {
    target: ts.ScriptTarget.Latest,
    module: ts.ModuleKind.CommonJS,
    allowJs: true,
    checkJs: true,
  }

  async function processFile(filePath: string) {
    if (processedFiles.has(filePath)) {
      return
    }

    processedFiles.add(filePath)

    const sourceText = await fs.promises.readFile(filePath, 'utf-8')
    const { exports, imports } = transpiler.scan(sourceText)

    // Create program for each file to get AST
    const program = ts.createProgram([filePath], compilerOptions)
    const sourceFile = program.getSourceFile(filePath)

    if (!sourceFile) {
      console.error(`Could not get source file for ${filePath}`)
      return
    }

    const exportedElements: { name: string; description?: string; embedding?: number[] }[] = []
    const isStoryFile = filePath.endsWith('stories.tsx')

    // Resolve and process imports
    const resolvedImports = imports
      .filter((imp) => {
        const path = imp.path
        return path.endsWith('.ts') || path.endsWith('.tsx')
      })
      .map((imp) => {
        const dir = path.dirname(filePath)
        return path.resolve(dir, imp.path)
      })

    // Process fixture imports recursively
    for (const importPath of resolvedImports) {
      if (fs.existsSync(importPath) && !processedFiles.has(importPath)) {
        await processFile(importPath)
      }
    }

    const visit = async (node: ts.Node) => {
      if (ts.isVariableDeclaration(node) && exports.includes(node.name.getText())) {
        if (isStoryFile) {
          const description = extractStoryDescription(node)
          if (description) {
            try {
              const descriptionEmbedding = await ollama.embeddings({
                model: embeddingModel,
                prompt: description,
              })

              exportedElements.push({
                name: node.name.getText(),
                description,
                embedding: descriptionEmbedding.embedding,
              })
            } catch (error) {
              console.error(`Error generating embedding for ${node.name.getText()}:`, error)
            }
          }
        } else {
          // For fixture files, generate embeddings of the entire export
          try {
            const exportText = node.getText()
            const exportEmbedding = await ollama.embeddings({
              model: embeddingModel,
              prompt: exportText,
            })

            exportedElements.push({
              name: node.name.getText(),
              embedding: exportEmbedding.embedding,
            })
          } catch (error) {
            console.error(`Error generating embedding for ${node.name.getText()}:`, error)
          }
        }
      }

      ts.forEachChild(node, visit)
    }

    await visit(sourceFile)

    try {
      const fileEmbedding = await ollama.embeddings({
        model: embeddingModel,
        prompt: sourceText,
      })

      fileAnalyses.push({
        filePath,
        source: sourceText,
        imports: resolvedImports,
        exports: exportedElements,
        fileEmbedding: fileEmbedding.embedding,
      })
    } catch (error) {
      console.error(`Error generating file embedding for ${filePath}:`, error)
    }
  }

  // Process initial files
  for (const file of typescriptFiles) {
    await processFile(file)
  }

  return fileAnalyses
}

function extractStoryDescription(node: ts.Node): string | undefined {
  if (ts.isVariableDeclaration(node) && node.initializer && ts.isObjectLiteralExpression(node.initializer)) {
    const descriptionProp = node.initializer.properties.find(
      (prop) => ts.isPropertyAssignment(prop) && prop.name.getText() === 'description',
    )

    if (
      descriptionProp &&
      ts.isPropertyAssignment(descriptionProp) &&
      ts.isStringLiteral(descriptionProp.initializer)
    ) {
      return descriptionProp.initializer.text
    }
  }
  return undefined
}
