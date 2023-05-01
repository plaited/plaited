import { camelCase } from 'lodash-es';
import { hasAlias, resolveTSVar } from '../resolve.js';
export const ruleSet = ({ tokenPath, $value, allTokens, }) => {
    if (hasAlias($value)) {
        return `export const ${camelCase(tokenPath.join(' '))} = ${resolveTSVar($value, allTokens)}`;
    }
    const toRet = Object.entries($value).map(([key, val]) => `  ${key}: ${resolveTSVar(val, allTokens)},`);
    return [`export const ${camelCase(tokenPath.join(' '))} = {`, ...toRet, '}']
        .join('\n');
};
