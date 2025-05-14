/**
 * Converts a string to camel case format (e.g., 'helloWorld').
 *
 * @remarks
 * This function handles strings in various formats and normalizes them to camel case:
 * - Hyphen-separated (kebab-case) → camelCase
 *   'my-variable' → 'myVariable'
 * - Underscore-separated (snake_case) → camelCase
 *   'my_variable' → 'myVariable'
 * - Slash-separated → camelCase
 *   'my/variable' → 'myVariable'
 * - Space-separated (start case) → camelCase
 *   'my variable' → 'myVariable'
 * - Mixed separators → camelCase
 *   'my--_  variable' → 'myVariable'
 *
 * @param str - The input string to convert to camel case
 * @returns The converted string in camel case format
 *
 * @example
 * Basic Usage
 * ```ts
 * camelCase('hello-world')     // returns 'helloWorld'
 * camelCase('hello_world')     // returns 'helloWorld'
 * camelCase('hello world')     // returns 'helloWorld'
 * camelCase('hello/world')     // returns 'helloWorld'
 * ```
 *
 * @example
 * Edge Cases
 * ```ts
 * camelCase('hello---world')   // returns 'helloWorld'
 * camelCase('hello_/world')    // returns 'helloWorld'
 * camelCase('HELLO WORLD')     // returns 'helloWorld'
 * camelCase('')               // returns ''
 * ```
 */
export const camelCase = (str: string) => {
  return str
    .replace(/[\s_/-]+(.)?/g, (_, group1) => {
      return group1 ? group1.toUpperCase() : ''
    })
    .replace(/^(.)/, (_, group1) => {
      return group1 ? group1.toLowerCase() : ''
    })
}

/**
 * Converts a string to kebab case format (e.g., 'hello-world').
 *
 * @remarks
 * This function handles strings in various formats and normalizes them to kebab case:
 * - CamelCase → kebab-case
 *   'myVariable' → 'my-variable'
 * - Underscore-separated (snake_case) → kebab-case
 *   'my_variable' → 'my-variable'
 * - Backslash-separated → kebab-case
 *   'my/variable' → 'my-variable'
 * - Space-separated (start case) → kebab-case
 *   'My Variable' → 'my-variable'
 * - Mixed formats → kebab-case
 *   'myBig_VARIABLE' → 'my-big-variable'
 *
 * @param str - The input string to convert to kebab case
 * @returns The converted string in kebab case format
 *
 * @example
 * Basic Usage
 * ```ts
 * kebabCase('helloWorld')      // returns 'hello-world'
 * kebabCase('hello_world')     // returns 'hello-world'
 * kebabCase('Hello World')     // returns 'hello-world'
 * kebabCase('hello/world')     // returns 'hello-world'
 * ```
 *
 * @example
 * Complex Cases
 * ```ts
 * kebabCase('myBigVariable')   // returns 'my-big-variable'
 * kebabCase('API_KEY_NAME')    // returns 'api-key-name'
 * kebabCase('hello///world')   // returns 'hello-world'
 * kebabCase('mix_CASE_test')   // returns 'mix-case-test'
 * ```
 *
 * @example
 * Edge Cases
 * ```ts
 * kebabCase('')               // returns ''
 * kebabCase('___')           // returns ''
 * kebabCase('already-kebab') // returns 'already-kebab'
 * ```
 */
export const kebabCase = (str: string) => {
  return str
    .replace(/([a-z0-9]|(?=[A-Z]))([A-Z])|[\s_/]+/g, '$1-$2')
    .replace(/-+/g, '-')
    .replace(/^-/, '')
    .toLowerCase()
}
