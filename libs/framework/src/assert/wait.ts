/** an async function that will wait the given time passed to it in ms */
type Wait = (ms: number) => Promise<unknown>
export const wait: Wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
