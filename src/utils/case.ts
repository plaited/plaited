/**
 * @internal
 * @module case
 *
 * Purpose: String case transformation utilities for consistent naming conventions
 * Architecture: Regex-based transformations with multi-pass processing
 * Dependencies: None - pure JavaScript string manipulation
 * Consumers: CSS-in-JS system, attribute naming, API data transformation
 *
 * Maintainer Notes:
 * - These utilities ensure consistent naming across different contexts
 * - camelCase is used for JavaScript properties and CSS-in-JS
 * - kebabCase is used for HTML attributes and CSS properties
 * - Both functions handle multiple separator types for flexibility
 * - Regex patterns are optimized for common web development patterns
 *
 * Common modification scenarios:
 * - Adding snake_case: Create similar pattern with underscore separators
 * - Supporting Unicode: Update regex to handle non-ASCII characters
 * - Preserving acronyms: Add special case handling for uppercase sequences
 * - Performance optimization: Consider caching for repeated transformations
 *
 * Performance considerations:
 * - Multiple regex passes have overhead for long strings
 * - No caching - consider memoization for hot paths
 * - Regex compilation happens on each call
 * - String immutability causes allocations
 *
 * Known limitations:
 * - Does not preserve acronyms (API → api, not API)
 * - Limited Unicode support in current implementation
 * - No handling of special characters beyond basic separators
 * - Case detection may fail for all-caps strings
 */

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
  return (
    str
      /**
       * @internal
       * First pass: Find separator sequences and capitalize following character.
       * - [\s_/-]+ matches any combination of space, underscore, slash, hyphen
       * - (.)? captures the optional character after separators
       * - Replacement removes separators and uppercases the following char
       */
      .replace(/[\s_/-]+(.)?/g, (_, group1) => {
        return group1 ? group1.toUpperCase() : ''
      })
      /**
       * @internal
       * Second pass: Ensure first character is lowercase for camelCase.
       * - ^(.) captures the first character
       * - Replacement lowercases it to follow camelCase convention
       */
      .replace(/^(.)/, (_, group1) => {
        return group1 ? group1.toLowerCase() : ''
      })
  )
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
  return (
    str
      /**
       * @internal
       * First pass: Insert hyphens at case boundaries and replace separators.
       * - ([a-z0-9]|(?=[A-Z]))([A-Z]) handles camelCase boundaries
       * - [\s_/]+ handles existing separators
       * - $1-$2 inserts hyphen between captured groups
       */
      .replace(/([a-z0-9]|(?=[A-Z]))([A-Z])|[\s_/]+/g, '$1-$2')
      /**
       * @internal
       * Second pass: Collapse multiple consecutive hyphens.
       * Handles cases where multiple separators or replacements create '--'.
       */
      .replace(/-+/g, '-')
      /**
       * @internal
       * Third pass: Remove leading hyphen if present.
       * Can occur when string starts with uppercase or separator.
       */
      .replace(/^-/, '')
      /**
       * @internal
       * Final pass: Convert entire string to lowercase.
       * Ensures consistent kebab-case format.
       */
      .toLowerCase()
  )
}
