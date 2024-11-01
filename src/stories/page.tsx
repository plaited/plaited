import { css, defineTemplate, type PlaitedElement } from 'plaited'
import { Header } from './header.js'

const styles = css.create({
  h2: {
    fontWeight: 700,
    fontSize: '32px',
    lineHeight: 1,
    margin: '0 0 4px',
    display: 'inline-block',
    verticalAlign: 'top',
  },
  p: {
    margin: '1em 0',
  },
  a: {
    textDecoration: 'none',
    color: '#1ea7fd',
  },
  ul: {
    paddingLeft: '30px',
    margin: '1em 0',
  },
  li: {
    marginBottom: '8px',
  },
  tip: {
    display: 'inline-block',
    borderRadius: '1em',
    fontSize: '11px',
    lineHeight: '12px',
    fontWeight: 700,
    background: '#e7fdd8',
    color: '#66bf3c',
    padding: '4px 12px',
    marginRight: '10px',
    verticalAlign: 'top',
  },
  tipWrapper: {
    fontSize: '13px',
    lineHeight: '20px',
    marginTop: '40px',
    marginBottom: '40px',
  },
  tipSvg: {
    display: 'inline-block',
    height: '12px',
    width: '12px',
    marginRight: '4px',
    verticalAlign: 'top',
    marginTop: '3px',
  },
  tipSvgPath: {
    fill: '#1ea7fd',
  },
})

const hostStyles = css.host({
  fontFamily: "'Nunito Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif",
  fontSize: '14px',
  lineHeight: '24px',
  padding: '48px 20px',
  margin: '0 auto',
  maxWidth: '600px',
  color: '#333',
})
const shadowDom = (
  <article {...hostStyles}>
    <Header
      p-target='header'
      p-trigger={{
        onLogin: 'onLogin',
        onLogout: 'onLogout',
        onCreateAccount: 'onCreateAccount',
      }}
    />

    <section className='storybook-page'>
      <h2 {...styles.h2}>Pages in Storybook</h2>
      <p {...styles.p}>
        We recommend building UIs with a{' '}
        <a
          href='https://componentdriven.org'
          target='_blank'
          rel='noopener noreferrer'
          {...styles.a}
        >
          <strong>component-driven</strong>
        </a>{' '}
        process starting with atomic components and ending with pages.
      </p>
      <p {...styles.p}>
        Render pages with mock data. This makes it easy to build and review page states without needing to navigate to
        them in your app. Here are some handy patterns for managing page data in Storybook:
      </p>
      <ul {...styles.ul}>
        <li {...styles.li}>
          Use a higher-level connected component. Storybook helps you compose such data from the "args" of child
          component stories
        </li>
        <li {...styles.li}>
          Assemble data in the page component from your services. You can mock these services out using Storybook.
        </li>
      </ul>
      <p {...styles.p}>
        Get a guided tutorial on component-driven development at{' '}
        <a
          href='https://storybook.js.org/tutorials/'
          target='_blank'
          rel='noopener noreferrer'
          {...styles.a}
        >
          Storybook tutorials
        </a>
        . Read more in the{' '}
        <a
          href='https://storybook.js.org/docs'
          target='_blank'
          rel='noopener noreferrer'
          {...styles.a}
        >
          docs
        </a>
        .
      </p>
      <div {...styles.tipWrapper}>
        <span {...styles.tip}>Tip</span> Adjust the width of the canvas with the{' '}
        <svg
          width='10'
          height='10'
          viewBox='0 0 12 12'
          {...styles.tipSvg}
        >
          <g
            fill='none'
            fillRule='evenodd'
          >
            <path
              d='M1.5 5.2h4.8c.3 0 .5.2.5.4v5.1c-.1.2-.3.3-.4.3H1.4a.5.5 0 01-.5-.4V5.7c0-.3.2-.5.5-.5zm0-2.1h6.9c.3 0 .5.2.5.4v7a.5.5 0 01-1 0V4H1.5a.5.5 0 010-1zm0-2.1h9c.3 0 .5.2.5.4v9.1a.5.5 0 01-1 0V2H1.5a.5.5 0 010-1zm4.3 5.2H2V10h3.8V6.2z'
              id='a'
              {...styles.tipSvgPath}
            />
          </g>
        </svg>
        Viewports addon in the toolbar
      </div>
    </section>
  </article>
)

export const Page = defineTemplate({
  tag: 'page-el',
  shadowDom,
  bProgram({ $ }) {
    const [header] = $<PlaitedElement>('header')
    return {
      onLogin() {
        header.attr('user', 'Jane Doe')
      },
      onLogout() {
        header.attr('user', null)
      },
      onCreateAccount() {
        header.attr('user', 'Jane Doe')
      },
    }
  },
})
