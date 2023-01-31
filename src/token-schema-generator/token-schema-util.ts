import { parse } from './parse.ts'
import { DesignTokenGroup } from '../token-types.ts'

export const tokenSchemaUtil = async (
  tokens: DesignTokenGroup,
  schemaFilePath: string,
) => {
  const schema = parse({ tokens })
  const encoder = new TextEncoder()
  const data = encoder.encode(JSON.stringify(schema, null, 2))
  await Deno.mkdir(schemaFilePath, { recursive: true })
  await Deno.writeFile(schemaFilePath, data)
}
