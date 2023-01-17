import fs from 'fs/promises'
import path from 'path'
import { parse } from './parse.js'
import { JSON } from './types.js'

export const tokenSchemaUtil = async (json: JSON, schemaFilePath: string) => {
  const schema = parse({ json })
  await fs.mkdir(path.dirname(schemaFilePath), { recursive: true })
  await fs.writeFile(schemaFilePath, JSON.stringify(schema, null, 2))
}

