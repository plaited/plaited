import { hasAlias } from '../resolve.js';
import { kebabCase } from 'lodash-es';
import { getRem } from '../get-rem.js';
const getFitContent = ({ func, value, baseFontSize, acc = '', }) => acc +
    ` ${func}(${typeof value === 'string' ? value : getRem(value, baseFontSize)})`;
const getMinMax = ({ func, acc = '', baseFontSize, min, max, }) => acc +
    ` ${func}(${typeof min === 'number' ? getRem(min, baseFontSize) : min}, ${typeof max === 'number' ? getRem(max, baseFontSize) : max})`;
export const gridTemplate = ({ tokenPath, $value, baseFontSize }) => {
    if (hasAlias($value))
        return '';
    if (typeof $value[0] === 'string' && /"(\w*)"/.test($value[0])) {
        return `:root { --${kebabCase(tokenPath.join(' '))}: ${$value.join(' ')}; }`;
    }
    const _value = $value
        .reduce((acc, cur) => {
        if (typeof cur === 'number') {
            return acc + ` ${getRem(cur, baseFontSize)}`;
        }
        if (typeof cur === 'string') {
            return acc + ` ${cur}`;
        }
        if (cur.function === 'fit-content') {
            getFitContent({
                acc,
                baseFontSize,
                func: cur.function,
                value: cur.value,
            });
        }
        if (cur.function === 'minmax') {
            getMinMax({
                acc,
                baseFontSize,
                func: cur.function,
                min: cur.range[0],
                max: cur.range[1],
            });
        }
        if (cur.function === 'repeat') {
            const func = cur.function;
            const tracks = cur.tracks.map(val => {
                if (typeof val === 'number') {
                    return ` ${getRem(val, baseFontSize)}`;
                }
                if (typeof val === 'string') {
                    return ` ${val}`;
                }
                if (val.function === 'fit-content') {
                    return getFitContent({
                        baseFontSize,
                        func: val.function,
                        value: val.value,
                    });
                }
                if (val.function === 'minmax') {
                    return getMinMax({
                        baseFontSize,
                        func: val.function,
                        min: val.range[0],
                        max: val.range[1],
                    });
                }
            }).join(' ');
            return acc + ` ${func}(${tracks.trim()})`;
        }
        return acc;
    }, '');
    return `:root { --${kebabCase(tokenPath.join(' '))}: ${_value}; }`;
};
