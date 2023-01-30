# token-transformer

This utility will transform a tokens object of type DesignTokensGroup that
adheres to the token-schema-util format into css and ts assets to be used in
component code. Output assets will be optimized as much as possible. Treeshaken
with reduced redundancy in our TS output and global and necessary aliased
variables in our CSS output. Best results are achieved when this utility is
paired with the @plaited/tokens-get postcss plugin.

**Transform tokens**

```ts
import path from "path";
import { fileURLToPath } from "url";
import { tokenSchemaUtil } from "@plaited/tokens-cli";
import tokens from "./tokens.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const outPutDirectory = path.resolve(__dirname, "../dist");
(async () => {
  await tokenTransformUtil = async({
    tokens,
    outputDirectory,
    baseFontSize: 10, // default to 20,
  });
})();
```
