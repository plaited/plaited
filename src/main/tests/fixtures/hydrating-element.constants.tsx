import { createStyles, type FT } from 'plaited'

export const HYDRATING_ELEMENT_TAG = 'hydrating-element'
export const BEFORE_HYDRATION = 'before hydration'
export const AFTER_HYDRATION = 'after hydration'

export const styles = createStyles({
  before: {
    textDecoration: 'underline',
  },
  after: {
    textDecoration: 'line-through',
  },
})

export const ShadowDom: FT = (attrs) => (
  <div
    p-target='inner'
    {...attrs}
  >
    {BEFORE_HYDRATION}
  </div>
)
