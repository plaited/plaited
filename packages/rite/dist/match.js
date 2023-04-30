const escapeRegex = (str) => str.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
export const match = (str) => (pattern) => {
    const RE = new RegExp(typeof pattern === 'string' ? escapeRegex(pattern) : pattern);
    const matched = str.match(RE);
    return matched ? matched[0] : '';
};
