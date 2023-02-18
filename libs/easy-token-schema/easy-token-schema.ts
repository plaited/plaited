import { parse } from './parse.ts'
import { DesignTokenGroup } from '../token-types.ts'

export const easyTokenSchema = async <
  T extends DesignTokenGroup = DesignTokenGroup,
>(
  tokens: T,
  schemaFilePath: string,
) => {
  const schema = parse<T>({ tokens })
  await Deno.mkdir(schemaFilePath, { recursive: true })
  await Deno.writeTextFile(schemaFilePath, JSON.stringify(schema, null, 2))
}
