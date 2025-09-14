import { bElement } from 'plaited'

export const myBehavioralTemplate = bElement({
  tag: 'test-behavioral',
  shadowDom: <div>Behavioral Template</div>
})

export const notBehavioral = () => 'regular function'
