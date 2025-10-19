import { bElement } from 'plaited'

export const TestComponent = bElement({
  tag: 'test-component',
  shadowDom: <div p-target="content">Test Component</div>,
})
