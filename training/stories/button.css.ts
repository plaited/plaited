import { createKeyframes, createStyles } from 'plaited/ui'

const { spin } = createKeyframes('spin', {
  '0%': { transform: 'rotate(0deg)' },
  '100%': { transform: 'rotate(360deg)' },
})

export const buttonStyles = createStyles({
  btn: {
    padding: '10px 20px',
    border: 'none',
    borderRadius: '4px',
    cursor: 'pointer',
    fontFamily: 'system-ui, sans-serif',
    fontSize: '14px',
    fontWeight: '500',
    transition: 'background-color 0.2s ease',
    position: 'relative',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
  },
  primary: {
    backgroundColor: {
      $default: '#007bff',
      ':hover': '#0056b3',
      ':focus': '#0056b3',
      ':active': '#004085',
      '[disabled]': '#6c757d',
    },
    color: 'white',
    outline: {
      $default: 'none',
      ':focus': '2px solid #80bdff',
    },
    outlineOffset: '2px',
  },
  secondary: {
    backgroundColor: {
      $default: '#6c757d',
      ':hover': '#545b62',
      ':focus': '#545b62',
      ':active': '#3d4246',
      '[disabled]': '#adb5bd',
    },
    color: 'white',
    outline: {
      $default: 'none',
      ':focus': '2px solid #a8a8a8',
    },
    outlineOffset: '2px',
  },
  outline: {
    backgroundColor: {
      $default: 'transparent',
      ':hover': '#007bff',
      ':focus': '#007bff',
    },
    color: {
      $default: '#007bff',
      ':hover': 'white',
      ':focus': 'white',
    },
    border: '2px solid #007bff',
    outline: {
      $default: 'none',
      ':focus': '2px solid #80bdff',
    },
    outlineOffset: '2px',
  },
  loading: {
    cursor: 'not-allowed',
    pointerEvents: 'none',
    opacity: '0.7',
  },
  spinner: {
    width: '14px',
    height: '14px',
    border: '2px solid currentColor',
    borderBlockStartColor: 'transparent',
    borderRadius: '50%',
    animation: `${spin.id} 0.8s linear infinite`,
    display: 'inline-block',
  },
  icon: {
    padding: '8px',
    blockSize: '40px',
    inlineSize: '40px',
    borderRadius: '4px',
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  iconRound: {
    borderRadius: '50%',
  },
  iconSvg: {
    inlineSize: '20px',
    blockSize: '20px',
    fill: 'currentColor',
  },
})

// Export spinner keyframes for use in joinStyles
export const spinnerKeyframes = spin()
