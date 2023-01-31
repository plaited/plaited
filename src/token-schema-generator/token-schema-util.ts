import fs from 'fs/promises'
import path from 'path'
import { parse } from './parse.ts'
import { DesignTokenGroup } from '../types.ts'

export const tokenSchemaUtil = async (tokens: DesignTokenGroup, schemaFilePath: string) => {
  const schema = parse({ tokens })
  await Deno.mkdir(path.dirname(schemaFilePath), { recursive: true })
  await writeFile(schemaFilePath, JSON.stringify(schema, null, 2))
}

