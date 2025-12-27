import { bElement } from 'plaited'

export const SimpleBehavioralTemplate = bElement({
  tag: 'simple-element',
  shadowDom: <div>Simple Element</div>,
})

export const BehavioralTemplateWithProgram = bElement({
  tag: 'interactive-element',
  shadowDom: (
    <button
      type='button'
      p-target='btn'
    >
      Click me
    </button>
  ),
  bProgram({ $ }) {
    const [btn] = $('btn')
    return {
      CLICK() {
        btn?.render('Clicked!')
      },
    }
  },
})
