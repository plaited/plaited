import { parse } from './parse.ts'
import { DesignTokenGroup } from '../token-types.ts'

export const easyTokenSchema = async <
  T extends DesignTokenGroup = DesignTokenGroup,
>(
  { tokens, output, name = 'token-schema' }: {
    tokens: T
    output: string
    name?: string
  },
) => {
  const schema = parse<T>({ tokens })
  await Deno.mkdir(output, { recursive: true })
  await Deno.writeTextFile(
    `${output}/${name}.json`,
    JSON.stringify(schema, null, 2),
  )
}
