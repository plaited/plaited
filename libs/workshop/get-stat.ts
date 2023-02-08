export const getStat = async (
  filePath: string,
): Promise<false | Deno.FileInfo> => {
  try {
    const entry = await Deno.stat(filePath)
    return entry
  } catch (error) {
    if (error instanceof Deno.errors.NotFound) {
      return false
    }
    throw error
  }
}
