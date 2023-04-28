/**
 * @summary djb2 hashing function
 */
export const hashString = (str) => {
    const hash = [...str].reduce((acc, cur) => ((acc << 5) + acc) + cur.charCodeAt(0), 5381);
    return hash === 5381 ? null : hash;
};
