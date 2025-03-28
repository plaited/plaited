import { Project } from 'ts-morph'

export const getAst = (filePath: string, source: string) => {
  const project = new Project()
  const sourceFile = project.createSourceFile(filePath, source, { overwrite: true })
  return sourceFile.getStructure()
}
