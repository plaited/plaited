import { css } from '$plaited'

export const [classes, stylesheet] = css`
  :host {
    --button-size: 50px;
  }
  .calculator {
    display: grid;
    gap: 10px;
    grid-template-areas: 
      "display display display display"
      ". . . ."
      ". . . ."
      ". . . ."
      ". . . ."
      ". . . .";
    grid-template-columns: repeat(4, var(--button-size));
    grid-template-rows: calc(2 * var(--button-size)) repeat(5, var(--button-size));
  }
  .display {
    grid-area: display;
    text-align: end;
  }
  .header {
    margin: 0;
    height: 50%;
  }
  .number {
    width: var(--button-size);
    height:  var(--button-size);
  }
  .side {
    width: var(--button-size);
    height:  var(--button-size);
  }
  .top {
    width: var(--button-size);
    height:  var(--button-size);
  }
  .clear {
    width: var(--button-size);
    height:  var(--button-size);
  }
`
