import { FunctionTemplate, css } from 'plaited'

const { $stylesheet, ...cls } = css`
  .board {
    display: inline-grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(3, 1fr);
  }
  .square {
    all: unset;
    width: 44px;
    height: 44px;
    box-sizing: border-box;
    border: 1px solid transparent;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    border-right: 1px solid black;
    border-bottom: 1px solid black;

    &:nth-child(-n + 3) {
      border-top: 1px solid black;
    }

    &:nth-child(3n + 1) {
      border-left: 1px solid black;
    }
  }
`

export const BoardMarker: FunctionTemplate = () => (
  <div
    role='group'
    aria-label='board'
    className={cls.board}
    stylesheet={$stylesheet}
  >
    {Array.from(Array(9).keys()).map((n) => (
      <button
        className={cls.square}
        value={n}
        bp-trigger={{ click: 'click' }}
        bp-target={`${n}`}
      ></button>
    ))}
  </div>
)
