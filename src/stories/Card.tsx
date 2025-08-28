import { type FT } from 'plaited'
import { css } from 'plaited'

const styles = css.create({
  card: {
    padding: 'var(--defaultPadding, 20px 10px)',
    fontSize: 'var(--defaultFontSize, 16px)',
    border: 'var(--defaultBorder, 1px solid #333)',
    borderRadius: 'var(--defaultBorderRadius, 5px)',
    display: 'inline-grid',
    minWidth: 'var(--defaultMinWidth, 100px)',
  },
})

export const Card: FT = ({ children }) => <div {...styles.card}>{children}</div>
