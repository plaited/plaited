# @plaited/css

This package exports utility functions necessary styling plaited interfaces.
This package when minified by esbuild comes in at 25.8kb

## classNames

A simple utility to apply & join class names conditionally inline on a node.

Example

```ts
import { classNames } from "@plaited/css";
const conditionTrue = true;
const conditionFalse = false;
classNames(
  "class-1",
  conditionFalse && "class-2",
  conditionTrue && "class-3",
); // => 'class-1 class-3'
```

## tokens

A simple utility to conditionally apply & join tokens inline on a node or using
our css utility

Example

```ts
import { tokens } from "@plaited/css";

const checked = false;
const disabled = true;
const expected = {
  "--width": 32,
  "--height": 24,
  "--backgroundColor": "grey",
};
const actual = tokens(
  {
    width: 32,
    height: 24,
    backgroundColor: "black",
  },
  checked && {
    backgroundColor: "blue",
  },
  disabled && {
    backgroundColor: "grey",
  },
);
/**
 * => {
    '--width': 32,
    '--height': 24,
    '--backgroundColor': 'grey',
  }
*/
```

## css

Is a custom instance of
[JJS](https://cssinjs.org/jss-api?v=v10.9.2#create-an-own-jss-instance). It
returns both a stylesheet and classnames. This custom instance makes use of the
following jss plugins.
[nested](https://cssinjs.org/jss-plugin-nested?v=v10.9.2),
[global](https://cssinjs.org/jss-plugin-global?v=v10.9.2), and
[camelCase](https://cssinjs.org/jss-plugin-camel-case?v=v10.9.2)

Example

```ts
import { css } from "@plaited/css";
import { colorBlue50, colorGrey10 } from "@your/tokens";

css({
  button: {
    backgroundColor: colorBlue50,
    "&:disabled": {
      backgroundColor: colorGrey10,
    },
  },
});
/**
 *  => {
 *    styles: {
        button: 'button-0-1-1',
      },
      stylesheet: `.button-0-1-1 {␊
          background-color: var(--color-blue-50);␊
        }␊
        .button-0-1-1:disabled {␊
          background-color: var(--color-grey-10);␊
        }
      `
 * }
*/
```

## cssVars

Quickly get a css custom property value from the DOM or reset it using this
utility function.

```ts
import { cssVars } from "@plaited/css";
import { colorRed1 /* colorRed1 = var(--color-red-1) */ } from "@your/tokens";

//Get value from DOM
cssVar(colorRed1); // => #f33e3e
// Set value on DOM
cssVar(colorRed1, #e91212); // => #e91212
// Works with --case too
cssVar("--color-red-1"); // => #e91212
// Reset to original value on DOM
cssVar("--color-red-1", #f33e3e); // => #f33e3e
```
