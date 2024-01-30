import { css } from 'plaited'

export const nestedDeclarativeStyles = css`
  .nested-label {
    font-weight: bold;
  }
`

export const nestedHostStyles = css`
  nested-component {
    display: flex;
    flex-direction: column;
  }
`

export const nestedChildrenStyles = css`
  .slotted-paragraph {
    color: rebeccapurple;
  }
`
