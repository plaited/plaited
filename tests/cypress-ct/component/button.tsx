import { Component, css } from 'plaited'

const [cls, stylesheet] = css`
  .start {
    color: purple;
  }
`

export class Button extends Component({
  tag: 'hello-button',
  template: (
    <button {...stylesheet}>
      <span className={cls.start}>Hello</span>
      <slot></slot>
    </button>
  ),
}) {}
