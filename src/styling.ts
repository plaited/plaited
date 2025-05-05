/**
 * Plaited Styling System
 * A comprehensive solution for managing CSS styling, design tokens, and theming in Plaited applications.
 *
 * Key Features:
 * - Type-safe CSS-in-JS with scoped styles
 * - Design token management and transformation
 * - Custom elements for design token injection
 * - JSON schema validation for design tokens
 *
 * @example
 * CSS-in-JS Usage
 * ```ts
 * import { css } from 'plaited/styling'
 *
 * const styles = css.create({
 *   button: {
 *     backgroundColor: 'blue',
 *     ':hover': { backgroundColor: 'darkblue' }
 *   }
 * })
 *
 * const MyButton = () => <button {...styles.button}>Click me</button>
 * ```
 *
 * @example
 * Design Tokens Usage
 * ```ts
 * import {
 *   TransformDesignTokens,
 *   getDesignTokensElement,
 * } from 'plaited/styling'
 *
 * const tokens = new TransformDesignTokens({
 *   tokens: {
 *     colors: {
 *       primary: {
 *         $value: '#0066cc',
 *         $type: 'color'
 *       }
 *     }
 *   }
 * })
 *
 * const TokensElement = getDesignTokensElement(tokens.css)
 * ```
 *
 * @packageDocumentation
 *
 * @remarks
 * Exports:
 * - CSS system types and utilities ({@link css}, {@link CSSProperties}, etc.)
 * - Design token types and transformers ({@link TransformDesignTokens}, {@link DesignToken}, etc.)
 * - Token element creation ({@link getDesignTokensElement})
 * - Schema validation ({@link getDesignTokensSchema})
 */

export type * from './styling/css.types.js'
export * from './styling/css.js'
export type * from './styling/design-token.types.js'
export * from './styling/get-design-tokens-element.js'
export * from './styling/get-design-tokens-schema.js'
export * from './styling/transform-design-tokens.js'
