import { hasAlias } from '../resolve.js';
import { kebabCase } from 'lodash-es';
import { dimension } from './dimension.js';
export const gap = ({ tokenPath, $value, baseFontSize, allTokens }) => {
    if (hasAlias($value))
        return '';
    if (typeof $value === 'string') {
        return `:root { --${kebabCase(tokenPath.join(' '))}:${$value}; }`;
    }
    return dimension({
        tokenPath,
        $value: $value,
        baseFontSize,
        allTokens,
    });
};
