import { css, defineElement } from 'plaited'

export const RED = 'rgb(255, 0, 0)'
export const GREEN = 'rgb(0, 128, 0)'

const styles = css.create({
  before: {
    color: RED,
  },
  after: {
    color: GREEN,
  },
})

export const STREAM_ASSOCIATED_SLOT = 'stream associated slot'
export const BEFORE_HYDRATION = 'before hydration'
export const AFTER_HYDRATION = 'after hydration'
export const HYDRATING_ELEMENT_TAG = 'hydrating-element'

export const HydratingElement = defineElement({
  tag: HYDRATING_ELEMENT_TAG,
  publicEvents: ['update'],
  streamAssociated: true,
  shadowDom: (
    <>
      <div
        p-target='inner'
        {...styles.before}
      >
        {BEFORE_HYDRATION}
      </div>
      <slot>{STREAM_ASSOCIATED_SLOT}</slot>
    </>
  ),
  bProgram({ $ }) {
    return {
      update() {
        const [inner] = $('inner')
        inner.render(<span {...styles.after}>{AFTER_HYDRATION}</span>)
      },
    }
  },
})
