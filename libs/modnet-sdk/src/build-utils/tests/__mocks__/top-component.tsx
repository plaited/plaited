import { Component } from 'plaited'
import { nestedChildrenStyles } from './constants.js'
import { NestedCustomElement } from './nested-component.js'

export const TopCustomElement = Component({
  tag: 'top-component',
  template: (
    <NestedCustomElement>
      <p
        slot='nested'
        className={nestedChildrenStyles['slotted-paragraph']}
        stylesheet={nestedChildrenStyles.$stylesheet}
      >
        slotted paragraph
      </p>
    </NestedCustomElement>
  ),
})
