import { createStyles, type FT } from 'plaited'

const componentStyles = createStyles({
  board: {
    display: 'inline-grid',
    gridTemplateColumns: 'repeat(3, 1fr)',
    gridTemplateRows: 'repeat(3, 1fr)',
  },
  square: {
    all: 'unset',
    width: '44px',
    height: '44px',
    boxSizing: 'border-box',
    border: '1px solid transparent',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    cursor: 'pointer',
    borderRight: '1px solid black',
    borderBottom: '1px solid black',
    borderTop: {
      ':nth-child(-n + 3)': '1px solid black',
    },
    borderLeft: {
      ':nth-child(3n + 1)': '1px solid black',
    },
  },
})

export const BoardMarker: FT = () => (
  // biome-ignore lint/a11y/useSemanticElements: Game board is not a form fieldset, role='group' is appropriate
  <div
    role='group'
    aria-label='board'
    {...componentStyles.board}
  >
    {Array.from(Array(9).keys()).map((n) => (
      <button
        {...componentStyles.square}
        value={n}
        p-trigger={{ click: 'click' }}
        p-target={`${n}`}
      ></button>
    ))}
  </div>
)
