import { mkdir } from 'node:fs/promises';
import { formatList } from './format-list.js';
export const transformTsTokens = async ({ tokens, output, baseFontSize, formatters, }) => {
    await mkdir(output, { recursive: true });
    const content = formatList({
        tokens,
        allTokens: tokens,
        baseFontSize,
        formatters,
    });
    await Bun.write(`${output}/tokens.ts`, content);
};
