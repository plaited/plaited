import { formatList } from "./format-list.js";
import { DesignTokenGroup, GetFormatters } from "./types.js";

export const transformTsTokens = async ({
  tokens,
  output,
  baseFontSize,
  formatters,
}: {
  tokens: DesignTokenGroup;
  output: string;
  baseFontSize: number;
  formatters: GetFormatters;
}) => {
  await Deno.mkdir(output, { recursive: true });
  const content = formatList({
    tokens,
    allTokens: tokens,
    baseFontSize,
    formatters,
  });
  await Deno.writeTextFile(`${output}/tokens.ts`, content);
};
