import { camelCase, kebabCase } from 'lodash-es';
import { hasAlias, resolveTSVar } from '../resolve.js';
export const defaultFormat = ({ tokenPath, $value, allTokens, }) => {
    const val = hasAlias($value)
        ? resolveTSVar($value, allTokens)
        : `'var(--${kebabCase(tokenPath.join(' '))})'`;
    return `export const ${camelCase(tokenPath.join(' '))} = ${val}`;
};
