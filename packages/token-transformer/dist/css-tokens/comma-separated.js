import { hasAlias } from '../resolve.js';
import { kebabCase } from 'lodash-es';
export const commaSeparated = ({ tokenPath, $value }) => {
    if (hasAlias($value))
        return '';
    if (Array.isArray($value)) {
        return (`:root { --${kebabCase(tokenPath.join(' '))}: ${$value.join(',')}; }`);
    }
    return `:root { --${kebabCase(tokenPath.join(' '))}: ${$value}; }`;
};
