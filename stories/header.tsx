import { defineTemplate, css, useQuery } from 'plaited'
import { Button } from './button.js'

const styles = css.create({
  storybookHeader: {
    fontFamily: "'Nunito Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif",
    borderBottom: '1px solid rgba(0, 0, 0, 0.1)',
    padding: '15px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  storybookHeaderSvg: {
    display: 'inline-block',
    verticalAlign: 'top',
  },
  storybookHeaderH1: {
    fontWeight: 700,
    fontSize: '20px',
    lineHeight: 1,
    margin: '6px 0 6px 10px',
    display: 'inline-block',
    verticalAlign: 'top',
  },
  storybookHeaderButtonPlusButton: {
    marginLeft: '10px',
  },
  storybookHeaderWelcome: {
    color: '#333',
    fontSize: '14px',
    marginRight: '10px',
  },
})

export const Header = defineTemplate({
  tag: 'header-el',
  shadowDom: (
    <header {...styles.storybookHeader}>
      <div className='storybook-header'>
        <div>
          <svg
            width='32'
            height='32'
            viewBox='0 0 32 32'
            xmlns='http://www.w3.org/2000/svg'
            {...styles.storybookHeaderSvg}
          >
            <g
              fill='none'
              fillRule='evenodd'
            >
              <path
                d='M10 0h12a10 10 0 0110 10v12a10 10 0 01-10 10H10A10 10 0 010 22V10A10 10 0 0110 0z'
                fill='#FFF'
              />
              <path
                d='M5.3 10.6l10.4 6v11.1l-10.4-6v-11zm11.4-6.2l9.7 5.5-9.7 5.6V4.4z'
                fill='#555AB9'
              />
              <path
                d='M27.2 10.6v11.2l-10.5 6V16.5l10.5-6zM15.7 4.4v11L6 10l9.7-5.5z'
                fill='#91BAF8'
              />
            </g>
          </svg>
          <h1 {...styles.storybookHeaderH1}>Acme</h1>
        </div>
        <div
          p-target='button-bar'
          p-trigger={{ click: 'click' }}
        >
          <Button
            size='small'
            value='onLogin'
            label='Log in'
          />
          <Button
            primary
            size='small'
            value='onCreateAccount'
            label='Sign up'
            {...styles.storybookHeaderButtonPlusButton}
          />
        </div>
      </div>
    </header>
  ),
  observedAttributes: ['user'],
  publicEvents: ['user'],
  attributeChangedCallback(name: string, _, newValue: string) {
    const $ = useQuery(this.shadowRoot)
    if (name === 'user') {
      const [bar] = $('button-bar')
      newValue ?
        bar.render(
          <>
            <span {...styles.storybookHeaderWelcome}>
              Welcome, <b>{newValue}</b>!
            </span>
            <Button
              size='small'
              value='onLogout'
              label='Log out'
            />
          </>,
        )
      : bar.render(
          <>
            <Button
              size='small'
              value='onLogin'
              label='Log in'
            />
            <Button
              primary
              size='small'
              value='onCreateAccount'
              label='Sign up'
              {...styles.storybookHeaderButtonPlusButton}
            />
          </>,
        )
    }
  },
  connectedCallback({ host }) {
    return {
      click(e: MouseEvent & { target: HTMLButtonElement }) {
        const value = e.target.value
        host.dispatchEvent(new CustomEvent(value, { bubbles: true }))
      },
    }
  },
})
