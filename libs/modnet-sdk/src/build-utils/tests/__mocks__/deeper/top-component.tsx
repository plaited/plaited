import { Component } from 'plaited'
import { styles } from './constants.js'
import { NestedCustomElement } from './nested-component/nested-component.js'

export const TopCustomElement = Component({
  tag: 'top-component',
  template: (
    <NestedCustomElement>
      <p slot='nested' {...styles.slottedParagraph}>
        slotted paragraph
      </p>
    </NestedCustomElement>
  ),
})
