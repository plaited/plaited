import { bElement } from 'plaited'
import type { StoryObj } from 'plaited/workshop'

import { styles, BEFORE_HYDRATION, AFTER_HYDRATION, HYDRATING_ELEMENT_TAG } from './hydrating-element.constants.js'

const HydratingElement = bElement({
  tag: HYDRATING_ELEMENT_TAG,
  shadowDom: (
    <>
      <div
        p-target='inner'
        {...styles.before()}
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
            {...styles.after()}
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
