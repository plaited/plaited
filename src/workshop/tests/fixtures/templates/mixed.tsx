import { bElement, type FT, type FunctionTemplate } from 'plaited'

// FunctionTemplate with explicit type
export const MixedFunctionTemplate: FunctionTemplate = () => <div>Function Template in Mixed File</div>

// FT alias
export const MixedFTTemplate: FT = () => <span>FT Alias in Mixed File</span>

// BehavioralTemplate
export const MixedBehavioralTemplate = bElement({
  tag: 'mixed-element',
  shadowDom: <div>Behavioral Template in Mixed File</div>,
})

// Regular function (should NOT be detected)
export function regularHelper() {
  return 'Not a template'
}

// Another template
export const AnotherTemplate: FT<{
  message?: string
}> = (props) => <p>{props?.message || 'Mixed file message'}</p>
