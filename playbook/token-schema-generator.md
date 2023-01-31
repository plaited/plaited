# token-schema-generator

This codegen utility will generate a JSON schema that allows for the addition of
new tokens but locks the values of existing tokens. Think of it as a hybrid of
the traditional JSON schema and a snapshot from testing libraries like Jest and
Ava.

Example usage

**Build your schema**

```ts
import path from "path";
import { fileURLToPath } from "url";
import { tokenSchemaUtil } from "@plaited/tokens-cli";
import tokens from "./tokens.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
(async () => {
  const testDirectory = path.resolve(__dirname, "../tests");
  await tokenSchemaUtil(tokens, testDirectory);
})();
```

**Test your schema**

```ts
import test from "ava";
import Ajv from "ajv";
import { fileURLToPath } from "url";
import { importJson } from "@plaited/tokens-cli";
import tokens from "./tokens.js";
const ajv = new Ajv();

test("token schema", async (t) => {
  const schema = importJson(path.resolve(__dirname, "./tokens-schema.json"));
  const isValid = ajv.validate(schema, tokens);
  t.is(isValid, true);
});
```
