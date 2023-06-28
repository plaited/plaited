/**
 * Converts a string to camel case.
 *
 * @remarks
 * This function will handle strings in various formats:
 * - Hyphen-separated (kebab-case)
 * - Underscore-separated (snake_case)
 * - Slash-separated 
 * - Space-separated (start case)
 * - Any combination of the above, with any number of consecutive separators
 *
 * @param str - The input string to convert
 * @returns The input string converted to camel case
 */
export const camelCase = (str: string) => {
  return str.replace(/[\s_/-]+(.)?/g, (_, group1) => {
    return group1 ? group1.toUpperCase() : ''
  }).replace(/^(.)/, (_, group1) => {
    return group1 ? group1.toLowerCase() : ''
  })
}

/**
 * Converts a string to kebab case.
 *
 * @remarks
 * This function will handle strings in various formats:
 * - CamelCase
 * - Underscore-separated (snake_case)
 * - Backslash-separated
 * - Space-separated (start case)
 * - Any combination of the above, with any number of consecutive separators
 *
 * @param str - The input string to convert
 * @returns The input string converted to kebab case
 */
export const kebabCase = (str: string) => {
  return str
    .replace(/([a-z0-9]|(?=[A-Z]))([A-Z])|[\s_/]+/g,'$1-$2')
    .replace(/-+/g, '-').replace(/^-/, '').toLowerCase()
}
