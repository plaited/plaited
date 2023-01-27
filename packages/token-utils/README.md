# [WIP] @plaited/token-utils
This package exports cli utilities necessary for the management of a design systems developed using @plaited/framework.

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
This utility will transform a tokens object of type DesignTokensGroup that adheres to the token-schema-util format into css and ts assets to be used in component code. Output assets will be optimized as much as possible. Treeshaken with reduced redundancy in our TS output and global and necessary aliased variables in our CSS output. Best results are achieved when this utility is paired with the @plaited/tokens-get postcss plugin.

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


