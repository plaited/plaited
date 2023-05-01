import { hasAlias, resolveCSSVar } from '../resolve.js';
import { kebabCase } from 'lodash-es';
export const gradient = ({ tokenPath, $value, allTokens }) => {
    if (hasAlias($value))
        return '';
    const { gradientFunction, angleShapePosition, colorStops } = $value;
    const stops = colorStops.map(({ color, position }) => {
        const _color = color && hasAlias(color)
            ? resolveCSSVar(color, allTokens)
            : color;
        return [_color, position]
            .filter(Boolean)
            .join(' ');
    });
    return `:root { --${kebabCase(tokenPath.join(' '))}: ${gradientFunction}(${[angleShapePosition, ...stops].filter(Boolean).join(',')}); }`;
};
