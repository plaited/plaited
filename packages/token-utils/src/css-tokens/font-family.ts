import { FontFamilyValue, Formatter } from "../types.js";
import { hasAlias } from "../resolve.js";
import { kebabCase } from "../../deps.js";

export const fontFamily: Formatter<FontFamilyValue> = (
  { tokenPath, $value },
) => {
  if (hasAlias($value)) return "";
  if (Array.isArray($value)) {
    const val = $value
      .map((font) => /\s/g.test(font) ? `"${font}"` : font)
      .join(",");
    return (
      `:root { --${kebabCase(tokenPath.join(" "))}: ${val}; }`
    );
  }
  return `:root { --${kebabCase(tokenPath.join(" "))}: ${
    /\s/g.test($value) ? `"${$value}"` : $value
  }; }`;
};
