export const deepEqual = (objA, objB, map = new WeakMap()) => {
    //  First-level filtering
    if (Object.is(objA, objB))
        return true;
    //  Special handling is required for Date and RegExp
    if (objA instanceof Date && objB instanceof Date) {
        return objA.getTime() === objB.getTime();
    }
    if (objA instanceof RegExp && objB instanceof RegExp) {
        return objA.toString() === objB.toString();
    }
    //  Make sure both are objects and return false if either is not.
    if (typeof objA !== 'object' ||
        objA === null ||
        typeof objB !== 'object' ||
        objB === null) {
        return false;
    }
    // Use WeakMap as a hash table to solve the circular reference problem
    if (map.get(objA) === objB)
        return true;
    map.set(objA, objB);
    if (Array.isArray(objA) && Array.isArray(objB)) {
        if (objA.length !== objB.length)
            return false;
        for (let i = objA.length; i-- !== 0;) {
            if (!deepEqual(objA[i], objB[i]))
                return false;
        }
        return true;
    }
    if (objA instanceof Map &&
        objB instanceof Map) {
        if (objA.size !== objB.size)
            return false;
        for (const i of objA.entries()) {
            if (!objB.has(i[0]))
                return false;
        }
        for (const i of objA.entries()) {
            if (!deepEqual(i[1], objB.get(i[0])))
                return false;
        }
        return true;
    }
    if (objA instanceof Set &&
        objB instanceof Set) {
        if (objA.size !== objB.size)
            return false;
        const arrA = [...objA.values()];
        const arrB = [...objB.values()];
        for (let i = arrA.length; i-- !== 0;) {
            if (!deepEqual(arrA[i], arrB[i]))
                return false;
        }
        return true;
    }
    if ((objA instanceof ArrayBuffer && objB instanceof ArrayBuffer) ||
        (ArrayBuffer.isView(objA) && ArrayBuffer.isView(objB))) {
        {
            if (objA.byteLength != objB.byteLength)
                return false;
            const dv1 = new Int8Array(objA);
            const dv2 = new Int8Array(objB);
            for (let i = 0; i != objA.byteLength; i++) {
                if (dv1[i] != dv2[i])
                    return false;
            }
            return true;
        }
    }
    // It's probably an object use reflect to get all keys then loop
    const keysA = Reflect.ownKeys(objA);
    const keysB = Reflect.ownKeys(objB);
    if (keysA.length !== keysB.length) {
        return false;
    }
    for (let i = 0; i < keysA.length; i++) {
        if (!Reflect.has(objB, keysA[i]) ||
            !deepEqual(objA[keysA[i]], objB[keysA[i]], map)) {
            return false;
        }
    }
    return true;
};
