
import { dataTrigger as attr } from './constants.js'
export const dataTrigger = (triggers: Record<string, string>) => `${attr}="${Object.entries(triggers)
  .map<string>(([ ev, req ]) => `${ev}->${req}`)
  .join(' ')
}"`
