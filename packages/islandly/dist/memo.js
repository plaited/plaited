const shallowCompare = (obj1, obj2) => Object.keys(obj1).length === Object.keys(obj2).length &&
    Object.keys(obj1).every(key => Object.hasOwn(obj2, key) && obj1[key] === obj2[key]);
/**
 * Forked from  memoize-one
 * (c) Alexander Reardon - MIT
 * {@see https://github.com/alexreardon/memoize-one}
 * In this mode we constrain arguments to a single props object that extends TemplateProps
 * We also do a basic shallow comparison on the object to cache function result.
 */

export const memo = (resultFn) => {
    let cache = null;
    function tpl(props) {
        if (cache && cache.lastThis === this && shallowCompare(props, cache.lastProps)) {
            return cache.lastResult;
        }
        const lastResult = resultFn.call(this, props);
        cache = {
            lastResult,
            lastProps: props,
            lastThis: this,
        };
        return lastResult;
    }
    return tpl;
};
