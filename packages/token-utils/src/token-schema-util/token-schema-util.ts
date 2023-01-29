import fs from 'fs/promises'
import path from 'path'
import { parse } from './parse.js'
import { DesignTokenGroup } from '../types.js'

export const tokenSchemaUtil = async (tokens: DesignTokenGroup, schemaFilePath: string) => {
  const schema = parse({ tokens })
  await fs.mkdir(path.dirname(schemaFilePath), { recursive: true })
  await fs.writeFile(schemaFilePath, JSON.stringify(schema, null, 2))
}

