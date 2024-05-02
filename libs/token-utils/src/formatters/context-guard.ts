import {
  ContextTypes,
  Contexts,
  DesignToken,
  StaticToken,
  ContextualToken,
  BaseToken,
  DesignValue,
} from "../types.js";

export const isValidContext = ({
  ctx,
  contexts: { colorSchemes, mediaQueries },
}: {
  ctx: { type: ContextTypes; id: string };
  contexts: Contexts;
}) => {
  const { type, id } = ctx;
  const obj =
    type === "color-scheme"
      ? colorSchemes
      : type === "media-query"
        ? mediaQueries
        : "invalid context type";
  if (typeof obj === "string") {
    console.error(`Context type [${type}] is an ${obj}`);
    return false;
  }
  if (!Object.hasOwn(obj, id)) {
    const context = type === "color-scheme" ? `colorSchemes` : `mediaQueries`;
    console.error(`[${id}] not found in ${context}`);
    return false;
  }
  return true;
};

export const isContextualToken = <U extends DesignToken, V extends DesignValue>(
  token: BaseToken<U["$type"], V>
): token is ContextualToken<U["$type"], V> => {
  if (!token?.$extensions) return false;
  const { "plaited-context": $context } = token.$extensions;
  return $context !== undefined;
};

export const isStaticToken = <U extends DesignToken, V extends DesignValue>(
  token: BaseToken<U["$type"], V>
): token is StaticToken<U["$type"], V> => {
  if (!token?.$extensions) return true;
  const { "plaited-context": $context } = token.$extensions;
  return $context === undefined;
};