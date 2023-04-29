import { AliasValue, DropShadowValue, Formatter } from "../types.js";
import { hasAlias, resolveCSSVar } from "../resolve.js";
import { kebabCase } from "../../deps.js";

export const dropShadow: Formatter<DropShadowValue> = (
  { tokenPath, $value, allTokens },
) => {
  if (hasAlias($value)) return "";
  const { offsetX, offsetY, blur, color } = $value as Exclude<
    DropShadowValue,
    AliasValue
  >;
  const val = [
    offsetX,
    offsetY,
    blur,
    color && hasAlias(color) ? resolveCSSVar(color, allTokens) : color,
  ].filter(Boolean);
  return `:root { --${kebabCase(tokenPath.join(" "))}:drop-shadow(${
    val.join(" ")
  }); }`;
};
