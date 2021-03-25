export const candidatesList = pending => pending.reduce((acc, {request, ...rest}) => acc.concat(
// Flatten bids' request arrays
request ? request.map(event => ({...rest, ...event})) : []), [])
export const blockedList = pending => pending.reduce((acc, {block}) => acc.concat(
// Flatten bids' block arrays
block ? block.map(event => event) : []), [])
