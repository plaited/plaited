// Function that returns TemplateObject directly (JSX)
export const simpleTemplate = () => <div>Simple Template</div>

// Function with explicit TemplateObject return type
import type { TemplateObject } from 'plaited'
export const explicitTemplate = (): TemplateObject => <span>Explicit</span>

// Arrow function with args
export const arrowTemplate = ({ children }: { children: string }) => <p>{children}</p>

// Regular function declaration
export function functionTemplate() {
  return <h1>Function Template</h1>
}

// Non-template function (should not be detected)
export const notATemplate = () => 'just a string'
