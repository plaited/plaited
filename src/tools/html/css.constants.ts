/**
 * Pattern matching CSS custom property references like `var(--my-prop)`.
 * Inline style strings use these to reference custom properties at runtime.
 *
 * @public
 */
export const CUSTOM_PROPERTY_REF_PATTERN = /var\(\s*--/
