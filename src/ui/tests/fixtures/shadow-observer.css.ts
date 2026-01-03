import { createStyles } from 'plaited/ui'

export const styles = createStyles({
  button: {
    border: '1px solid black',
    padding: '4px 8px',
    cursor: 'pointer',
    backgroundColor: 'white',
    color: 'black',
    borderRadius: '4px',
    height: '18px',
    width: 'auto',
  },
  zone: {
    border: '1px black dashed',
    margin: '24px',
    padding: '12px',
    height: '300px',
    display: 'flex',
    flexDirection: 'column',
    gap: '25px',
    position: 'relative',
  },
  svg: {
    width: '125px',
    height: '125px',
  },
  'sub-island': {
    height: '100%',
    width: '100%',
    position: 'absolute',
    top: '0',
    left: '0',
    margin: '0',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    background: '#000000 0.75',
    color: '#ffffff 0.8',
  },
  row: {
    display: 'flex',
    gap: '10px',
    padding: '12px',
  },
  slot: {
    height: {
      '::slotted(button)': '18px',
    },
    width: {
      '::slotted(button)': 'auto',
    },
  },
})
