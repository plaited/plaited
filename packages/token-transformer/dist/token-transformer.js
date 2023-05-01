import { transformCssTokens } from './transform-css-tokens.js';
import { transformTsTokens } from './transform-ts-tokens.js';
import { defaultCSSFormatters } from './css-tokens/index.js';
import { defaultTSFormatters } from './ts-tokens/index.js';
export const tokenTransformer = async ({ tokens, output, baseFontSize = 20, cssFormatters = defaultCSSFormatters, tsFormatters = defaultTSFormatters, }) => {
    await transformCssTokens({
        tokens,
        output,
        baseFontSize,
        formatters: cssFormatters,
    });
    await transformTsTokens({
        tokens,
        output,
        baseFontSize,
        formatters: tsFormatters,
    });
};
