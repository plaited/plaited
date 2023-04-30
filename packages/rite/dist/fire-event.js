export const fireEvent = (element, eventName, options = {
    bubbles: true,
    composed: true,
    cancelable: true,
}) => {
    const createEvent = () => {
        if (options?.detail) {
            return new CustomEvent(eventName, options);
        }
        else {
            return new Event(eventName, options);
        }
    };
    return new Promise(resolve => {
        requestAnimationFrame(() => {
            const event = createEvent();
            element.dispatchEvent(event);
            resolve();
        });
    });
};
