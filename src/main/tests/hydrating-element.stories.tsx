import type { StoryObj } from 'plaited/workshop'

import { defineElement } from 'plaited'
import { styles, BEFORE_HYDRATION, AFTER_HYDRATION, HYDRATING_ELEMENT_TAG } from './hydrating-element.constants.js'

const HydratingElement = defineElement({
  tag: HYDRATING_ELEMENT_TAG,
  shadowDom: (
    <>
      <div
        p-target='inner'
        {...styles.before}
      >
        {BEFORE_HYDRATION}
      </div>
    </>
  ),
  bProgram({ $ }) {
    return {
      onConnected() {
        const [inner] = $('inner')
        inner.replace(
          <span
            {...styles.after}
            p-target='inner'
          >
            {AFTER_HYDRATION}
          </span>,
        )
      },
    }
  },
})

export const target: StoryObj = {
  description: `Element that will be fetched as an include in another story to hydrate`,
  template: () => <HydratingElement p-target={HYDRATING_ELEMENT_TAG} />,
}
