export const publisher = () => {
    const listeners = new Set();
    function createPublisher(value) {
        for (const cb of listeners) {
            cb(value);
        }
    }
    createPublisher.subscribe = (listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
    };
    return createPublisher;
};
