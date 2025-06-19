import { css } from 'plaited'

export const RED = 'rgb(255, 0, 0)'
export const GREEN = 'rgb(0, 128, 0)'

export const styles = css.create({
  before: {
    color: RED,
  },
  after: {
    color: GREEN,
  },
})
