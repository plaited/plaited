import { DevCallback } from '$plaited'
export const logger: DevCallback = msg => {
  console.table(msg)
}
