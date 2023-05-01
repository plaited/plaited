/**
 * Utility helpers for resolving aliased values in tokens object
 */
import { camelCase, kebabCase } from 'lodash-es';
const getResolvedValue = (path, tokens) => {
    let toRet = { ...tokens };
    for (let i = 0, len = path.length; i < len; i++) {
        const key = path[i];
        const exist = key in toRet;
        if (exist) {
            //@ts-ignore: error handling
            toRet = toRet[key];
        }
        !exist && console.error('\x1b[36m', `\ninvalid path — token(${path.join('.')})`, '\x1b[31m', '\x1b[0m');
    }
    if (toRet?.hasOwnProperty('$value')) {
        //@ts-ignore: dynamic type checking
        return toRet;
    }
    console.error('\x1b[36m', `\nincomplete path — token(${path.join('.')})`, '\x1b[0m');
    return;
};
export const hasAlias = ($value) => {
    if (typeof $value !== 'string')
        return false;
    const regex = /^(?:\{)([^"]*?)(?:\})$/;
    return regex.test($value);
};
export const resolve = (value, allTokens) => {
    const path = value.slice(1, value.length - 1).split('.');
    const val = getResolvedValue(path, allTokens);
    // Need to dynamically check that val is itself not an alias
    if (val) {
        return [val, path];
    }
};
export const resolveCSSVar = (value, allTokens) => {
    const res = resolve(value, allTokens);
    if (!res)
        return '';
    const [, path] = res;
    return `var(--${kebabCase(path.join(' '))})`;
};
export const resolveTSVar = (value, allTokens) => {
    const res = resolve(value, allTokens);
    if (!res)
        return '';
    const [, path] = res;
    return camelCase(path.join(' '));
};
