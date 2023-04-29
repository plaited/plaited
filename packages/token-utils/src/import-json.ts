export const importJson = async <T = Record<string, never>>(
  filePath: string,
): Promise<T> => {
  const { default: obj } = await import(
    filePath,
    { assert: { type: "json" } }
  );
  return obj;
};
