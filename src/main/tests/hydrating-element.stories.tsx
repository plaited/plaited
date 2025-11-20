import { bElement } from 'plaited'
import { story } from 'plaited/testing'

import { AFTER_HYDRATION, BEFORE_HYDRATION, HYDRATING_ELEMENT_TAG, styles } from './hydrating-element.constants.js'

const HydratingElement = bElement({
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

export const target = story({
  description: `Element that will be fetched as an include in another story to hydrate`,
  template: () => <HydratingElement p-target={HYDRATING_ELEMENT_TAG} />,
})
