# [WIP] @plaited/tokens-cli

This package exports tokens cli utilities necessary for the management of a design system developed using @plaited/framework.

## token-get
This post css plugin allows you to safely get token values from tokens transformed into CSS custom properties using out token-transform-util. It will either return back a css custom property or a mixin for tokens types: typography, grid, and flex.

### Example usage of return a CSS custom property

**Input**
```css
.a {
  --background-color: token(action, primary, rest, background-color);
  background-color: var(--background-color);
}
```
**Output**
```css
.a {
  --background-color: var(--background-color-purple-2);
  background-color: var(--background-color);
}
```

### Example nested mixin usage

**Input**
```css
.a {
  &token(action, primary, rest, typography)
}
```
**Output**
```css
.a {
  --font-family: var(--font-family-sans-serif);
  --font-size: var(--font-size-1);
  --font-weight: var(--font-weight-1);
  --letter-spacing: var(--letter-spacing-1);
  --line-height: var(--line-height-1);
  font-family: var(--font-family);
  font-size: var(--font-size);
  font-weight: var(--font-weight);
  letter-spacing: var(--letter-spacing);
  line-height: var(--line-height);
}
```

## token-schema-util
This codegen utility will generate a JSON schema that allows for the addition of new tokens but locks the values of existing tokens. Think of it as a hybrid of the traditional JSON schema and a snapshot from testing libraries like Jest and Ava.

Example usage

**Build your schema**
```ts
import path from 'path'
import { fileURLToPath } from 'url'
import { tokenSchemaUtil } from '@plaited/tokens-cli'
import tokens from './tokens.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
;(async () => {
  const testDirectory = path.resolve(__dirname, '../tests')
  await tokenSchemaUtil(tokens, testDirectory)
})()
```

**Test your schema**
```ts
import test from 'ava'
import Ajv from 'ajv';
import { fileURLToPath } from 'url'
import { importJson } from '@plaited/tokens-cli'
import tokens from './tokens.js'
const ajv = new Ajv()

test('token schema', async t => {
  const schema = importJson(path.resolve(__dirname, './tokens-schema.json'))
  const isValid = ajv.validate(schema, tokens)
   t.is(isValid, true);
})
```

## token-transform-util
This utility will transform a tokens object of type DesignTokensGroup that adheres to the token format module into css and ts assets to be used in component code. Output assets will be optimized as much as possible. Treeshaken with reduced redundancy in our TS output and global and necessary aliased variables in our CSS output. When used in concert with out @plaited/tokens-get postcss plugin you will get the best result.

**Transform tokens**
```ts
import path from 'path'
import { fileURLToPath } from 'url'
import { tokenSchemaUtil } from '@plaited/tokens-cli'
import tokens from './tokens.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const  outPutDirectory = path.resolve(__dirname, '../dist')

;(async () => {
  await tokenTransformUtil = async ({
    tokens,
    outputDirectory,
    baseFontSize: 10 // default to 20,
  })
})()
```


