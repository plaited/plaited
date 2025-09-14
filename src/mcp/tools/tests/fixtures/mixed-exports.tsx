import type { FunctionTemplate, FT } from 'plaited'
import { bElement } from 'plaited'

export const templateOne: FunctionTemplate = () => <div>One</div>
export const templateTwo: FT = () => <span>Two</span>
export const behavioralOne = bElement({
  tag: 'test-mixed-behavioral',
  shadowDom: <p>Behavioral</p>,
})

export const regularString = 'not a template'
export const regularNumber = 42
export const regularFunction = () => 'regular'
