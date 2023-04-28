/** an async function that will wait the given time passed to it in ms */
export const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));
