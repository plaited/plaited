import { ets } from './easy-token-schema.ts'
import { DesignTokenGroup } from '../token-types.ts'

export const generate = async (
  tokens: DesignTokenGroup,
  schemaFilePath: string,
) => {
  const schema = ets({ tokens })
  await Deno.mkdir(schemaFilePath, { recursive: true })
  await Deno.writeTextFile(schemaFilePath, JSON.stringify(schema, null, 2))
}
