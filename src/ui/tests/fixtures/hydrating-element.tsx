import { bElement } from 'plaited/ui'

import { AFTER_HYDRATION, HYDRATING_ELEMENT_TAG } from './hydrating-element.constants.ts'
import { styles } from './hydrating-element.css.ts'
import { ShadowDom } from './hydrating-element-shadow-dom.tsx'

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
