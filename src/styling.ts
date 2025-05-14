/**
 * Plaited Styling System
 *
 * A comprehensive toolkit for managing CSS styling, design tokens, and theming in web applications
 * built with Plaited. Combines the best practices of CSS-in-JS with design systems methodology.
 *
 * ## Core Components
 *
 * - **CSS-in-JS Engine**: Type-safe styling with scoped class names and automatic style injection
 * - **Design Token System**: Transform design tokens into CSS variables and TypeScript constants
 * - **Component Primitives**: Custom elements for design token management and style encapsulation
 * - **Schema Validation**: JSON schema generation for validating design token structures
 *
 * ## Key Benefits
 *
 * - **Type Safety**: Full TypeScript integration with autocompletion for CSS properties
 * - **Style Encapsulation**: Automatic scoping prevents style conflicts
 * - **Performance**: Optimized rendering with minimal style recalculation
 * - **Design System Support**: First-class support for design tokens and theming
 * - **Developer Experience**: Familiar CSS syntax with modern features like nesting
 *
 * @example
 * ### CSS-in-JS with Responsive Design
 * ```tsx
 * import { css } from 'plaited/styling'
 *
 * // Create responsive styles with media queries and pseudo-classes
 * const styles = css.create({
 *   card: {
 *     padding: {
 *       default: '1rem',
 *       '@media (min-width: 768px)': '2rem'
 *     },
 *     borderRadius: '4px',
 *     boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
 *     transition: 'transform 0.2s ease',
 *     transform: {
 *       default: 'translateY(0)',
 *       ':hover': {
 *         '@media (hover: hover)': 'translateY(-4px)'
 *       }
 *     }
 *   }
 * })
 *
 * // Apply styles to elements using spread syntax
 * const Card = ({children}) => <div {...styles.card}>{children}</div>
 * ```
 *
 * @example
 * ### Design Token Management
 * ```tsx
 * import { TransformDesignTokens, getDesignTokensElement } from 'plaited/styling'
 *
 * // Define design tokens
 * const tokens = new TransformDesignTokens({
 *   tokens: {
 *     colors: {
 *       primary: {
 *         $value: '#0066cc',
 *         $type: 'color',
 *         $description: 'Primary brand color'
 *       },
 *       text: {
 *         $value: {
 *           '@light': '#333333',
 *           '@dark': '#ffffff'
 *         },
 *         $type: 'color',
 *         $description: 'Main text color with dark/light variants'
 *       }
 *     },
 *     space: {
 *       small: { $value: '0.5rem', $type: 'size' },
 *       medium: { $value: '1rem', $type: 'size' },
 *       large: { $value: '2rem', $type: 'size' }
 *     }
 *   },
 *   tokenPrefix: 'brand'
 * })
 *
 * // Create a custom element that injects design tokens into your app
 * const BrandTokens = getDesignTokensElement(tokens.css, 'brand-tokens')
 *
 * // Use generated TypeScript constants
 * console.log(tokens.ts)
 * // -> export const colorsPrimary = "--brand-colors-primary" as const;
 *
 * // Use in your app root
 * const App = () => (
 *   <BrandTokens>
 *     <MainContent />
 *   </BrandTokens>
 * )
 * ```
 *
 * @example
 * ### Animations and Complex Styling
 * ```tsx
 * import { css } from 'plaited/styling'
 *
 * // Define keyframe animations
 * const fadeIn = css.keyframes('fadeIn', {
 *   from: { opacity: 0 },
 *   to: { opacity: 1 }
 * })
 *
 * // Style component host in shadow DOM
 * const hostStyles = css.host({
 *   display: 'block',
 *   margin: '0 auto',
 *   maxWidth: {
 *     default: '100%',
 *     '[data-size="compact"]': '600px',
 *     '[data-size="wide"]': '1200px'
 *   }
 * })
 *
 * // Combine multiple style objects
 * const combinedStyles = css.assign(
 *   styles.content,
 *   isVisible && styles.visible,
 *   ...fadeIn()
 * )
 * ```
 *
 * @packageDocumentation
 *
 * @remarks
 * ## Main Exports
 *
 * - **CSS System**: {@link css} utility, {@link CSSProperties}, {@link StylesObject} types
 * - **Design Tokens**: {@link TransformDesignTokens}, {@link DesignToken} model
 * - **Components**: {@link getDesignTokensElement} for token injection
 * - **Schema**: {@link getDesignTokensSchema} for validation support
 *
 * Integrates with Plaited's component system and JSX implementation for a seamless
 * developer experience. All generated styles are automatically collected and managed.
 */

export type * from './styling/css.types.js'
export * from './styling/css.js'
export type * from './styling/design-token.types.js'
export * from './styling/get-design-tokens-element.js'
export * from './styling/get-design-tokens-schema.js'
export * from './styling/transform-design-tokens.js'
