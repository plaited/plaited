import { Component } from 'plaited'
import { styles } from '../constants.js'

export const RadomComponent = Component({
  tag: 'random-component',
  template: (
    <>
      <span {...styles.nestedLabel}>inside nested template</span>
      <slot name='nested'></slot>
    </>
  ),
  bp() {
    const worker = new Worker(new URL(`/src/build-utils/tests/__mocks__/_components/test.worker.ts`, import.meta.url), {
      type: 'module',
    })
  },
})
