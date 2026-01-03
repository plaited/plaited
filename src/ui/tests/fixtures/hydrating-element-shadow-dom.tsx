import type { FT } from 'plaited/ui'
import { BEFORE_HYDRATION } from './hydrating-element.constants.ts'

export const ShadowDom: FT = (attrs) => (
  <div
    p-target='inner'
    {...attrs}
  >
    {BEFORE_HYDRATION}
  </div>
)
