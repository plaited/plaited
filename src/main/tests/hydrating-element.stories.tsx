import type { StoryObj } from 'plaited/workshop'

import { defineElement } from 'plaited'
import { styles } from './hydrating-element.css.js'

const BEFORE_HYDRATION = 'before hydration'
const AFTER_HYDRATION = 'after hydration'
const HYDRATING_ELEMENT_TAG = 'hydrating-element'

const HydratingElement = defineElement({
  tag: HYDRATING_ELEMENT_TAG,
  publicEvents: ['update'],
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
      update() {
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
  template: () => <HydratingElement data-testid='target' />,
}
