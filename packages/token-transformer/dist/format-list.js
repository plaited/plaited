/* eslint-disable no-return-assign */
import { trueTypeOf } from '@plaited/utils';
export const formatList = ({ tokens, tokenPath = [], formatters, allTokens, baseFontSize, }) => {
    let string = '';
    if (trueTypeOf(tokens) !== 'object') {
        return string;
    }
    if (Object.hasOwn(tokens, '$value')) {
        const { $value, $type } = tokens;
        const formattedValue = formatters({
            tokenPath,
            $value,
            allTokens,
            baseFontSize,
            $type,
        });
        string += formattedValue ? `${formattedValue}\n` : '';
    }
    else {
        for (const name in tokens) {
            if (Object.hasOwn(tokens, name)) {
                string += formatList({
                    baseFontSize,
                    tokens: tokens[name],
                    tokenPath: [...tokenPath, name],
                    formatters,
                    allTokens,
                });
            }
        }
    }
    return string;
};
