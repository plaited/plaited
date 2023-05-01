import { hasAlias } from '../resolve.js';
import { kebabCase } from 'lodash-es';
import { getRem } from '../get-rem.js';
export const dimension = ({ tokenPath, $value, baseFontSize }) => {
    if (hasAlias($value))
        return '';
    if (typeof $value === 'number') {
        return (`:root { --${kebabCase(tokenPath.join(' '))}:${getRem($value, baseFontSize)}; }`);
    }
    const toRet = [];
    for (const media in $value) {
        const val = $value[media];
        if (hasAlias(val))
            continue;
        toRet.push(`[data-media="${media}"]:root { --${kebabCase(tokenPath.join(' '))}:${getRem(val, baseFontSize)}; }`);
    }
    return toRet.join('\n');
};
