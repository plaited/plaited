import type { StoryObj } from 'plaited/workshop'

import { defineElement } from 'plaited'
import { styles } from  './hydrating-element.css.js'

const STREAM_ASSOCIATED_SLOT = 'stream associated slot'
const BEFORE_HYDRATION = 'before hydration'
const AFTER_HYDRATION = 'after hydration'
const HYDRATING_ELEMENT_TAG = 'hydrating-element'

const HydratingElement = defineElement({
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


export const target: StoryObj = {
  description: `Element that will be fetched as an include in another story to hydrate`,
  template: () => <HydratingElement data-testid='target' />,
}
