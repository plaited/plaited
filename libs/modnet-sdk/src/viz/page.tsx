import { FunctionTemplate, css } from 'plaited'
import { FlowDiagram } from './flow-diagram.js'
import { register } from '../build-utils/register.js'
const { $stylesheet } = css`
  body{
    height: 100vh;
    width 100%;
    margin: 0;
  }
`
export default () => (
  <html>
    <head>
      <title>Viz</title>
    </head>
    <body stylesheet={$stylesheet}>
      <FlowDiagram />
    </body>
  </html>
)

