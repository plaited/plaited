# @plaited/miles

This styling library is designed to work with plaited's approach to creating elemments, templates and design tokens for your frontend. It shiop three utility functions.

## classNames 
a simple utilioty to join class names condiionally.

Example
```ts
import { classNames } from '@plaited/miles'
const conditionTrue = true
const conditionFalse = false
 classNames(
  'class-1',
  conditionFalse && 'class-2',
  conditionTrue && 'class-3'
) // => 'class-1 class-3'
```

## tokens
A simple utility to rapidly apply tokens inline on a node or using our css utility


Example
```ts
import { tokens } from '@plaited/miles'

const checked = false
const disabled = true
const expected = {
  '--width': 32,
  '--height': 24,
  '--backgroundColor': 'grey',
}
const actual = tokens(
  {
    width: 32,
    height: 24,
    backgroundColor: 'black',
  },
  checked && {
    backgroundColor: 'blue',
  },
  disabled && {
    backgroundColor: 'grey',
  }
) 
/**
 * => {
    '--width': 32,
    '--height': 24,
    '--backgroundColor': 'grey',
  }
*/

```

## css
Is a custom instance of [JJS](https://cssinjs.org/jss-api?v=v10.9.2#create-an-own-jss-instance). It returns both a style sheet and the classnames. This cusrom instance makes use of the following jss plugins. [nested](https://cssinjs.org/jss-plugin-nested?v=v10.9.2), [global](https://cssinjs.org/jss-plugin-global?v=v10.9.2), and [camelCase](https://cssinjs.org/jss-plugin-camel-case?v=v10.9.2)

Example
```ts
import { css } from '@plaited/miles'

css({
  button: {
    backgroundColor: 'var(--background-color)',
    '&:disabled': {
      backgroundColor: 'var(--background-color-disabled)',
    },
  },
})
/**
 *  => {
 *    styles: {
        button: 'button-0-1-1',
      },
      stylesheet: `.button-0-1-1 {␊
        background-color: var(--background-color);␊
      }␊
      .button-0-1-1:disabled {␊
        background-color: var(--background-color-disabled);␊
      }`
 * }
*/
```

