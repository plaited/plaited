import fs from 'fs/promises'
import path from 'path'
import { parse } from './parse.js'
import { importJson } from '../import-json.js'
import { JSON } from '../types.js'

export const tokenSchemaUtil = async (tokensFilePath: string, schemaFilePath: string) => {
  const  json = await importJson<JSON>(tokensFilePath)
  const schema = parse({ json })
  await fs.mkdir(path.dirname(schemaFilePath), { recursive: true })
  await fs.writeFile(schemaFilePath, JSON.stringify(schema, null, 2))
}

