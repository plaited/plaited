import { FunctionTemplate, css } from 'plaited'
import { FlowDiagram } from './flow-diagram.js'

const { $stylesheet } = css`
  body{
    height: 100vh;
    width 100%;
    margin: 0;
  }
`
export const Page: FunctionTemplate = () => (
  <html>
    <head>
      <title>Viz</title>
    </head>
    <body stylesheet={$stylesheet}>
      <FlowDiagram />
    </body>
  </html>
)
