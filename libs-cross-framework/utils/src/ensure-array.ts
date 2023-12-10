export const ensureArray = <T>(obj: T | T[] = []) => (!Array.isArray(obj) ? [obj] : obj)
