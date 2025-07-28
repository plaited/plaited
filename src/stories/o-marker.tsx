import { type FT } from 'plaited'
import { css } from 'plaited'

const styles = css.create({
  o: {
    width: '20px',
    height: '20px',
    color: '#f2e7dc',
  },
})

export const OMarker: FT = () => (
  <svg
    {...styles.o}
    viewBox='0 0 20 20'
    fill='none'
    xmlns='http://www.w3.org/2000/svg'
  >
    <path
      d='M0 10C0 15.5 4.5 20 10 20C15.5 20 20 15.5 20 10C20 4.5 15.5 0 10 0C4.5 0 0 4.4 0 10ZM15 10C15 12.8 12.8 15 10 15C7.2 15 5 12.8 5 10C5 7.2 7.2 5 10 5C12.8 5 15 7.2 15 10Z'
      fill='currentColor'
    />
  </svg>
)
