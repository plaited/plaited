/** an async function that will wait the given time passed to it in ms */
export const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
