import { hasAlias, resolveCSSVar } from '../resolve.js';
import { kebabCase } from 'lodash-es';
export const dropShadow = ({ tokenPath, $value, allTokens }) => {
    if (hasAlias($value))
        return '';
    const { offsetX, offsetY, blur, color } = $value;
    const val = [
        offsetX,
        offsetY,
        blur,
        color && hasAlias(color) ? resolveCSSVar(color, allTokens) : color,
    ].filter(Boolean);
    return `:root { --${kebabCase(tokenPath.join(' '))}:drop-shadow(${val.join(' ')}); }`;
};
