import { sync, thread } from 'plaited/behavioral'

export const ticker = thread([sync({ request: { type: 'tick' } })], true)

export const worker = thread([sync({ request: { type: 'start', detail: { id: 'job-1' } } })], true)
