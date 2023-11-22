import { css, FT } from 'plaited'
import { classNames } from 'plaited/utils'

const [cls, stylesheet] = css`
  .storybook-button {
    font-family: 'Nunito Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    font-weight: 700;
    border: 0;
    border-radius: 3em;
    cursor: pointer;
    display: inline-block;
    line-height: 1;
  }
  .storybook-button--primary {
    color: white;
    background-color: #1ea7fd;
  }
  .storybook-button--secondary {
    color: #333;
    background-color: transparent;
    box-shadow: rgba(0, 0, 0, 0.15) 0px 0px 0px 1px inset;
  }
  .storybook-button--small {
    font-size: 12px;
    padding: 10px 16px;
  }
  .storybook-button--medium {
    font-size: 14px;
    padding: 11px 20px;
  }
  .storybook-button--large {
    font-size: 16px;
    padding: 12px 24px;
  }
`

export const Button: FT<{
  label?: string
  size?: 'small' | 'medium' | 'large'
  backgroundColor?: string
  primary?: boolean
  value?: string
}> = ({ label, size = 'medium', backgroundColor, primary = false, value, ...rest }) => (
  <button
    {...rest}
    type='button'
    className={classNames(
      cls['storybook-button'],
      cls[`storybook-button--${size}`],
      cls[primary ? 'storybook-button--primary' : 'storybook-button--secondary'],
    )}
    {...stylesheet}
    value={value}
    style={{ backgroundColor }}
  >
    {label}
  </button>
)
