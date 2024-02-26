import { css } from 'plaited'

export const { $stylesheet, ...cls } = css`
  :host {
    display: block;
    width: 100%;
    height: 100vh;
  }
  .canvas {
    width: 100%;
    height: 100%;
    overflow: auto;
  }
  .graph > polygon {
    fill: transparent;
  }

  .step {
  }
  .event {
  }
  .step-path {
  }
  .hover-path {
    
  }
`
