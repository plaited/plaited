import * as css from 'plaited/css'

export const styles = css.styles({
  before: {
    textDecoration: 'underline',
  },
  after: {
    textDecoration: 'line-through',
  },
})

export const BEFORE_HYDRATION = 'before hydration'
export const AFTER_HYDRATION = 'after hydration'
export const HYDRATING_ELEMENT_TAG = 'hydrating-element'
