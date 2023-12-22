# JSX

Plaited uses a custom JSX runtime to easily create component markup and styles. We designed it from the ground up to enable the following:

- Easily sharing styles between shadow DOMs and light DOMs
- Leveraging scoped css classes 
- Simple server side rending to reduce FOUC via the declarative shadow dom
- Auto defining child custom elements

Unlike most JSX libraries Plaited runtime is design for templating. This means that out createTemplate function aka H simply returns an object instead of a function like most JSX libraries.
```ts
export type TemplateObject = {
  client: string[]
  server: string[]
  stylesheets: Set<string>
  registry: Set<PlaitedComponentConstructor>
  $: '🦄'
}
```

This makes SSR easy and when we wish to dynamical change component sturcture and styles we do so with the plait method inside our plaited web components.


# Styling

As you can see see the Template object contains a strylsheets key and value of Set which is a set of deduplicated stylesheets. Our library makes it easy for you to style components. 

```tsx 
import { css } from 'plaited'

const { $stylesheet, ...cls } = css`
  .header{
    color: orange;
  }
`

<h1 stylesheet={$stylesheet} className={cls.header}>Hello!</h1>

```

Our JSX library hoist styles up to the closest parent shadow dom or to the body or head tag when sever rendered. 

This mean we can style, create our html, and apply interactivity in a single tsx file without the need for custom file type or external styling library. it doesn't really matter where you apply the stylesheet in the html structure as it will be hoisted in the Event when using a resuable Function Template like this

```tsx
import { FT, css } from 'plaited'
import { classNames } from 'plaited/utils'

const { $stylesheet, ...cls } = css`
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
    stylesheet={$stylesheet}
    value={value}
    style={backgroundColor ? { backgroundColor } : undefined}
  >
    {label}
  </button>
)
```

In the above we've created a resuable Button Template and our classnames helper combine css classes.

We can then use it in a Plaited web component like so

```tsx
import { Component, PlaitProps, css } from 'plaited'
import { Button } from './button.js'

const { $stylesheet, ...cls } = css`
  .storybook-header {
    font-family: 'Nunito Sans', 'Helvetica Neue', Helvetica, Arial, sans-serif;
    border-bottom: 1px solid rgba(0, 0, 0, 0.1);
    padding: 15px 20px;
    display: flex;
    align-items: center;
    justify-content: space-between;
  }

  .storybook-header svg {
    display: inline-block;
    vertical-align: top;
  }

  .storybook-header h1 {
    font-weight: 700;
    font-size: 20px;
    line-height: 1;
    margin: 6px 0 6px 10px;
    display: inline-block;
    vertical-align: top;
  }

  .storybook-header button + button {
    margin-left: 10px;
  }

  .storybook-header .welcome {
    color: #333;
    font-size: 14px;
    margin-right: 10px;
  }
`

export class Header extends Component({
  tag: 'header-el',
  template: (
    <header stylesheet={$stylesheet}>
      <div className={cls['storybook-header']}>
        <div>
          <svg
            width='32'
            height='32'
            viewBox='0 0 32 32'
            xmlns='http://www.w3.org/2000/svg'
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
          <h1>Acme</h1>
        </div>
        <div
          data-target='button-bar'
          data-trigger={{ click: 'click' }}
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
          />
        </div>
      </div>
    </header>
  ),
}) {...}
```

That we can then use in our the stylesheet from button will hoist into the shadow dom of our `header-el`.

Further we can also dynamically render out a button who's styles will be hoisted and applied to our custom elements shadow DOM

```tsx
class Button ba extends Component({
  tag: 'dynamic-only',
  template: <div data-target='target'></div>,
}) {
  plait({ $ }: PlaitProps) {
    const [target] = $<HTMLDivElement>('target')
    target.insert(
      'beforeend',
      <div
        stylesheet={$stylesheet}
        className={cls.noRepeat}
      >
        construable stylesheet applied once
      </div>,
    )
    target.insert(
      'beforeend',
      <div
        stylesheet={$stylesheet}
        className={cls.repeat}
      >
        not applied
      </div>,
    )
  }
}
```