import { sync, loop, thread, BPEvent } from 'plaited'

export const crudTypes = <T extends string>(context: T) =>
  [`CREATE_${context}`, `READ_${context}`, `UPDATE_${context}`, `DELETE_${context}`] as const
