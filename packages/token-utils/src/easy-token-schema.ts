import { parse } from "./parse.js";
import { DesignTokenGroup } from "./types.js";

export const easyTokenSchema = async <
  T extends DesignTokenGroup = DesignTokenGroup,
>(
  { tokens, output, name = "token-schema.json" }: {
    /** A object type {@link DesignTokenGroup} */
    tokens: T;
    /** directory you want to write json schema too */
    output: string;
    /** is the file name you want to use default to token-schema.json */
    name?: `${string}.json`;
  },
) => {
  const schema = parse<T>({ tokens });
  await Deno.mkdir(output, { recursive: true });
  await Deno.writeTextFile(
    `${output}/${name}`,
    JSON.stringify(schema, null, 2),
  );
};
