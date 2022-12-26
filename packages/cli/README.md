# @plaited/cli

This package exports numerous cli utilities necessary for the management of a design system developed using @plaited/framework.

## copy-css-util
This utility is for copying stylesheets to a desired directory.

Here is an example usage where we are copying the the tokens stylesheet from `@plaited/tokens` to our assets directory.
```ts
import path from 'path'
import { fileURLToPath } from 'url'
import { copyCssUtil } from '@plaited/cli'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
;(async () => {
  const assets = path.resolve(__dirname, '../assets')
  await copyCssUtil('@plaited/tokens', assets)
})()
```

## tiering-utility
This utility is for tiering or extends a plaited design system. When used with @plaited/components it provides a project setup for ones own design system. It provides three features: project setup, component ejection, and project update.

### Project setup
This feature will scaffold your design system repo for you with our recommended:
- yarn monorepo setup
- testing setup
- component workshop
- re-exports of @plaited/components

### Component ejection
This feature will lift a component from `@plaited/components` into your projects workspace where you can fork and modify it to meet your needs. Ejected components will use your configured component prefix.

### Project update
This feature will look at your re-export file and then update you to the latest version of @plaited/components and it's dependencies.

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
import { tokenSchemaUtil } from '@plaited/cli'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
;(async () => {
  const tokensFilePath = path.resolve(__dirname, '../src/tokens.json')
  const testDirectory = path.resolve(__dirname, '../tests')
  await tokenSchemaUtil(tokensFilePath, testDirectory)
})()
```

**Test your schema**
```ts
import test from 'ava'
import Ajv from 'ajv';
import { fileURLToPath } from 'url'

const ajv = new Ajv()
const schemaFilePath = path.resolve(__dirname, './tokens-schema.json')
const tokensFilePath = path.resolve(__dirname, '../src/tokens.json')

test('token schema', async t => {
  const { default: schema } = await import(
    schemaFilePath,
    { assert: { type: 'json' } }
  )
  const { default: tokens } = await import(
    tokensFilePath,
    { assert: { type: 'json' } }
  )
  const isValid = ajv.validate(schema, tokens)
   t.is(isValid, true);
})
```

## token-transform-util
This utility will transform a json file that adheres to the token format module into css and js assets to be used in component code. Output assets will be optimized as much as possible. Treeshaken with reduced redunancy in our JS output and global and necessary aliased variables in our css output. When used in concert with out @plaited/tokens-get postcss plugin you will get the best result.

## component-scaffold-util
This utility will scaffold a component using our recommended patterns for optimal development and testing when working with @plaited/island.


