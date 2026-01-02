import { bElement } from 'plaited'

import { AFTER_HYDRATION, HYDRATING_ELEMENT_TAG, ShadowDom, styles } from './hydrating-element.constants.tsx'

export const HydratingElement = bElement({
  tag: HYDRATING_ELEMENT_TAG,
  shadowDom: <ShadowDom {...styles.before} />,
  bProgram({ $ }) {
    return {
      onConnected() {
        const [inner] = $('inner')
        inner?.replace(
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
