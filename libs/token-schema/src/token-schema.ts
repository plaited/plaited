import { mkdir } from 'node:fs/promises'
import { DesignTokenGroup } from '@plaited/token-types'
import { parse } from './parse.js'

export const tokenSchema = async <
  T extends DesignTokenGroup = DesignTokenGroup,
>(
  { tokens, output, name = 'token-schema.json' }: {
    /** A object type {@link DesignTokenGroup} */
    tokens: T;
    /** directory you want to write json schema too */
    output: string;
    /** is the file name you want to use default to token-schema.json */
    name?: `${string}.json`;
  }
) => {
  const schema = parse<T>({ tokens })
  await mkdir(output, { recursive: true })
  await Bun.write(
    `${output}/${name}`,
    JSON.stringify(schema, null, 2)
  )
}
