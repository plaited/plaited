/**
 * @description a function for returning an unique enough id when you need it
 */
export const ueid = (prefix = '') => {
    const id = (Date.now().toString(36) + Math.random().toString(36).substr(2, 5))
        .toUpperCase();
    return String(prefix) + id;
};
let idCounter = 0;
/** For when you need id but are cool with just bumping a global counter */
export const generateId = (prefix = '') => {
    return prefix + String(idCounter++);
};
/** reset or set the global idCounter */
export const setIdCounter = (num) => {
    idCounter = num;
};
