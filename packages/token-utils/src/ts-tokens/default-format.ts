import { AliasValue, Formatter } from "../types.js";
import { hasAlias, resolveTSVar } from "../resolve.js";
import { camelCase, kebabCase } from "../../deps.js";

export const defaultFormat: Formatter = ({
  tokenPath,
  $value,
  allTokens,
}) => {
  const val = hasAlias($value)
    ? resolveTSVar($value as AliasValue, allTokens)
    : `'var(--${kebabCase(tokenPath.join(" "))})'`;
  return `export const ${camelCase(tokenPath.join(" "))} = ${val}`;
};
