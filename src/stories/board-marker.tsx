import { type FT, css } from 'plaited'

const styles = css.create({
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
  <div
    role='group'
    aria-label='board'
    {...styles.board()}
  >
    {Array.from(Array(9).keys()).map((n) => (
      <button
        {...styles.square()}
        value={n}
        p-trigger={{ click: 'click' }}
        p-target={`${n}`}
      ></button>
    ))}
  </div>
)
