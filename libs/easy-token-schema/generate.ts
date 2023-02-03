import { ets } from './easy-token-schema.ts'
import { DesignTokenGroup } from '../token-types.ts'

export const generate = async <
  T extends DesignTokenGroup = DesignTokenGroup,
>(
  tokens: T,
  schemaFilePath: string,
) => {
  const schema = ets<T>({ tokens })
  await Deno.mkdir(schemaFilePath, { recursive: true })
  await Deno.writeTextFile(schemaFilePath, JSON.stringify(schema, null, 2))
}
