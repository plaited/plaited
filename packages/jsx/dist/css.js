import { hashString, trueTypeOf } from '@plaited/utils';
export const reduceWhitespace = (str) => str.replace(/(\s\s+|\n)/g, ' ');
const isTruthy = (val) => trueTypeOf(val) === 'string' ||
    trueTypeOf(val) === 'number';
const taggedWithPrimitives = (strings, ...expressions) => {
    const { raw } = strings;
    let result = expressions.reduce((acc, subst, i) => {
        acc += reduceWhitespace(raw[i]);
        let filteredSubst = Array.isArray(subst)
            ? subst.filter(isTruthy).join('')
            : isTruthy(subst)
                ? subst
                : '';
        if (acc.endsWith('$')) {
            filteredSubst = escape(filteredSubst);
            acc = acc.slice(0, -1);
        }
        return acc + filteredSubst;
    }, '');
    return result += reduceWhitespace(raw[raw.length - 1]);
};
const tokenize = (css) => {
    const regex = /\.(-?[_a-zA-Z]+[_a-zA-Z0-9-]*)/gm;
    const matches = [];
    let lastIndex = 0;
    let match;
    while ((match = regex.exec(css)) !== null) {
        // Add any non-matching text to the array
        if (match.index > lastIndex) {
            matches.push(css.substring(lastIndex, match.index));
        }
        // Add the class object to the array
        matches.push({ content: match[1] });
        // Update the last index to the end of the match
        lastIndex = regex.lastIndex;
    }
    // Add any remaining non-matching text to the array
    if (lastIndex < css.length) {
        matches.push(css.substring(lastIndex));
    }
    return matches;
};
/** tagged template function for creating css module style styles and classNames objects */
export const css = (strings, ...expressions) => {
    const result = taggedWithPrimitives(strings, ...expressions);
    const suffix = btoa(`${hashString(result)}`).replace(/[+/=]/g, '');
    const tokens = tokenize(result);
    const classes = new Map();
    const addClass = (key) => {
        const value = `${key}_${suffix.slice(0, 6)}`;
        const toRet = `.${value}`;
        if (classes.has(key))
            return toRet;
        classes.set(key, value);
        return toRet;
    };
    const styles = tokens?.map(token => typeof token === 'string'
        ? reduceWhitespace(token)
        : addClass(token.content)).join('') || '';
    return Object.freeze([Object.fromEntries(classes), {
            stylesheet: reduceWhitespace(styles).trim(),
        }]);
};
