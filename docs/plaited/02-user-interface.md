# User Interface

We need to make an interface for our for our game. We'll use `X` and `O` markers and a `board`.

## Components

Our Markers are built using our custom JSX transform which can be used by adding the following to you tsconfig.json or jsconfig.json. This will allow bundlers, bun, deno, and tsc to properly transpile our code.

```json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "plaited"
  },
}
```

Plaited also comes with a purpose designed CSS solution which allows for perfomant sharing of styles between our FunctionTemplate(s) and PlaitedTemplate(s). When using this library our styles are hoisted up to the nearest web component's shadow DOM, de-duplicated and then applied via constructable stylesheet(s).

### The Board

The game board has 9 squares. For the purposes of an accessible game board we will style each square in the UI as buttons and group all squares inside a board element with the `role="group"`.

```ts
import { FunctionTemplate, css } from "plaited"

const { $stylesheet, ...cls } = css`
  .board {
    display: inline-grid;
    grid-template-columns: repeat(3, 1fr);
    grid-template-rows: repeat(3, 1fr);
  }
  .square {
    all: unset;
    width: 44px;
    height: 44px;
    box-sizing: border-box;
    border: 1px solid transparent;
    display: flex;
    justify-content: center;
    align-items: center;
    cursor: pointer;
    border-right: 1px solid black;
    border-bottom: 1px solid black;

    &:nth-child(-n + 3) {
      border-top: 1px solid black;
    }

    &:nth-child(3n + 1) {
      border-left: 1px solid black;
    }
  }
`

export const BoardMarker: FunctionTemplate = () => (
  <div
    role="group"
    aria-label='board'
    className={cls.board}
    stylesheet={$stylesheet}
  >
    {Array.from(Array(9).keys()).map((n) => (
      <button
        className={cls.square}
        value={n}
        p-trigger={{ click: 'click' }}
        p-target={`${n}`}
      ></button>
    ))}
  </div>    
)
```

### X Marker

Our X marker must be append to the board. We've given it some simple styles.

```ts
import { FunctionTemplate, css } from "plaited"

const { $stylesheet, ...cls } = css`
  .x {
    width: 20px;
    height: 20px;
    color: #A9D9D0
  }
`

export const XMarker: FunctionTemplate = () => (
    <svg
      className={cls.x}
      stylesheet={$stylesheet}
      viewBox="0 0 21 21"
      fill="none"
    >
      <path d="M16 0.900002C16.5 0.400002 17.1 0.200001 17.8 0.200001C19.2 0.200001 20.3 1.3 20.3 2.7C20.3 3.4 20 4 19.6 4.5L13.8 10.2L19.4 15.8L19.5 15.9C20 16.4 20.2 17 20.2 17.7C20.2 19.1 19.1 20.2 17.7 20.2C17 20.2 16.4 19.9 15.9 19.5L15.8 19.4L15.7 19.3L10.1 13.7L4.4 19.4C3.9 19.9 3.3 20.1 2.6 20.1C1.2 20.1 0.0999985 19 0.0999985 17.6C0.0999985 16.9 0.399995 16.3 0.799995 15.8L6.5 10.1L0.900002 4.5L0.699997 4.3C0.199997 3.9 0 3.2 0 2.5C0 1.1 1.1 0 2.5 0C3.2 0 3.8 0.300001 4.3 0.700001L4.4 0.799999L10.1 6.4L16 0.900002Z" fill="currentColor"/>
    </svg>
  )
```

### O Marker

Our O marker must also be append to the board and given some styles.

```ts
import { FunctionTemplate, css } from "plaited"

const { $stylesheet, ...cls } = css`
  .o {
    width: 20px;
    height: 20px;
    color: #F2E7DC
  }
`

export const OMarker: FunctionTemplate = () => (
  <svg
    className={cls.o}
    stylesheet={$stylesheet}
    viewBox="0 0 20 20"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path d="M0 10C0 15.5 4.5 20 10 20C15.5 20 20 15.5 20 10C20 4.5 15.5 0 10 0C4.5 0 0 4.4 0 10ZM15 10C15 12.8 12.8 15 10 15C7.2 15 5 12.8 5 10C5 7.2 7.2 5 10 5C12.8 5 15 7.2 15 10Z" fill="currentColor"/>
  </svg>
)
```

Next we'll put it all together.
